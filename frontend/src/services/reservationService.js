/**
 * Helpers de API para fluxos de gerenciamento de reservas.
 * @module services/reservationService
 */
import api from './api.js';

/**
 * Lista reservations.
 */
export const listReservations = (params = {}) => api.get('/reservations', { params });
/**
 * Cria reservation.
 */
export const createReservation = (payload) => api.post('/reservations', payload);
/**
 * Atualiza reservation status.
 */
export const updateReservationStatus = (id, payload) => api.patch(`/reservations/${id}`, payload);
/**
 * Executa a operação complete reservation.
 */
export const completeReservation = (id, payload) => api.patch(`/reservations/${id}`, payload);
