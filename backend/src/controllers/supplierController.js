/**
 * Controlador para gerenciamento de fornecedores e pedidos de fornecedores.
 * @module controllers/supplierController
 */
import {
  createOrderService,
  listSuppliersService,
  createSupplierService,
  updateSupplierService,
  listSupplierOrdersService,
  listLowStockBySupplierService,
  updateSupplierOrderStatusService,
} from '../services/supplierService.js';

/**
 * Retorna suppliers.
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde em JSON com o resultado da operação ou erro apropriado.
 */
export const getSuppliers = async (req, res) => {
  try {
    const suppliers = await listSuppliersService();
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ message: 'Unable to list suppliers.', error: error.message });
  }
};

/**
 * Cria supplier.
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde em JSON com o resultado da operação ou erro apropriado.
 */
export const createSupplier = async (req, res) => {
  try {
    const supplier = await createSupplierService(req.body);
    res.status(201).json(supplier);
  } catch (error) {
    res.status(500).json({ message: 'Unable to create supplier.', error: error.message });
  }
};

/**
 * Atualiza supplier.
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde em JSON com o resultado da operação ou erro apropriado.
 */
export const updateSupplier = async (req, res) => {
  try {
    const supplier = await updateSupplierService(req.params.id, req.body);
    if (!supplier) return res.status(404).json({ message: 'Supplier not found.' });
    res.json(supplier);
  } catch (error) {
    res.status(500).json({ message: 'Unable to update supplier.', error: error.message });
  }
};

/**
 * Retorna supplier orders.
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde em JSON com o resultado da operação ou erro apropriado.
 */
export const getSupplierOrders = async (req, res) => {
  try {
    const orders = await listSupplierOrdersService();
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Unable to list supplier orders.', error: error.message });
  }
};

/**
 * Retorna low stock by supplier.
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde em JSON com o resultado da operação ou erro apropriado.
 */
export const getLowStockBySupplier = async (req, res) => {
  try {
    const groups = await listLowStockBySupplierService();
    res.json(groups);
  } catch (error) {
    // log full error for debugging
    // eslint-disable-next-line no-console
    console.error('Error in getLowStockBySupplier:', error);
    res.status(500).json({ message: 'Unable to load low stock suggestions.', error: error.message });
  }
};

/**
 * Cria order.
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde em JSON com o resultado da operação ou erro apropriado.
 */
export const createOrder = async (req, res) => {
  try {
    const supplierId = req.params.supplierId || req.body.supplier_id;
    const order = await createOrderService(supplierId, req.body || {});
    res.status(201).json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/**
 * Atualiza order status.
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde em JSON com o resultado da operação ou erro apropriado.
 */
export const updateOrderStatus = async (req, res) => {
  try {
    const order = await updateSupplierOrderStatusService(req.params.orderId, req.body.status);
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: 'Unable to update order status.', error: error.message });
  }
};
