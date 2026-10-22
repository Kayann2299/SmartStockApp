import { pool, dbQuery } from '../config/db.js';
import { ReservationModel } from '../models/Reservation.js';
import { CustomerModel } from '../models/Customer.js';
import { createSaleTransaction } from './salesService.js';
import { buildReservationDescription } from '../utils/recordDescriptions.js';
import { sendEmail } from '../config/mail.js';
import { sendSMS } from '../config/sms.js';
import { buildReservationEmailContent } from '../utils/reservationEmail.js';

/**
 * Serviço de reservas.
 * Gerencia criação, atualização, conclusão e comunicação de reservas.
 */

/**
 * Carrega o template de mensagem mais recente de um determinado tipo
 * (ex.: confirmação, pronto para retirada) configurado nas definições.
 *
 * @param {string} templateType Tipo do template a carregar.
 * @returns {Promise<{subject: string, body: string}|null>} Template encontrado, ou null se não existir/erro.
 */
const loadMessageTemplate = async (templateType) => {
  try {
    const result = await dbQuery(`SELECT subject, content FROM message_templates WHERE type = $1 ORDER BY updated_at DESC, id DESC LIMIT 1`, [templateType]);
    const template = result.rows[0];
    return template ? { subject: template.subject || '', body: template.content || '' } : null;
  } catch (error) {
    console.warn(`[reservation] Unable to load message template ${templateType}:`, error?.message || error);
    return null;
  }
};

/**
 * Envia um email de reserva ao cliente usando o template configurado para
 * o tipo indicado, com fallback para assunto/corpo padrão quando não há
 * template configurado.
 *
 * @param {Object} params Dados do envio.
 * @param {string} params.customerEmail Email do cliente destinatário.
 * @param {string} [params.fromAddress=null] Endereço de remetente opcional.
 * @param {string} params.templateType Tipo do template de mensagem a usar.
 * @param {Object} params.templateData Dados para preencher os placeholders do template.
 * @param {string} params.fallbackSubject Assunto usado quando não há template configurado.
 * @param {string} params.fallbackBody Corpo usado quando não há template configurado.
 * @returns {Promise<boolean|null>} true se enviado, null se não havia email do cliente.
 */
const sendReservationTemplateEmail = async ({ customerEmail, fromAddress = null, templateType, templateData, fallbackSubject, fallbackBody }) => {
  if (!customerEmail) return null;

  const template = await loadMessageTemplate(templateType);
  await sendEmail({
    to: customerEmail,
    from: fromAddress || undefined,
    template: template ? { subject: template.subject, body: template.body } : null,
    templateData,
    fallbackSubject,
    fallbackBody,
  });

  return true;
};

/**
 * Busca uma reserva pelo id, incluindo os dados do cliente e a lista de
 * itens reservados (nome e quantidade de cada produto).
 *
 * @param {import('pg').PoolClient} client Cliente de conexão (para uso dentro de transações).
 * @param {number|string} reservationId Id da reserva.
 * @returns {Promise<Object|null>} Reserva com itens, ou null se não encontrada.
 */
const getReservationWithItems = async (client, reservationId) => {
  const result = await client.query(
    `SELECT r.id,
            r.customer_id,
            r.status,
            r.description,
            r.completed_at,
            r.completed_sale_id,
            r.created_at,
            c.name AS customer_name,
            c.email AS customer_email,
            c.phone AS customer_phone,
            COALESCE(
              json_agg(
                json_build_object(
                  'product_id', ri.product_id,
                  'quantity', ri.quantity,
                  'product_name', p.name
                )
                ORDER BY p.name
              ) FILTER (WHERE ri.id IS NOT NULL),
              '[]'::json
            ) AS items
     FROM reservations r
     LEFT JOIN customers c ON c.id = r.customer_id
     LEFT JOIN reservation_items ri ON ri.reservation_id = r.id
     LEFT JOIN products p ON p.id = ri.product_id
     WHERE r.id = $1
     GROUP BY r.id, c.name, c.email, c.phone
     LIMIT 1`,
    [reservationId]
  );

  const row = result.rows[0];
  if (!row) return null;
  return {
    ...row,
    items: Array.isArray(row.items) ? row.items : row.items || []
  };
};

/**
 * Busca todas as reservas ativas (não concluídas nem canceladas), com os
 * respetivos itens, para calcular a prontidão de retirada de cada uma.
 *
 * @param {import('pg').PoolClient} client Cliente de conexão (para uso dentro de transações).
 * @returns {Promise<Object[]>} Reservas ativas com os seus itens.
 */
