/**
 * Define endpoints de vendas para listar vendas, recuperar uma venda por id e criar novas vendas.
 * @module routes/salesRoutes
 */
import express from 'express';
import { createSale, getSales, getSaleById } from '../controllers/salesController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/', authMiddleware, getSales);
router.get('/:id', authMiddleware, getSaleById);
router.post('/', authMiddleware, createSale);

export default router;
