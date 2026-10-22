/**
 * Registra endpoints de notificações para buscar, marcar como lidas e gerar alertas de baixa disponibilidade.
 * @module routes/notificationRoutes
 */
import express from 'express';
import { getNotifications, readNotification, generateLowAvailabilityNotifications } from '../controllers/notificationController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/', authMiddleware, getNotifications);
router.patch('/:id/read', authMiddleware, readNotification);
router.post('/generate-low-availability', authMiddleware, generateLowAvailabilityNotifications);

export default router;
