/**
 * Controlador para listagem, leitura e geração de notificações do sistema.
 * @module controllers/notificationController
 */
import { listNotificationsService, markNotificationReadService, generateLowAvailabilityNotificationsService } from '../services/notificationService.js';

/**
 * Retorna notifications.
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde em JSON com o resultado da operação ou erro apropriado.
 */
export const getNotifications = async (req, res) => {
  try {
    const notifications = await listNotificationsService();
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Unable to list notifications.', error: error.message });
  }
};

/**
 * Marca notification como lida.
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde em JSON com o resultado da operação ou erro apropriado.
 */
export const readNotification = async (req, res) => {
  try {
    const notification = await markNotificationReadService(req.params.id);
    if (!notification) return res.status(404).json({ message: 'Notification not found.' });
    res.json(notification);
  } catch (error) {
    res.status(500).json({ message: 'Unable to mark notification as read.', error: error.message });
  }
};

/**
 * Gera low availability notifications.
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde em JSON com o resultado da operação ou erro apropriado.
 */
export const generateLowAvailabilityNotifications = async (req, res) => {
  try {
    const created = await generateLowAvailabilityNotificationsService();
    res.json({ createdCount: created.length, created });
  } catch (error) {
    res.status(500).json({ message: 'Unable to generate alerts.', error: error.message });
  }
};
