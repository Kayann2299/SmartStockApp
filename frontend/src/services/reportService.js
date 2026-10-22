/**
 * Helpers de API para operações de dashboard e geração de relatórios.
 * @module services/reportService
 */
import api from './api.js';

/**
 * Retorna dashboard.
 */
export const getDashboard = (params = {}) => api.get('/reports/dashboard', { params });
/**
 * Lista reports.
 */
export const listReports = (params = {}) => api.get('/reports', { params });
/**
 * Gera report.
 */
export const generateReport = (payload) => api.post('/reports/generate', payload);
/**
 * Retorna report details.
 */
export const getReportDetails = (id) => api.get(`/reports/${id}/details`);
