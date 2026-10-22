/**
 * Helpers de acesso a dados para os registros de clientes.
 * @module models/Customer
 */
import { dbQuery } from '../config/db.js';

export class CustomerModel {
  /**
   * Lista os registros.
   *
   * @returns {Promise<*>} Resultado da operação.
   */
  static async list() {
    const result = await dbQuery(
      `SELECT id, name, nif, email, phone, created_at
       FROM customers
       ORDER BY created_at DESC, name ASC`
    );
    return result.rows;
  }

  /**
   * Cria um novo cliente.
   *
   * @param {import('pg').PoolClient} client Cliente de conexão (transação em andamento).
   * @param {Object} options Opções da consulta.
   * @param {*} nif Parâmetro `nif`.
   * @param {*} email Parâmetro `email`.
   * @param {*} phone Parâmetro `phone`.
   * @returns {Promise<*>} Resultado da operação.
   */
  static async create(client, { name, nif = null, email = null, phone = null }) {
    const result = await client.query(
      `INSERT INTO customers (name, nif, email, phone)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, nif, email, phone, created_at`,
      [name, nif, email, phone]
    );
    return result.rows[0];
  }

  /**
   * Atualiza os dados de um cliente existente.
   *
   * @param {*} id Parâmetro `id`.
   * @param {*} data Parâmetro `data`.
   * @returns {Promise<*>} Resultado da operação.
   */
  static async update(id, data) {
    const { name, nif, email, phone } = data;

    const result = await dbQuery(
      `UPDATE customers
       SET name = COALESCE($2, name),
           nif = COALESCE($3, nif),
           email = COALESCE($4, email),
           phone = COALESCE($5, phone)
       WHERE id = $1
       RETURNING id, name, nif, email, phone, created_at`,
      [id, name ?? null, nif ?? null, email ?? null, phone ?? null]
    );

    return result.rows[0] || null;
  }
}
