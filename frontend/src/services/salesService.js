/**
 * Helpers de API para fluxos de listagem e criação de vendas.
 * @module services/salesService
 */
import api from './api.js';

/**
 * Lista sales.
 */
export const listSales = (params = {}) => api.get('/sales', { params });
/**
 * Cria sale.
 */
export const createSale = (payload) => api.post('/sales', payload);
/**
 * Pesquisa sales.
 */
export const searchSales = (params) => api.get('/sales/search', { params });
/**
 * Retorna sale.
 */
export const getSale = (id) => api.get(`/sales/${id}`);