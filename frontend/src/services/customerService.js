/**
 * Helpers de API para operações de gerenciamento de clientes.
 * @module services/customerService
 */
import api from './api.js';

/**
 * Lista customers.
 */
export const listCustomers = () => api.get('/customers');
/**
 * Cria customer.
 */
export const createCustomer = (payload) => api.post('/customers', payload);
/**
 * Atualiza customer.
 */
export const updateCustomer = (id, payload) => api.put(`/customers/${id}`, payload);
