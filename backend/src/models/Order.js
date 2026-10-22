/**
 * Helpers de acesso a dados para pedidos de fornecedores.
 * @module models/Order
 */
import { dbQuery } from '../config/db.js';

const selectOrder = `
  so.*,
  s.name AS supplier_name,
  s.email AS supplier_email,
  s.phone AS supplier_phone,
  s.photo_url AS supplier_photo_url,
  s.lead_time AS supplier_lead_time
`;

export class OrderModel {
  /**
   * Cria um novo pedido de compra a um fornecedor.
   *
   * @param {import('pg').PoolClient} client Cliente de conexão (transação em andamento).
   * @param {Object} options Opções da consulta.
   * @param {*} status Parâmetro `status`.
   * @param {*} channel Parâmetro `channel`.
   * @param {*} message Parâmetro `message`.
   * @param {*} notes Parâmetro `notes`.
   * @returns {Promise<*>} Resultado da operação.
   */
  static async create(client, { supplierId, status = 'pending', channel = 'email', message = null, notes = null }) {
    const result = await client.query(
      `INSERT INTO supplier_orders (supplier_id, status, channel, message, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [supplierId, status, channel, message, notes]
    );
    return result.rows[0];
  }

  /**
   * Lista os registros.
   *
   * @returns {Promise<*>} Resultado da operação.
   */
  static async list() {
    const result = await dbQuery(
      `SELECT ${selectOrder}
       FROM supplier_orders so
       LEFT JOIN suppliers s ON s.id = so.supplier_id
       ORDER BY so.created_at DESC`
    );
    return result.rows;
  }

  /**
   * Busca um registro pelo seu identificador.
   *
   * @param {*} id Parâmetro `id`.
   * @returns {Promise<*>} Resultado da operação.
   */
  static async findById(id) {
    const result = await dbQuery(
      `SELECT ${selectOrder}
       FROM supplier_orders so
       LEFT JOIN suppliers s ON s.id = so.supplier_id
       WHERE so.id = $1
       LIMIT 1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Atualiza status.
   *
   * @param {*} id Parâmetro `id`.
   * @param {*} status Parâmetro `status`.
   * @returns {Promise<*>} Resultado da operação.
   */
  static async updateStatus(id, status) {
    const result = await dbQuery(
      `UPDATE supplier_orders
       SET status = $2
       WHERE id = $1
       RETURNING *`,
      [id, status]
    );
    return result.rows[0] || null;
  }
}
