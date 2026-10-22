/**
 * API helper for global business search requests.
 * @module services/searchService
 */
import api from './api.js';

/**
 * Pesquisa business.
 */
export const searchBusiness = ({ q, type = 'all' }) => api.get('/search', { params: { q, type } });
