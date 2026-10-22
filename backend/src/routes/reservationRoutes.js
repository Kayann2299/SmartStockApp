/**
 * Registra endpoints de reservas para criar, listar e atualizar reservas.
 * @module routes/reservationRoutes
 */
import express from 'express';
import { createReservation, getReservations, updateReservation } from '../controllers/reservationController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/', authMiddleware, getReservations);
router.post('/', authMiddleware, createReservation);
router.patch('/:id', authMiddleware, updateReservation);

export default router;