const fetchActiveReservationsForReadiness = async (client) => {
  const result = await client.query(
    `SELECT r.id,
            r.status,
            r.created_at,
            COALESCE(
              json_agg(
                json_build_object(
                  'product_id', ri.product_id,
                  'quantity', ri.quantity
                ) ORDER BY ri.product_id
              ) FILTER (WHERE ri.id IS NOT NULL),
              '[]'::json
            ) AS items
     FROM reservations r
     JOIN reservation_items ri ON ri.reservation_id = r.id
     WHERE COALESCE(r.status,'') NOT IN ('completed', 'cancelled')
     GROUP BY r.id, r.status, r.created_at
     ORDER BY r.created_at ASC, r.id ASC`
  );

  return result.rows.map((row) => ({
    ...row,
    items: Array.isArray(row.items) ? row.items : row.items || []
  }));
};

/**
 * Calcula, para uma lista de reservas ativas (ordenadas por antiguidade),
 * quais já podem ser totalmente atendidas com o stock atual disponível,
 * simulando a alocação de stock reserva a reserva por ordem de chegada.
 *
 * @param {Object[]} reservations Reservas ativas com os respetivos itens.
 * @param {Object[]} productStocks Stock atual disponível por produto.
 * @returns {Map<number|string, string>} Mapa de id da reserva para o status calculado ('ready'/'contacted'/'pending').
 */
const calculateReservationReadiness = (reservations, productStocks) => {
  const remaining = new Map(productStocks.map((product) => [String(product.id), Number(product.quantity || 0)]));
  const statusByReservation = new Map();

  for (const reservation of reservations) {
    const normalizedStatus = String(reservation.status || 'pending').toLowerCase();

    if (normalizedStatus === 'contacted') {
      statusByReservation.set(reservation.id, 'contacted');
      for (const item of reservation.items) {
        const productId = String(item.product_id);
        const quantity = Number(item.quantity || 0);
        remaining.set(productId, Math.max(0, (remaining.get(productId) || 0) - quantity));
      }
      continue;
    }

    let canFulfill = true;
    for (const item of reservation.items) {
      const productId = String(item.product_id);
      const available = Number(remaining.get(productId) || 0);
      if (Number(item.quantity || 0) > available) {
        canFulfill = false;
        break;
      }
    }

    if (canFulfill) {
      statusByReservation.set(reservation.id, 'ready');
      for (const item of reservation.items) {
        const productId = String(item.product_id);
        const quantity = Number(item.quantity || 0);
        remaining.set(productId, Math.max(0, (remaining.get(productId) || 0) - quantity));
      }
    } else {
      statusByReservation.set(reservation.id, 'pending');
    }
  }

  return statusByReservation;
};

/**
 * Recalcula a disponibilidade das reservas para indicar se elas estão prontas para coleta.
 *
 * @returns {Promise<void>} Promessa resolvida após atualização do estado das reservas.
 */
export const refreshReservationReadinessService = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const productsRes = await client.query('SELECT id, quantity FROM products');
    const activeReservations = await fetchActiveReservationsForReadiness(client);
    const readiness = calculateReservationReadiness(activeReservations, productsRes.rows);

    for (const reservation of activeReservations) {
      const computedStatus = readiness.get(reservation.id);
      const currentStatus = String(reservation.status || 'pending').toLowerCase();
      if (computedStatus && computedStatus !== currentStatus) {
        await client.query('UPDATE reservations SET status = $2 WHERE id = $1', [reservation.id, computedStatus]);
      }
    }

    await client.query('COMMIT');
    return readiness;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Cria uma nova reserva com produtos e cliente associados.
 *
 * @param {Object} params Dados da reserva.
 * @param {string|null} [params.customerId=null] Identificador de cliente existente.
 * @param {Object|null} [params.newCustomer=null] Dados de cliente novo.
 * @param {Array<Object>} [params.items=[]] Itens da reserva.
 * @returns {Promise<Object>} Reserva criada.
 */
