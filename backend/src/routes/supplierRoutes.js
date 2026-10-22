/**
 * Registra rotas de fornecedores e pedidos de fornecedores para gerenciar fornecedores, pedidos e alertas de estoque baixo.
 * @module routes/supplierRoutes
 */
import express from 'express';
import { createOrder, getSuppliers, createSupplier, updateSupplier, 
  getSupplierOrders,  getLowStockBySupplier, updateOrderStatus,
} from '../controllers/supplierController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { roleMiddleware } from '../middlewares/roleMiddleware.js';

const router = express.Router();
router.get('/', authMiddleware, getSuppliers);
router.get('/orders', authMiddleware, getSupplierOrders);
router.get('/orders/low-stock', authMiddleware, getLowStockBySupplier);
router.post('/', authMiddleware, roleMiddleware(['admin', 'manager']), createSupplier);
router.put('/:id', authMiddleware, roleMiddleware(['admin', 'manager']), updateSupplier);
router.post('/orders', authMiddleware, roleMiddleware(['admin', 'manager']), createOrder);
router.post('/:supplierId/orders', authMiddleware, roleMiddleware(['admin', 'manager']), createOrder);
router.patch('/orders/:orderId/status', authMiddleware, roleMiddleware(['admin', 'manager']), updateOrderStatus);

export default router;
