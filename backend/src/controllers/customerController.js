/**
 * Controlador para operações de clientes, incluindo listagem, criação e atualização.
 * @module controllers/customerController
 */
import { createCustomerService, listCustomersService, updateCustomerService } from '../services/customerService.js';

/**
 * Retorna customers.
 */
export const getCustomers = async (_req, res) => {
  try {
    const customers = await listCustomersService();
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: 'Unable to list customers.', error: error.message });
  }
};

/**
 * Cria customer.
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde em JSON com o resultado da operação ou erro apropriado.
 */
export const createCustomer = async (req, res) => {
  try {
    const customer = await createCustomerService(req.body);
    res.status(201).json(customer);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/**
 * Atualiza customer.
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde em JSON com o resultado da operação ou erro apropriado.
 */
export const updateCustomer = async (req, res) => {
  try {
    const customer = await updateCustomerService(req.params.id, req.body);
    if (!customer) return res.status(404).json({ message: 'Customer not found.' });
    res.json(customer);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
