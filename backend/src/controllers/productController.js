/**
 * Controlador para CRUD de produtos, incluindo listagem, criação, atualização, exclusão e restauração.
 * @module controllers/productController
 */
import { ProductModel } from '../models/Product.js';

/**
 * Retorna products.
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde em JSON com o resultado da operação ou erro apropriado.
 */
export const getProducts = async (req, res) => {
  try {
    const status = String(req.query.status || 'active').toLowerCase();
    const products = await ProductModel.list({ status });
    return res.json(products);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to list products.', error: error.message });
  }
};

/**
 * Retorna product by id.
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde em JSON com o resultado da operação ou erro apropriado.
 */
export const getProductById = async (req, res) => {
  try {
    const product = await ProductModel.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    return res.json(product);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to fetch product.', error: error.message });
  }
};

/**
 * Cria product.
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde em JSON com o resultado da operação ou erro apropriado.
 */
export const createProduct = async (req, res) => {
  try {
    const product = await ProductModel.create(req.body);
    return res.status(201).json(product);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to create product.', error: error.message });
  }
};
/**
 * Restaura product.
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde em JSON com o resultado da operação ou erro apropriado.
 */
export const restoreProduct = async (req, res) => {
  try {
    const product = await ProductModel.restore(req.params.id);

    if (!product) {
      return res.status(404).json({
        message: 'Product not found.',
      });
    }

    return res.json({
      message: 'Product restored successfully.',
      product,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Unable to restore product.',
      error: error.message,
    });
  }
};

/**
 * Atualiza product.
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde em JSON com o resultado da operação ou erro apropriado.
 */
export const updateProduct = async (req, res) => {
  try {
    const isAdmin = String(req.user?.role || '').toLowerCase() === 'admin';
    const payload = { ...req.body };
    if (!isAdmin && (Object.prototype.hasOwnProperty.call(payload, 'quantity') || Object.prototype.hasOwnProperty.call(payload, 'min_level') || Object.prototype.hasOwnProperty.call(payload, 'name') || Object.prototype.hasOwnProperty.call(payload, 'primary_supplier_id') || Object.prototype.hasOwnProperty.call(payload, 'supplier_id'))) {
      return res.status(403).json({ message: 'Only admins can update product name, supplier, stock quantity or minimum level.' });
    }

    const product = await ProductModel.update(req.params.id, payload);
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    return res.json(product);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to update product.', error: error.message });
  }
};

/**
 * Remove product.
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde em JSON com o resultado da operação ou erro apropriado.
 */
export const deleteProduct = async (req, res) => {
  try {
    const product = await ProductModel.softDelete(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    return res.json({ message: 'Product archived successfully.' });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to delete product.', error: error.message });
  }
};
