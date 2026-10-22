/**
 * Controlador para criação, listagem e detalhamento de vendas.
 * @module controllers/salesController
 */
import { createSaleService, listSalesService, getSaleByIdService } from '../services/salesService.js';

/**
 * Cria sale.
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde em JSON com o resultado da operação ou erro apropriado.
 */
export const createSale = async (req, res) => {
  try {
    const sale = await createSaleService(
      req.user.id,
      req.body.items,
      req.body.paymentMethod,
      req.body.customerId || null,
      req.body.description || null,
      req.body.sourceReservationId || null
    );

    res.status(201).json(sale);
  } catch (error) {
    res.status(400).json({
      message: error.message
    });
  }
};

/**
 * Retorna sales.
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde em JSON com o resultado da operação ou erro apropriado.
 */
export const getSales = async (req, res) => {
  try {
    const {
      from = null,
      to = null,
      search = '',
      page = 1,
      limit = 50
    } = req.query;

    const sales = await listSalesService({
      from,
      to,
      search,
      page: Number(page),
      limit: Number(limit)
    });

    res.json(sales);
  } catch (error) {
    res.status(500).json({
      message: 'Unable to list sales.',
      error: error.message
    });
  }
};

/**
 * Retorna sale by id.
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde em JSON com o resultado da operação ou erro apropriado.
 */
export const getSaleById = async (req, res) => {
  try {
    const sale = await getSaleByIdService(req.params.id);
    if (!sale) return res.status(404).json({ message: 'Sale not found.' });
    res.json(sale);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch sale.', error: error.message });
  }
};