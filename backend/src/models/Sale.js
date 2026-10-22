/**
 * Helpers de acesso a dados para registros de vendas.
 * @module models/Sale
 */
import { dbQuery } from '../config/db.js';

export class SaleModel {
  /**
   * Lista os registros.
   *
   * @returns {Promise<*>} Resultado da operação.
   */
  static async list() {
    const result = await dbQuery(
      `SELECT s.*, u.name AS user_name, c.name AS customer_name
       FROM sales s
       LEFT JOIN users u ON u.id = s.user_id
       LEFT JOIN customers c ON c.id = s.customer_id
       ORDER BY s.created_at DESC`
    );
    return result.rows;
  }

  /**
   * Cria o registro de cabeçalho de uma venda (sem os itens).
   *
   * @param {import('pg').PoolClient} client Cliente de conexão (transação em andamento).
   * @param {Object} options Opções da consulta.
   * @param {*} customerId Parâmetro `customerId`.
   * @param {*} total Parâmetro `total`.
   * @param {*} paymentMethod Parâmetro `paymentMethod`.
   * @param {*} description Parâmetro `description`.
   * @param {*} sourceReservationId Parâmetro `sourceReservationId`.
   * @returns {Promise<*>} Resultado da operação.
   */
  static async create(client, { userId, customerId = null, total = 0, paymentMethod = 'cash', description = null, sourceReservationId = null }) {
    const result = await client.query(
      `INSERT INTO sales (user_id, customer_id, total, payment_method, description, source_reservation_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, customerId, total, paymentMethod, description, sourceReservationId]
    );
    return result.rows[0];
  }
}
