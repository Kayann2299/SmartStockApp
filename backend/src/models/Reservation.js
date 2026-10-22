/**
 * Helpers de acesso a dados para reservas de clientes e itens de reserva.
 * @module models/Reservation
 */
import { dbQuery } from '../config/db.js';

/**
 * Normaliza um intervalo de datas para consulta, aplicando início e fim do
 * dia. Retorna null quando nenhuma das datas é informada (sem filtro de
 * período).
 *
 * @param {string|Date|null} [from=null] Data inicial do intervalo.
 * @param {string|Date|null} [to=null] Data final do intervalo.
 * @returns {{since: Date, until: Date}|null} Intervalo normalizado ou null.
 */
const normalizeRange = (from = null, to = null) => {
  if (!from && !to) return null;
  const since = from ? new Date(from) : new Date('1970-01-01T00:00:00.000Z');
  const until = to ? new Date(to) : new Date();
  since.setHours(0, 0, 0, 0);
  until.setHours(23, 59, 59, 999);
  return { since, until };
};

export class ReservationModel {
  /**
   * Lista os registros.
   *
   * @param {Object} options Opções da consulta.
   * @param {*} to Parâmetro `to`.
   * @returns {Promise<*>} Resultado da operação.
   */
  static async list({ from = null, to = null } = {}) {
    const range = normalizeRange(from, to);
    const params = [];
    let where = '';

    if (range) {
      params.push(range.since, range.until);
      where = 'WHERE r.created_at BETWEEN $1 AND $2';
    }

    const result = await dbQuery(
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
              COUNT(ri.id) AS items_count,
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
       ${where}
      GROUP BY r.id, c.name, c.email, c.phone
      ORDER BY COALESCE(r.completed_at, r.created_at) DESC`,
      params
    );

    return result.rows.map((row) => ({
      ...row,
      items_count: Number(row.items_count || 0),
      items: Array.isArray(row.items) ? row.items : row.items || []
    }));
  }

  /**
   * Cria uma nova reserva (sem itens — os itens são inseridos separadamente pelo serviço).
   *
   * @param {import('pg').PoolClient} client Cliente de conexão (transação em andamento).
   * @param {Object} options Opções da consulta.
   * @param {*} status Parâmetro `status`.
   * @param {*} description Parâmetro `description`.
   * @returns {Promise<*>} Resultado da operação.
   */
  static async create(client, { customerId, status = 'pending', description = null }) {
    const result = await client.query(
      `INSERT INTO reservations (customer_id, status, description)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [customerId, status, description]
    );
    return result.rows[0];
  }
}
