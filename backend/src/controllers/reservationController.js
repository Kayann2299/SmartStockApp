/**
 * Controlador para criação, listagem e atualização de reservas.
 * @module controllers/reservationController
 */
import { createReservationService, listReservationsService, updateReservationStatusService, completeReservationService, contactReservationService } from '../services/reservationService.js';

/**
 * Cria reservation.
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde em JSON com o resultado da operação ou erro apropriado.
 */
export const createReservation = async (req, res) => {
  try {
    const data = await createReservationService({
      customerId: req.body.customer_id || req.body.customerId || null,
      newCustomer: req.body.newCustomer || null,
      items: req.body.items || []
    });
    res.status(201).json(data);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/**
 * Retorna reservations.
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde em JSON com o resultado da operação ou erro apropriado.
 */
export const getReservations = async (req, res) => {
  try {
    const reservations = await listReservationsService(req.query.from || null, req.query.to || null);
    res.json(reservations);
  } catch (err) {
    res.status(500).json({ message: 'Unable to list reservations.', error: err.message });
  }
};

/**
 * Atualiza reservation.
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde em JSON com o resultado da operação ou erro apropriado.
 */
export const updateReservation = async (req, res) => {
  try {
    const status = String(req.body.status || '').toLowerCase();

    if (status === 'completed') {
      const customerData = {};
      if (req.body.newCustomer) customerData.newCustomer = req.body.newCustomer;
      if (req.body.customer_id) customerData.customer_id = req.body.customer_id;
      const completed = await completeReservationService(req.params.id, req.user.id, req.body.paymentMethod || 'cash', Object.keys(customerData).length ? customerData : null);
      return res.json(completed);
    }

    if (status === 'contacted') {
      const contacted = await contactReservationService(req.params.id, req.body.smtpFrom || null);
      return res.json(contacted);
    }

    const reservation = await updateReservationStatusService(req.params.id, status);
    if (!reservation) return res.status(404).json({ message: 'Reservation not found.' });
    res.json(reservation);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
