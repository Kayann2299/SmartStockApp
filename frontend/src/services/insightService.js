/**
 * Helpers de API para insights do dashboard e consultas assistidas por IA.
 * @module services/insightService
 */
import api from './api.js';

/**
 * Retorna insights.
 */
export const getInsights = (params = {}) => api.get('/insights', { params });
/**
 * Executa a operação ask insight.
 */
export const askInsight = (payload) => api.post('/insights/ask', payload);
