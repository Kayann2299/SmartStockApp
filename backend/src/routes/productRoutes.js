/**
 * Define as rotas do catálogo de produtos para listar, criar, atualizar, excluir e restaurar produtos.
 * @module routes/productRoutes
 */
import express from 'express';
import { getProducts, createProduct, getProductById, restoreProduct, updateProduct, deleteProduct } from '../controllers/productController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { roleMiddleware } from '../middlewares/roleMiddleware.js';

const router = express.Router();
router.get('/', authMiddleware, getProducts);
router.get('/:id', authMiddleware, getProductById);
router.post('/', authMiddleware, roleMiddleware(['admin', 'manager']), createProduct);
router.put('/:id', authMiddleware, roleMiddleware(['admin', 'manager']), updateProduct);
router.delete('/:id', authMiddleware, roleMiddleware(['admin', 'manager']), deleteProduct);
router.patch('/:id/restore', authMiddleware, roleMiddleware(['admin', 'manager']), restoreProduct);
export default router;
