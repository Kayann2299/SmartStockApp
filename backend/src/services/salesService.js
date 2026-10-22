import { pool, dbQuery } from '../config/db.js';
import { SaleModel } from '../models/Sale.js';
import { SaleItemModel } from '../models/SaleItem.js';
import { buildSaleDescription } from '../utils/recordDescriptions.js';

/**
 * Serviço de vendas.
 * Responsável por criar, listar e recuperar vendas e itens associados.
 */

/**
 * Converte um valor em Date, retornando um valor de fallback quando o
 * valor for vazio ou inválido.
 *
 * @param {string|Date|null|undefined} value Valor a converter.
 * @param {Date} fallback Data a usar quando `value` for vazio/inválido.
 * @returns {Date} Data resultante.
 */
const parseDate = (value, fallback) => {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
};

/**
 * Normaliza um intervalo de datas para consulta, aplicando início e fim do
 * dia. Retorna null quando nenhuma das datas é informada (sem filtro de
 * período).
 *
 * @param {string|Date|null} from Data inicial do intervalo.
 * @param {string|Date|null} to Data final do intervalo.
 * @returns {{since: Date, until: Date}|null} Intervalo normalizado ou null.
 */
const normalizeRange = (from, to) => {
  if (!from && !to) return null;

  const since = parseDate(from, new Date('1970-01-01T00:00:00.000Z'));
  const until = parseDate(to, new Date());

  since.setHours(0, 0, 0, 0);
  until.setHours(23, 59, 59, 999);

  return { since, until };
};

/**
 * Cria uma transação de venda com validação de estoque e cálculo de totais.
 *
 * @param {Object} client Cliente de transação do banco.
 * @param {Object} params Dados da venda.
 * @param {string|number} params.userId Identificador do usuário.
 * @param {Array<Object>} [params.items=[]] Itens da venda.
 * @param {string} [params.paymentMethod='cash'] Método de pagamento.
 * @param {string|number|null} [params.customerId=null] Cliente vinculado.
 * @param {string|null} [params.description=null] Descrição opcional.
 * @param {string|null} [params.sourceReservationId=null] Reserva vinculada, se houver.
 * @returns {Promise<Object>} Venda criada com seus itens normalizados.
 */
export const createSaleTransaction = async (
  client,
  { userId, items = [], paymentMethod = 'cash', customerId = null, description = null, sourceReservationId = null }
) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('The sale must contain at least one item.');
  }

  let total = 0;
  const normalized = [];

  for (const item of items) {
    const productResult = await client.query(
      `SELECT p.id, p.price_sell, p.name, p.quantity, p.min_level,
              (SELECT COALESCE(SUM(ri.quantity),0)::int FROM reservation_items ri JOIN reservations r ON r.id = ri.reservation_id WHERE ri.product_id = p.id AND COALESCE(r.status,'') != 'completed' AND ($2::uuid IS NULL OR r.id != $2)) AS reserved_other
       FROM products p
       WHERE p.id = $1
       FOR UPDATE`,
      [item.product_id, sourceReservationId]
    );

    const product = productResult.rows[0];
    if (!product) {
      throw new Error(`Product ${item.product_id} not found.`);
    }

    const quantity = Number(item.quantity || 0);
    if (quantity <= 0) {
      throw new Error(`Invalid quantity for product ${product.name}.`);
    }

    const currentQuantity = Number(product.quantity || 0);
    const reservedOther = Number(product.reserved_other || 0);
    const availableQuantity = currentQuantity - reservedOther;
    if (availableQuantity < quantity) {
      throw new Error(`Not enough stock for ${product.name}. Available: ${availableQuantity}`);
    }

    const unitPrice = Number(item.unit_price ?? product.price_sell ?? 0);
    const subtotal = quantity * unitPrice;

    total += subtotal;
    normalized.push({
      productId: product.id,
      quantity,
      unitPrice,
      subtotal,
      name: product.name
    });
  }

  const saleDescription = buildSaleDescription({
    items: normalized,
    paymentMethod,
    sourceReservationId,
    customDescription: description
  });

  const sale = await SaleModel.create(client, {
    userId,
    customerId,
    total,
    paymentMethod,
    description: saleDescription,
    sourceReservationId
  });

  for (const item of normalized) {
    await SaleItemModel.create(client, {
      saleId: sale.id,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal
    });

    await client.query(
      `UPDATE products
       SET quantity = quantity - $2
       WHERE id = $1`,
      [item.productId, item.quantity]
    );
  }

  return { sale, items: normalized, description: saleDescription };
};

/**
 * Cria uma venda completa usando transação de banco.
 *
 * @param {string|number} userId Identificador do usuário.
 * @param {Array<Object>} [items=[]] Itens da venda.
 * @param {string} [paymentMethod='cash'] Método de pagamento.
 * @param {string|number|null} [customerId=null] Cliente associado.
 * @param {string|null} [description=null] Descrição opcional.
 * @param {string|null} [sourceReservationId=null] Reserva vinculada, se existir.
 * @returns {Promise<Object>} Venda criada.
 */
