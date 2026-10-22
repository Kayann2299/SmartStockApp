/**
 * Helpers de API para operações de fornecedores e pedidos de fornecedores.
 * @module services/supplierService
 */
import api from './api.js';

/**
 * Lista suppliers.
 */
export const listSuppliers = () => api.get('/suppliers');
/**
 * Cria supplier.
 */
export const createSupplier = (payload) => api.post('/suppliers', payload);
/**
 * Atualiza supplier.
 */
export const updateSupplier = (id, payload) => api.put(`/suppliers/${id}`, payload);

/**
 * Lista supplier orders.
 */
export const listSupplierOrders = () => api.get('/suppliers/orders');
/**
 * Lista low stock by supplier.
 */
export const listLowStockBySupplier = () => api.get('/suppliers/orders/low-stock');
/**
 * Cria supplier order.
 */
export const createSupplierOrder = (supplierId, payload) => api.post(`/suppliers/${supplierId}/orders`, payload);
/**
 * Cria supplier order direct.
 */
export const createSupplierOrderDirect = (payload) => api.post('/suppliers/orders', payload);
/**
 * Atualiza supplier order status.
 */
export const updateSupplierOrderStatus = (orderId, status) => api.patch(`/suppliers/orders/${orderId}/status`, { status });
