
/**
 * Helpers de acesso a dados para usuários da aplicação.
 * @module models/User
 */
import { dbQuery } from '../config/db.js';

export class UserModel {
  /**
   * Cria um novo usuário.
   *
   * @param {Object} options Opções da consulta.
   * @param {*} email Parâmetro `email`.
   * @param {*} password Parâmetro `password`.
   * @param {*} role Parâmetro `role`.
   * @returns {Promise<*>} Resultado da operação.
   */
  static async create({ name, email, password, role = 'employee' }) {
    const result = await dbQuery(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, is_active, created_at`,
      [name, email, password, role]
    );
    return result.rows[0];
  }

  /**
   * Busca by email.
   *
   * @param {*} email Parâmetro `email`.
   * @returns {Promise<*>} Resultado da operação.
   */
  static async findByEmail(email) {
    const result = await dbQuery(`SELECT * FROM users WHERE email = $1 LIMIT 1`, [email]);
    return result.rows[0] || null;
  }

  /**
   * Busca um registro pelo seu identificador.
   *
   * @param {*} id Parâmetro `id`.
   * @returns {Promise<*>} Resultado da operação.
   */
  static async findById(id) {
    const result = await dbQuery(`SELECT id, name, email, role, is_active, created_at FROM users WHERE id = $1`, [id]);
    return result.rows[0] || null;
  }

  /**
   * Lista os registros.
   *
   * @returns {Promise<*>} Resultado da operação.
   */
  static async list() {
    const result = await dbQuery(`SELECT id, name, email, role, is_active, created_at FROM users ORDER BY created_at DESC`);
    return result.rows;
  }

  /**
   * Atualiza role.
   *
   * @param {*} id Parâmetro `id`.
   * @param {*} role Parâmetro `role`.
   * @returns {Promise<*>} Resultado da operação.
   */
  static async updateRole(id, role) {
    const result = await dbQuery(`UPDATE users SET role = $2 WHERE id = $1 RETURNING id, name, email, role, is_active`, [id, role]);
    return result.rows[0] || null;
  }

  /**
   * Atualiza active.
   *
   * @param {*} id Parâmetro `id`.
   * @param {*} isActive Parâmetro `isActive`.
   * @returns {Promise<*>} Resultado da operação.
   */
  static async updateActive(id, isActive) {
    const result = await dbQuery(`UPDATE users SET is_active = $2 WHERE id = $1 RETURNING id, name, email, role, is_active`, [id, isActive]);
    return result.rows[0] || null;
  }

  /**
   * Atualiza password.
   *
   * @param {*} id Parâmetro `id`.
   * @param {*} password Parâmetro `password`.
   * @returns {Promise<*>} Resultado da operação.
   */
  static async updatePassword(id, password) {
    const result = await dbQuery(`UPDATE users SET password = $2 WHERE id = $1 RETURNING id`, [id, password]);
    return result.rows[0] || null;
  }

  /**
   * Atualiza name.
   *
   * @param {*} id Parâmetro `id`.
   * @param {*} name Parâmetro `name`.
   * @returns {Promise<*>} Resultado da operação.
   */
  static async updateName(id, name) {
    const result = await dbQuery(`UPDATE users SET name = $2 WHERE id = $1 RETURNING id, name, email, role, is_active`, [id, name]);
    return result.rows[0] || null;
  }
}
