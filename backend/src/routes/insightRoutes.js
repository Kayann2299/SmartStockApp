/**
 * Expõe endpoints relacionados a insights para resumos do dashboard e consultas assistidas por IA.
 * @module routes/insightRoutes
 */
import express from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { getInsights, askInsight } from '../controllers/insightController.js';

const router = express.Router();

router.get('/', authMiddleware, getInsights);
router.post('/ask', authMiddleware, askInsight);

export default router;