export const createReservationService = async ({ customerId = null, newCustomer = null, items = [] }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let resolvedCustomerId = customerId;
    let customerName = null;
    let customerEmail = null;

    if (!resolvedCustomerId && newCustomer) {
      const createdCustomer = await CustomerModel.create(client, newCustomer);
      resolvedCustomerId = createdCustomer.id;
      customerName = createdCustomer.name;
      customerEmail = createdCustomer.email || null;
    } else if (resolvedCustomerId) {
      const customerResult = await client.query('SELECT name, email FROM customers WHERE id = $1', [resolvedCustomerId]);
      customerName = customerResult.rows[0]?.name || null;
      customerEmail = customerResult.rows[0]?.email || null;
    }

    if (!resolvedCustomerId) {
      throw new Error('Select an existing customer or create a new one.');
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('The reservation must contain at least one product.');
    }

    const normalizedItems = [];
    for (const item of items) {
      const quantity = Number(item.quantity || 0);
      if (!item.product_id || quantity <= 0) {
        throw new Error('The reservation contains invalid items.');
      }

      const productResult = await client.query(
        'SELECT id, name FROM products WHERE id = $1 LIMIT 1',
        [item.product_id]
      );
      const product = productResult.rows[0];
      if (!product) {
        throw new Error(`Product ${item.product_id} not found.`);
      }

      normalizedItems.push({
        product_id: item.product_id,
        quantity,
        product_name: product.name
      });
    }

    const reservationDescription = buildReservationDescription({
      items: normalizedItems,
      customerName,
      customDescription: newCustomer?.description || ''
    });

    const reservation = await ReservationModel.create(client, {
      customerId: resolvedCustomerId,
      description: reservationDescription
    });

    for (const item of normalizedItems) {
      await client.query(
        `INSERT INTO reservation_items (reservation_id, product_id, quantity)
         VALUES ($1, $2, $3)`,
        [reservation.id, item.product_id, item.quantity]
      );
    }

    await client.query(
      `UPDATE reservations
       SET description = $2
       WHERE id = $1`,
      [reservation.id, reservationDescription]
    );

    await client.query('COMMIT');

    try {
      const settingsResult = await dbQuery(`SELECT company_name, company_address, currency, timezone, date_format FROM settings ORDER BY id DESC LIMIT 1`);
      const settings = settingsResult.rows[0] || {};
      const companyName = settings.company_name || 'SmartStock';
      const companyAddress = settings.company_address || 'Company Address';
      const pickupDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString();
      const templateData = {
        customer_name: customerName || 'customer',
        company_name: companyName,
        company_address: companyAddress,
        reservation_code: reservation.id,
        items: normalizedItems.map((item) => ({
          name: item.product_name,
          quantity: item.quantity,
        })),
        store_name: 'Company Store',
        store_address: 'Company Address',
        pickup_deadline: pickupDeadline,
        total_amount: '0.00',
        date: new Date().toLocaleDateString(),
      };
      const fallbackContent = buildReservationEmailContent({
        type: 'confirmation',
        customerName: customerName || 'customer',
        companyName,
        reservationCode: reservation.id,
        items: normalizedItems,
        storeName: templateData.store_name,
        storeAddress: templateData.store_address,
        pickupDeadline: pickupDeadline,
      });

      await sendReservationTemplateEmail({
        customerEmail,
        templateType: 'OrderConfirmation',
        templateData,
        fallbackSubject: fallbackContent.subject,
        fallbackBody: fallbackContent.html,
      });
    } catch (emailError) {
      console.warn('[reservation] Unable to send confirmation email:', emailError?.message || emailError);
    }

    return { ...reservation, description: reservationDescription };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Lista reservas filtradas por intervalo de datas, se informado.
 *
 * @param {string|null} [from=null] Data inicial do filtro.
 * @param {string|null} [to=null] Data final do filtro.
 * @returns {Promise<Array<Object>>} Lista de reservas.
 */
export const listReservationsService = async (from = null, to = null) => {
  await refreshReservationReadinessService();
  return ReservationModel.list({ from, to });
};

/**
 * Atualiza o estado de uma reserva.
 *
 * @param {string|number} id Identificador da reserva.
 * @param {string} status Novo status da reserva.
 * @returns {Promise<Object|null>} Reserva atualizada ou null.
 */
export const updateReservationStatusService = async (id, status) => {
  const result = await dbQuery(`UPDATE reservations SET status = $2 WHERE id = $1 RETURNING *`, [id, status]);
  return result.rows[0] || null;
};

/**
 * Carrega uma reserva com os dados do cliente e os itens (com nome do
 * produto), necessários para construir a notificação de "pronta para
 * levantamento".
 */
const loadReservationForReadyNotification = async (id) => {
  const result = await dbQuery(
    `SELECT r.id, r.customer_id, r.status, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
            COALESCE(
              json_agg(
                json_build_object('product_id', ri.product_id, 'quantity', ri.quantity, 'product_name', p.name)
                ORDER BY p.name
              ) FILTER (WHERE ri.id IS NOT NULL),
              '[]'::json
            ) AS items
     FROM reservations r
     LEFT JOIN customers c ON c.id = r.customer_id
     LEFT JOIN reservation_items ri ON ri.reservation_id = r.id
     LEFT JOIN products p ON p.id = ri.product_id
     WHERE r.id = $1
     GROUP BY r.id, c.name, c.email, c.phone`,
    [id]
  );

  return result.rows[0] || null;
};

/**
 * Envia a notificação "reserva pronta para levantamento" (email, com
 * fallback por SMS) para o cliente de uma reserva já carregada. Não altera
 * o estado da reserva.
 */
const dispatchReservationReadyNotification = async (reservation, fromAddress = null) => {
  const settingsResult = await dbQuery(`SELECT company_name, company_address, currency, timezone, date_format FROM settings ORDER BY id DESC LIMIT 1`);
  const settings = settingsResult.rows[0] || {};
  const companyName = settings.company_name || 'SmartStock';
  const companyAddress = settings.company_address || 'Company Address';
  const contactName = reservation.customer_name || 'customer';
  const rawItems = Array.isArray(reservation.items) ? reservation.items : [];
  const items = rawItems.length
    ? rawItems.map((item) => ({ name: item.product_name || 'Item', quantity: item.quantity }))
    : [{ name: 'Reservation items', quantity: 1 }];
  const message = `Hello ${contactName}, this is a reminder that your reservation is ready for pickup.`;
  const templateData = {
    customer_name: contactName,
    company_name: companyName,
    company_address: companyAddress,
    reservation_code: reservation.id,
    items,
    store_name: 'Company Store',
    store_address: companyAddress,
    pickup_deadline: new Date().toLocaleDateString(),
    date: new Date().toLocaleDateString()
  };
  const emailContent = buildReservationEmailContent({
    type: 'ready',
    customerName: contactName,
    companyName,
    reservationCode: reservation.id,
    items,
    storeName: templateData.store_name,
    storeAddress: templateData.store_address,
    pickupDeadline: templateData.pickup_deadline
  });

  if (reservation.customer_email) {
    await sendReservationTemplateEmail({
      customerEmail: reservation.customer_email,
      fromAddress,
      templateType: 'ReservationReady',
      templateData,
      fallbackSubject: emailContent.subject,
      fallbackBody: emailContent.html,
    });
  } else if (reservation.customer_phone) {
    await sendSMS({
      to: reservation.customer_phone,
      message
    });
  }
};


/**
 * Envia uma notificação de contato para o cliente da reserva.
 */
export const contactReservationService = async (id, fromAddress = null) => {
  const reservation = await loadReservationForReadyNotification(id);
  if (!reservation) {
    throw new Error('Reservation not found.');
  }

  await dispatchReservationReadyNotification(reservation, fromAddress);

  const updated = await dbQuery(`UPDATE reservations SET status = $2 WHERE id = $1 RETURNING *`, [id, 'contacted']);
  return updated.rows[0] || null;
};

/**
 * Completa uma reserva, converte em venda e atualiza o estado da reserva.
 *
 * @param {string|number} id Identificador da reserva.
 * @param {string|number} userId Identificador do usuário que executa a ação.
 * @param {string} [paymentMethod='cash'] Método de pagamento.
 * @param {Object|null} [customerData=null] Dados de cliente alternativos, se houver.
 * @returns {Promise<Object>} Resultado da conclusão da reserva.
 */
export const completeReservationService = async (id, userId, paymentMethod = 'cash', customerData = null) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const reservation = await getReservationWithItems(client, id);
    if (!reservation) {
      throw new Error('Reservation not found.');
    }

    if (String(reservation.status).toLowerCase() === 'completed' && reservation.completed_sale_id) {
      await client.query('COMMIT');
      return reservation;
    }

    // handle optional customer override (create new customer or use provided id)
    let resolvedCustomerId = reservation.customer_id;
    if (customerData) {
      if (customerData.newCustomer) {
        const createdCustomer = await CustomerModel.create(client, customerData.newCustomer);
        resolvedCustomerId = createdCustomer.id;
      } else if (customerData.customer_id) {
        resolvedCustomerId = customerData.customer_id;
      }
    }

    const saleResult = await createSaleTransaction(client, {
      userId,
      customerId: resolvedCustomerId,
      items: reservation.items,
      paymentMethod,
      description: reservation.description,
      sourceReservationId: reservation.id
    });

    await client.query(
      `UPDATE reservations
       SET status = 'completed',
           completed_sale_id = $2,
           completed_at = NOW(),
           customer_id = COALESCE($3, customer_id)
       WHERE id = $1`,
      [reservation.id, saleResult.sale.id, resolvedCustomerId]
    );

    await client.query('COMMIT');

    return {
      ...reservation,
      status: 'completed',
      completed_sale_id: saleResult.sale.id,
      completed_at: new Date().toISOString(),
      linkedSale: saleResult.sale,
      saleDescription: saleResult.description
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
