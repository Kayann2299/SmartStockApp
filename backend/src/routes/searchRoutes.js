/**
 * Define o endpoint de busca usado para consultar dados do negócio.
 * @module routes/searchRoutes
 */
import express from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { searchBusiness } from '../controllers/searchController.js';

const router = express.Router();

router.get('/', authMiddleware, searchBusiness);

export default router;
