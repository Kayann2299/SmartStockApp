/**
 * Expõe endpoints relacionados a relatórios para dados do dashboard, geração, listagem e detalhamento.
 * @module routes/reportRoutes
 */
import express from 'express';
import { getDashboard, generateReport, getReports, getReportDetails } from '../controllers/reportController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { roleMiddleware } from '../middlewares/roleMiddleware.js';

const router = express.Router();
router.get('/dashboard', authMiddleware, getDashboard);
router.get('/:id/details', authMiddleware, getReportDetails);
router.get('/', authMiddleware, getReports);
router.post('/generate', authMiddleware, roleMiddleware(['admin', 'manager']), generateReport);

export default router;
