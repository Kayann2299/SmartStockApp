/**
 * Define os endpoints de gerenciamento de clientes usados pela API da aplicação.
 * @module routes/customerRoutes
 */
import express from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { roleMiddleware } from '../middlewares/roleMiddleware.js';
import { createCustomer, getCustomers, updateCustomer } from '../controllers/customerController.js';

const router = express.Router();

router.get('/', authMiddleware, getCustomers);
router.post('/', authMiddleware, createCustomer);
router.put('/:id', authMiddleware, roleMiddleware(['admin', 'manager']), updateCustomer);

export default router;
