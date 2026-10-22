import { pool } from '../config/db.js';
import { CustomerModel } from '../models/Customer.js';

/**
 * Serviço de clientes.
 * Centraliza operações de listagem, criação e atualização de clientes.
 */

export const listCustomersService = async () => CustomerModel.list();

/**
 * Cria um novo cliente com validação básica de dados obrigatórios.
 *
 * @param {Object} payload Dados do cliente a ser criado.
 * @param {string} payload.name Nome do cliente.
 * @param {string|null} [payload.nif] Número de identificação fiscal.
 * @param {string|null} [payload.email] E-mail de contato.
 * @param {string|null} [payload.phone] Telefone de contato.
 * @returns {Promise<Object>} Cliente criado.
 */
export const createCustomerService = async (payload) => {
  const name = payload?.name ? String(payload.name).trim() : null;
  const nif = payload?.nif ? String(payload.nif).trim() : null;
  const email = payload?.email ? String(payload.email).trim() : null;
  const phone = payload?.phone ? String(payload.phone).trim() : null;

  if (!email && !phone) {
    throw new Error('Email or phone is required.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const customer = await CustomerModel.create(client, { name, nif, email, phone });
    await client.query('COMMIT');
    return customer;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Atualiza os dados de um cliente existente.
 *
 * @param {string|number} id Identificador do cliente.
 * @param {Object} payload Campos a serem atualizados.
 * @returns {Promise<Object>} Cliente atualizado.
 */
export const updateCustomerService = async (id, payload) => {
  const data = {};

  if (payload && Object.prototype.hasOwnProperty.call(payload, 'name')) {
    data.name = payload.name === '' ? null : String(payload.name).trim();
  }
  if (payload && Object.prototype.hasOwnProperty.call(payload, 'nif')) {
    data.nif = payload.nif === '' ? null : String(payload.nif).trim();
  }
  if (payload && Object.prototype.hasOwnProperty.call(payload, 'email')) {
    data.email = payload.email === '' ? null : String(payload.email).trim();
  }
  if (payload && Object.prototype.hasOwnProperty.call(payload, 'phone')) {
    data.phone = payload.phone === '' ? null : String(payload.phone).trim();
  }

  return CustomerModel.update(id, data);
};
