/**
 * Helpers de API para ações de CRUD e restauração do catálogo de produtos.
 * @module services/productService
 */
import api from './api.js';

/**
 * Lista products.
 */
export const listProducts = (params = {}) => api.get('/products', { params });
/**
 * Cria product.
 */
export const createProduct = (payload) => api.post('/products', payload);
/**
 * Atualiza product.
 */
export const updateProduct = (id, payload) => api.put(`/products/${id}`, payload);
/**
 * Remove product.
 */
export const deleteProduct = (id) => api.delete(`/products/${id}`);
/**
 * Restaura product.
 */
export const restoreProduct = (id) => api.patch(`/products/${id}/restore`);