export const createSaleService = async (
  userId,
  items = [],
  paymentMethod = 'cash',
  customerId = null,
  description = null,
  sourceReservationId = null
) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await createSaleTransaction(client, {
      userId,
      items,
      paymentMethod,
      customerId,
      description,
      sourceReservationId
    });

    await client.query('COMMIT');

    return {
      ...result.sale,
      items: result.items,
      description: result.description
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Lista vendas filtradas por intervalo, texto de busca e paginação.
 *
 * @param {Object} [params={}] Parâmetros da consulta.
 * @param {string|null} [params.from=null] Data inicial.
 * @param {string|null} [params.to=null] Data final.
 * @param {string} [params.search=''] Texto de busca.
 * @param {number} [params.page=1] Número da página.
 * @param {number} [params.limit=50] Quantidade de itens por página.
 * @returns {Promise<Object>} Resultado paginado com os dados de vendas.
 */
export const listSalesService = async ({
  from = null,
  to = null,
  search = '',
  page = 1,
  limit = 50
}) => {
  const range = normalizeRange(from, to);
  const offset = Math.max(0, (page - 1) * limit);
  const searchTerm = `%${search.trim()}%`;

  // enforce maximum page size of 50
  const maxLimit = Math.min(Number(limit) || 50, 50);
  const effectiveLimit = maxLimit;
  const effectiveOffset = Math.max(0, (page - 1) * effectiveLimit);

  const whereParts = [];
  const params = [];

  if (search.trim()) {
    params.push(searchTerm);
    const n = params.length;
    whereParts.push(`(
      c.nif ILIKE $${n}
      OR c.phone ILIKE $${n}
      OR c.email ILIKE $${n}
      OR c.name ILIKE $${n}
      OR s.payment_method ILIKE $${n}
      OR s.description ILIKE $${n}
    )`);
  }

  if (range) {
    params.push(range.since);
    const sinceIndex = params.length;

    params.push(range.until);
    const untilIndex = params.length;

    whereParts.push(`(
      s.created_at >= $${sinceIndex}
      AND s.created_at <= $${untilIndex}
    )`);
  }

  const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

  const totalResult = await dbQuery(
    `
    SELECT COUNT(*)::int AS total
    FROM sales s
    LEFT JOIN customers c ON c.id = s.customer_id
    ${whereClause}
    `,
    params
  );

  const total = totalResult.rows[0]?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / effectiveLimit));

  const dataParams = [...params, effectiveLimit, effectiveOffset];

  const sales = await dbQuery(
    `
    WITH all_sales AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC)::int AS sale_number
      FROM sales
    ),
    filtered AS (
      SELECT
        s.*,
        u.name AS user_name,
        c.name AS customer_name,
        al.sale_number
      FROM sales s
      LEFT JOIN all_sales al ON al.id = s.id
      LEFT JOIN users u ON u.id = s.user_id
      LEFT JOIN customers c ON c.id = s.customer_id
      ${whereClause}
    )
    SELECT *
    FROM filtered
    ORDER BY created_at DESC, id DESC
    LIMIT $${params.length + 1}
    OFFSET $${params.length + 2}
    `,
    dataParams
  );

  return {
    data: sales.rows,
    total,
    page,
    limit,
    totalPages
  };
};

/**
 * Recupera uma venda pelo identificador, incluindo seu cliente e itens.
 *
 * @param {string|number} id Identificador da venda.
 * @returns {Promise<Object|null>} Venda encontrada ou null.
 */
export const getSaleByIdService = async (id) => {
  const result = await dbQuery(
    `SELECT s.*, u.name AS user_name,
      json_build_object(
        'id', c.id,
        'name', c.name,
        'nif', c.nif,
        'email', c.email,
        'phone', c.phone,
        'created_at', c.created_at
      ) AS customer,
      COALESCE(
        json_agg(
          json_build_object(
            'id', si.id,
            'product_id', si.product_id,
            'quantity', si.quantity,
            'unit_price', si.unit_price,
            'subtotal', si.subtotal,
            'product_name', p.name
          ) ORDER BY p.name
        ) FILTER (WHERE si.id IS NOT NULL),
        '[]'::json
      ) AS items
    FROM sales s
    LEFT JOIN users u ON u.id = s.user_id
    LEFT JOIN customers c ON c.id = s.customer_id
    LEFT JOIN sale_items si ON si.sale_id = s.id
    LEFT JOIN products p ON p.id = si.product_id
    WHERE s.id = $1
    GROUP BY s.id, u.name, c.id, c.name, c.nif, c.email, c.phone, c.created_at
    LIMIT 1`,
    [id]
  );

  const row = result.rows[0];
  if (!row) return null;
  return {
    ...row,
    items: Array.isArray(row.items) ? row.items : []
  };
};