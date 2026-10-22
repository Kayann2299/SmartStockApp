import { pool, dbQuery } from '../config/db.js';
import { SupplierModel } from '../models/Supplier.js';
import { OrderModel } from '../models/Order.js';
import { sendEmail } from '../config/mail.js';
import { resolvePurchaseOrderCompanyDetails } from '../utils/companySettings.js';
import { sendSMS } from '../config/sms.js';
import { buildSupplierOrderEmailTemplate } from '../utils/supplierEmailTemplate.js';
import { summarizeLineItems } from '../utils/recordDescriptions.js';
import { buildProductVisibilityClause } from '../utils/productVisibility.js';
import {
  getForecastWindow,
  stockForecastCTE,
  computeForecastMetrics,
} from './stockForecastService.js';

/**
 * Serviço de fornecedores.
 * Agrupa criação, listagem, pedidos e alertas relacionados a fornecedores.
 */

const normalizeChannel = (value, supplier) => {
  const requested = String(value || '').toLowerCase();
  if (requested === 'sms') return 'sms';
  if (requested === 'email') return 'email';
  if (supplier?.email) return 'email';
  if (supplier?.phone) return 'sms';
  return 'email';
};

/**
 * Monta a mensagem de pedido para o fornecedor.
 *
 * @param {Object} supplier Dados do fornecedor.
 * @param {Array<Object>} items Itens do pedido.
 * @param {string} [notes=''] Observações adicionais.
 * @returns {string} Mensagem formatada para envio.
 */
const buildOrderMessage = (supplier, items, notes = '') => {
  const preview = summarizeLineItems(
    items.map((item) => ({
      name: item.product_name || item.name,
      quantity: item.quantity,
    })),
    5
  );
  return notes?.trim()
    ? `Hello ${supplier.name}, we would like to place an order for ${preview}. Notes: ${notes.trim()}`
    : `Hello ${supplier.name}, we would like to place an order for ${preview}.`;
};

/**
 * Gera um número compacto de ordem de compra a partir da data atual e do
 * id da encomenda (ex.: "PO-240517-a1b2").
 *
 * @param {string|number} orderId Id da encomenda ao fornecedor.
 * @returns {string} Número compacto formatado.
 */
const buildCompactPurchaseOrderNumber = (orderId) => {
  const today = new Date();
  const stamp = `${String(today.getFullYear()).slice(-2)}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  return `PO-${stamp}-${String(orderId).slice(-4)}`;
};

/**
 * Carrega o template de email de encomenda a fornecedor mais recente
 * configurado nas definições.
 *
 * @returns {Promise<{subject: string, body: string}|null>} Template encontrado, ou null se não existir/erro.
 */
const loadSupplierEmailTemplate = async () => {
  try {
    const result = await dbQuery(
      `SELECT subject, content FROM message_templates WHERE type = $1 ORDER BY updated_at DESC, id DESC LIMIT 1`,
      ['supplier']
    );

    const template = result.rows[0];
    return template ? { subject: template.subject || '', body: template.content || '' } : null;
  } catch (error) {
    console.warn('[supplier] Unable to load saved supplier email template:', error?.message || error);
    return null;
  }
};

/**
 * Enriquece uma lista de encomendas a fornecedores com os respetivos itens
 * (produto, quantidade e preço), buscados numa única consulta.
 *
 * @param {Object[]} orders Encomendas a fornecedores.
 * @returns {Promise<Object[]>} Encomendas com o campo `items` preenchido.
 */
const mapOrderRows = async (orders) => {
  if (!orders.length) return [];

  const orderIds = orders.map((order) => order.id);
  const itemsResult = await dbQuery(
    `SELECT
       soi.id,
       soi.order_id,
       soi.product_id,
       soi.quantity,
       COALESCE(soi.price, p.price_buy, 0) AS price,
       p.name AS product_name,
       p.category AS product_category,
       p.photo_url AS product_photo_url
     FROM supplier_order_items soi
     LEFT JOIN products p ON p.id = soi.product_id
     WHERE soi.order_id = ANY($1::uuid[])
     ORDER BY soi.id ASC`,
    [orderIds]
  );

  const itemsByOrder = itemsResult.rows.reduce((acc, row) => {
    if (!acc[row.order_id]) acc[row.order_id] = [];
    acc[row.order_id].push(row);
    return acc;
  }, {});

  return orders.map((order) => ({
    ...order,
    items: itemsByOrder[order.id] || [],
  }));
};

/**
 * Lista todos os fornecedores cadastrados.
 *
 * @returns {Promise<Array<Object>>} Lista de fornecedores.
 */
export const listSuppliersService = async () => SupplierModel.list();

/**
 * Cria um novo fornecedor.
 *
 * @param {Object} data Dados do fornecedor.
 * @returns {Promise<Object>} Fornecedor criado.
 */
export const createSupplierService = async (data) => SupplierModel.create(data);

/**
 * Atualiza um fornecedor existente.
 *
 * @param {string|number} id Identificador do fornecedor.
 * @param {Object} data Dados a serem alterados.
 * @returns {Promise<Object>} Fornecedor atualizado.
 */
export const updateSupplierService = async (id, data) => SupplierModel.update(id, data);

/**
 * Lista os pedidos de fornecedor cadastrados no sistema.
 *
 * @returns {Promise<Array<Object>>} Lista de pedidos com itens associados.
 */
export const listSupplierOrdersService = async () => {
  const orders = await OrderModel.list();
  return mapOrderRows(orders);
};

/**
 * Lista itens com baixo estoque agrupados por fornecedor.
 *
 * Sempre usa a janela fixa de 30 dias (getForecastWindow) — esta página não
 * tem (e não deve ter) seletor de período; o cálculo de days_to_stockout
 * aqui precisa ser idêntico ao das notificações e da página de produtos.
 *
 * @returns {Promise<Array<Object>>} Itens agrupados por fornecedor.
 */
export const listLowStockBySupplierService = async () => {
  const { forecastSince, forecastUntil } = getForecastWindow();

  const visibilityClause = await buildProductVisibilityClause('p', 'active');
  const productFilter = visibilityClause || '';

  const result = await dbQuery(
    `
    ${stockForecastCTE(productFilter)}

    SELECT
      s.id AS supplier_id,
      s.name AS supplier_name,
      s.email AS supplier_email,
      s.phone AS supplier_phone,
      s.photo_url AS supplier_photo_url,
      s.lead_time,

      p.id AS product_id,
      p.name AS product_name,
      p.category,
      p.photo_url,

      stock_data.quantity,
      stock_data.min_level,
      p.price_buy,
      p.price_sell,
      stock_data.reserved_quantity,
      stock_data.available_stock,
      stock_data.supplier_lead_time,
      stock_data.sold_period_30,
      stock_data.purchased_period_30

    FROM products p
    JOIN stock_data ON stock_data.id = p.id
    LEFT JOIN suppliers s
      ON s.id = p.supplier_id

    ORDER BY
      COALESCE(s.name,'Unassigned supplier'),
      p.name
    `,
    [forecastSince, forecastUntil]
  );

  const groups = [];
  const groupMap = new Map();

/**
 * Verifica se um item de forecast de stock não está em nível saudável
 * (ou seja, requer atenção: low, critical ou out_of_stock).
 *
 * @param {Object} forecast Métricas de forecast do produto.
 * @returns {boolean} Verdadeiro se o produto não estiver saudável.
 */
const isntHealthyItem = (forecast) => {
  return forecast.riskLevel !== 'healthy';
};

  for (const row of result.rows) {
const forecast = computeForecastMetrics(row);


    if (!isntHealthyItem(forecast)) {
      continue;
    }

    const supplierKey = row.supplier_id || 'unassigned';

    if (!groupMap.has(supplierKey)) {

      const group = {
        supplier_id: row.supplier_id,
        supplier_name: row.supplier_name || 'Unassigned supplier',
        supplier_email: row.supplier_email,
        supplier_phone: row.supplier_phone,
        supplier_photo_url: row.supplier_photo_url,
        supplier_lead_time: row.supplier_lead_time,
        items: [],
      };
  const alertType = forecast.riskLevel === 'critical' || forecast.riskLevel === 'out_of_stock'
    ? 'critical'
    : 'low';
      groupMap.set(supplierKey, group);
      groups.push(group);
    }

    groupMap.get(supplierKey).items.push({
      product_id: row.product_id,
      product_name: row.product_name,
      product_category: row.category,

      quantity: forecast.quantity,
      reserved_quantity: forecast.reservedQuantity,
      available_stock: forecast.availableStock,

      min_level: forecast.minLevel,

      price_buy: Number(row.price_buy || 0),
      price_sell: Number(row.price_sell || 0),

      product_photo_url: row.photo_url,

      days_to_stockout: forecast.daysToStockout,
      supplier_lead_time: forecast.supplierLeadTime,

       alert_type: forecast.riskLevel,
  
       recommended_reorder: forecast.recommended_reorder,

      orderquantity: 0,
      already_ordered: false,
    });
  }

  // Produtos já encomendados
  const ids = groups.flatMap(g => g.items.map(i => String(i.product_id)));

  if (ids.length) {

    const ordered = await dbQuery(
      `
      SELECT
        soi.product_id,
        SUM(soi.quantity)::int AS orderquantity
      FROM supplier_order_items soi
      JOIN supplier_orders so
        ON so.id = soi.order_id
      WHERE soi.product_id = ANY($1::uuid[])
        AND so.status='pending'
      GROUP BY soi.product_id
      `,
      [ids]
    );

    const orderedMap = new Map(
      ordered.rows.map(r => [
        String(r.product_id),
        Number(r.orderquantity)
      ])
    );

    for (const group of groups) {
      for (const item of group.items) {

        const qty =
          orderedMap.get(String(item.product_id)) || 0;

        item.orderquantity = qty;
        item.already_ordered = qty > 0;
      }
    }
  }

  return groups;
};

/**
 * Cria um pedido de compra para um fornecedor.
 *
 * @param {string|number} supplierId Identificador do fornecedor.
 * @param {Object} [payload={}] Dados do pedido.
 * @returns {Promise<Object>} Pedido de compra criado.
 */
export const createSupplierOrderService = async (supplierId, payload = {}) => {
  const supplier = await SupplierModel.findById(supplierId);
  if (!supplier) {
    throw new Error('Supplier not found.');
  }

  const items = Array.isArray(payload.items) ? payload.items : [];
  if (items.length === 0) {
    throw new Error('At least one item is required.');
  }

  const notes = String(payload.notes || '').trim();
  const requestedChannel = payload.channel;
  const validItems = items.filter((item) => item?.product_id && Number(item.quantity || 0) > 0);
  if (validItems.length === 0) {
    throw new Error('At least one valid item is required.');
  }

  const channel = normalizeChannel(requestedChannel, supplier);
  const message = buildOrderMessage(supplier, validItems, notes);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const order = await OrderModel.create(client, {
      supplierId,
      status: 'pending',
      channel,
      message,
      notes: notes || null,
    });

    for (const item of validItems) {
      const quantity = Number(item.quantity || 0);
      if (!item.product_id || quantity <= 0) continue;

      // ensure product belongs to this supplier
      const prodRes = await client.query(`SELECT supplier_id FROM products WHERE id = $1 LIMIT 1`, [item.product_id]);
      const prodRow = prodRes.rows[0];
      if (!prodRow) {
        throw new Error(`Product ${item.product_id} not found.`);
      }
      if (String(prodRow.supplier_id) !== String(supplierId)) {
        throw new Error(`Product ${item.product_id} is not linked to the selected supplier.`);
      }

      await client.query(
        `INSERT INTO supplier_order_items (order_id, product_id, quantity, price)
         VALUES ($1, $2, $3, $4)`,
        [order.id, item.product_id, quantity, Number(item.price ?? item.price_buy ?? 0)]
      );
    }

    let sentAt = null;
    const maxAttempts = 3;
    if (channel === 'email' && supplier.email) {
      let lastErr = null;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const settingsResult = await dbQuery(`SELECT company_name, company_address, company_email, company_phone, company_vat, currency, timezone, date_format FROM settings ORDER BY id DESC LIMIT 1`);
          const settings = settingsResult.rows[0] || {};
          const companyDetails = resolvePurchaseOrderCompanyDetails(settings);
          /**
           * Formata um valor monetário com 2 casas decimais.
           *
           * @param {*} value Valor a formatar.
           * @returns {string} Valor formatado (ex.: "12.50").
           */
          const fmtMoney = (value) => Number(value || 0).toFixed(2);
          const supplierTemplate = await loadSupplierEmailTemplate();
          const templateData = {
            supplier_name: supplier.name,
            company_name: companyDetails.companyName,
            company_address: companyDetails.deliveryAddress,
            contact_email: companyDetails.contactEmail || '',
            contact_phone: companyDetails.contactPhone || '',
            company_vat: companyDetails.companyVat || 'N/A',
            date: new Date().toLocaleDateString(),
            po_number: buildCompactPurchaseOrderNumber(order.id),
            items: validItems.map((item) => ({
              name: item.product_name || item.name || 'Product',
              ref: item.ref || '',
              quantity: item.quantity,
              unit_price: fmtMoney(item.price ?? item.price_buy ?? 0),
              subtotal: fmtMoney(Number(item.price ?? item.price_buy ?? 0) * Number(item.quantity || 0))
            })),
            subtotal_total: fmtMoney(validItems.reduce((sum, item) => sum + Number(item.price ?? item.price_buy ?? 0) * Number(item.quantity || 0), 0)),
            vat_rate: 23,
            vat_amount: fmtMoney(validItems.reduce((sum, item) => sum + Number(item.price ?? item.price_buy ?? 0) * Number(item.quantity || 0), 0) * 0.23),
            total_amount: fmtMoney(validItems.reduce((sum, item) => sum + Number(item.price ?? item.price_buy ?? 0) * Number(item.quantity || 0), 0) * 1.23),
            delivery_date: new Date(Date.now() + Number(supplier.lead_time || 7) * 24 * 60 * 60 * 1000).toLocaleDateString(),
            payment_terms: 'Net 30',
            partial_delivery: 'Allowed'
          };
          const renderedTemplate = buildSupplierOrderEmailTemplate({
            template: supplierTemplate,
            companyDetails,
            templateData,
          });
          await sendEmail({
            to: supplier.email,
            subject: renderedTemplate.subject,
            html: renderedTemplate.html,
            text: renderedTemplate.text,
            template: {
              subject: renderedTemplate.subject,
              body: renderedTemplate.html,
            },
            templateData,
            fallbackSubject: renderedTemplate.subject,
            fallbackBody: renderedTemplate.html,
          });
          sentAt = new Date();
          break;
        } catch (err) {
          lastErr = err;
          console.error(`Failed to send supplier order email (attempt ${attempt}):`, err?.message || err);
        }
      }
      if (!sentAt) {
        console.error('All attempts to send supplier order email failed.', lastErr?.message || lastErr);
      }
    } else if (channel === 'sms' && supplier.phone) {
      let lastErr = null;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          await sendSMS({
            to: supplier.phone,
            message,
          });
          sentAt = new Date();
          break;
        } catch (err) {
          lastErr = err;
          console.error(`Failed to send supplier order SMS (attempt ${attempt}):`, err?.message || err);
        }
      }
      if (!sentAt) {
        console.error('All attempts to send supplier order SMS failed.', lastErr?.message || lastErr);
      }
    }

    if (sentAt) {
      await client.query(`UPDATE supplier_orders SET sent_at = $2 WHERE id = $1`, [order.id, sentAt]);
    }

    await client.query('COMMIT');

    const created = await dbQuery(
      `SELECT so.*, s.name AS supplier_name, s.email AS supplier_email, s.phone AS supplier_phone, s.photo_url AS supplier_photo_url, s.lead_time AS supplier_lead_time
       FROM supplier_orders so
       LEFT JOIN suppliers s ON s.id = so.supplier_id
       WHERE so.id = $1
       LIMIT 1`,
      [order.id]
    );

    const orderWithItems = await mapOrderRows(created.rows);
    return orderWithItems[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Atualiza supplier order status service.
 */
export const updateSupplierOrderStatusService = async (orderId, status) => {
  const target = String(status || '').toLowerCase();

  // If marking as received/completed, add ordered quantities to product stock inside a transaction
  if (['received', 'completed'].includes(target)) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // fetch order items
      const itemsRes = await client.query(
        `SELECT product_id, quantity
         FROM supplier_order_items
         WHERE order_id = $1`,
        [orderId]
      );

      for (const row of itemsRes.rows) {
        const prodId = row.product_id;
        const qty = Number(row.quantity || 0);
        if (!prodId || qty <= 0) continue;
        // read current product quantity for logging and safe numeric update
        const currentRes = await client.query(`SELECT quantity FROM products WHERE id = $1 LIMIT 1`, [prodId]);
        const currentQty = Number(currentRes.rows[0]?.quantity ?? 0);

        const newQty = currentQty + qty;

        await client.query(
          `UPDATE products
           SET quantity = $2
           WHERE id = $1`,
          [prodId, newQty]
        );

        // debug log to help trace stock updates during development
        // eslint-disable-next-line no-console
        console.debug(`Supplier order update: product ${prodId} quantity ${currentQty} -> ${newQty} (added ${qty})`);
      }

      // update order status and record when it was received. received_at é
      // usado por analyticsService.js (historicalQuantityExpr) para
      // reconstruir o stock histórico nos relatórios — sem gravar aqui,
      // essa coluna ficava sempre NULL e os relatórios nunca subtraíam
      // entregas de fornecedores ao recalcular o stock de datas passadas.
      await client.query(
        `UPDATE supplier_orders
         SET status = $2,
             received_at = NOW()
         WHERE id = $1`,
        [orderId, target]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // return fresh order with items
    const orders = await listSupplierOrdersService();
    return orders.find((order) => String(order.id) === String(orderId)) || null;
  }

  // fallback: simple status update
  const updated = await OrderModel.updateStatus(orderId, status);
  if (!updated) return null;
  const orders = await listSupplierOrdersService();
  return orders.find((order) => order.id === updated.id) || updated;
};

/**
 * Alias de {@link createSupplierOrderService}, mantido por compatibilidade de nome.
 */
export const createOrderService = createSupplierOrderService;
