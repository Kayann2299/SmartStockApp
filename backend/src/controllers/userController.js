
/**
 * Controlador para gestão de usuários, perfis e configurações da empresa.
 * @module controllers/userController
 */
import { dbQuery } from '../config/db.js';
import { normalizeCompanySettingsPayload } from '../utils/companySettings.js';
import { normalizeNotificationPreferences } from '../utils/notificationPreferences.js';
import { UserModel } from '../models/User.js';

/**
 * Retorna users.
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde em JSON com o resultado da operação ou erro apropriado.
 */
export const getUsers = async (req, res) => {
  try {
    const users = await UserModel.list();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Unable to list users.', error: error.message });
  }
};

/**
 * Atualiza user role.
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde em JSON com o resultado da operação ou erro apropriado.
 */
export const updateUserRole = async (req, res) => {
  try {
    const user = await UserModel.updateRole(req.params.id, req.body.role);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Unable to update role.', error: error.message });
  }
};

/**
 * Atualiza user active.
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde em JSON com o resultado da operação ou erro apropriado.
 */
export const updateUserActive = async (req, res) => {
  try {
    const user = await UserModel.updateActive(req.params.id, req.body.is_active);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Unable to update status.', error: error.message });
  }
};

/**
 * Atualiza current user profile.
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde em JSON com o resultado da operação ou erro apropriado.
 */
export const updateCurrentUserProfile = async (req, res) => {
  try {
    const user = await UserModel.updateName(req.user.id, req.body.name);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Unable to update profile.', error: error.message });
  }
};

/**
 * Salva company settings.
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde em JSON com o resultado da operação ou erro apropriado.
 */
export const saveCompanySettings = async (req, res) => {
  try {
    const payload = normalizeCompanySettingsPayload(req.body || {});

    // Este endpoint não é restrito por role (é chamado para persistir as
    // definições de empresa/localização por qualquer utilizador autenticado).
    // Por isso, só atualizamos notification_preferences quando o pedido as
    // envia explicitamente — caso contrário, preservamos o valor já guardado,
    // para não repor os valores por omissão sempre que este endpoint é chamado
    // (ex.: auto-persist inicial feito por um employee).
    const hasExplicitPreferences = req.body?.notification_preferences !== undefined
      || req.body?.notifications !== undefined;

    let notificationPreferences;
    if (hasExplicitPreferences) {
      notificationPreferences = normalizeNotificationPreferences(
        req.body?.notification_preferences || req.body?.notifications
      );
    } else {
      const currentResult = await dbQuery(
        `SELECT notification_preferences FROM settings ORDER BY id DESC LIMIT 1`
      );
      notificationPreferences = normalizeNotificationPreferences(
        currentResult.rows[0]?.notification_preferences
      );
    }

    const result = await dbQuery(
      `INSERT INTO settings (
        company_name,
        company_address,
        company_email,
        company_phone,
        company_vat,
        currency,
        timezone,
        date_format,
        reservation_enabled,
        theme,
        notification_preferences
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb) RETURNING *`,
      [
        payload.company_name,
        payload.company_address,
        payload.company_email,
        payload.company_phone,
        payload.company_vat,
        payload.currency,
        payload.timezone,
        payload.date_format,
        payload.reservation_enabled,
        payload.theme,
        JSON.stringify(notificationPreferences)
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Unable to save company settings.', error: error.message });
  }
};

/**
 * Guarda apenas as preferências de notificação (alerts/reports, email/sms),
 * preservando os restantes dados da empresa já guardados anteriormente.
 * Restrito a admin/manager — ver rota em userRoutes.js.
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde em JSON com o registo de settings resultante.
 */
export const saveNotificationPreferences = async (req, res) => {
  try {
    const notificationPreferences = normalizeNotificationPreferences(
      req.body?.notification_preferences || req.body?.notifications
    );

    const currentResult = await dbQuery(`SELECT * FROM settings ORDER BY id DESC LIMIT 1`);
    const current = currentResult.rows[0] || {};

    const result = await dbQuery(
      `INSERT INTO settings (
        company_name,
        company_address,
        company_email,
        company_phone,
        company_vat,
        currency,
        timezone,
        date_format,
        reservation_enabled,
        theme,
        notification_preferences
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb) RETURNING *`,
      [
        current.company_name || '',
        current.company_address || '',
        current.company_email || '',
        current.company_phone || '',
        current.company_vat || '',
        current.currency || 'EUR',
        current.timezone || 'Europe/Lisbon',
        current.date_format || 'DD/MM/YYYY',
        current.reservation_enabled ?? true,
        current.theme || 'light',
        JSON.stringify(notificationPreferences)
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Unable to save notification preferences.', error: error.message });
  }
};

/**
 * Retorna as configurações da empresa mais recentes, incluindo as preferências
 * de notificação (alerts/reports, email/sms).
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde em JSON com o registo mais recente de `settings` ou null.
 */
export const getCompanySettings = async (req, res) => {
  try {
    const result = await dbQuery(`SELECT * FROM settings ORDER BY id DESC LIMIT 1`);
    res.json(result.rows[0] || null);
  } catch (error) {
    res.status(500).json({ message: 'Unable to load company settings.', error: error.message });
  }
};

/**
 * Salva message templates.
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde em JSON com o resultado da operação ou erro apropriado.
 */
export const saveMessageTemplates = async (req, res) => {
  try {
    const templates = req.body || {};
    const rows = [];

    for (const [type, template] of Object.entries(templates)) {
      if (!template || typeof template !== 'object') continue;
      const existing = await dbQuery(`SELECT id FROM message_templates WHERE type = $1 LIMIT 1`, [type]);
      if (existing.rows[0]) {
        const result = await dbQuery(
          `UPDATE message_templates
           SET subject = $2, content = $3, updated_at = CURRENT_TIMESTAMP
           WHERE type = $1 RETURNING *`,
          [type, template.subject || '', template.body || '']
        );
        rows.push(result.rows[0]);
      } else {
        const result = await dbQuery(
          `INSERT INTO message_templates (type, subject, content, updated_at)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP) RETURNING *`,
          [type, template.subject || '', template.body || '']
        );
        rows.push(result.rows[0]);
      }
    }

    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Unable to save message templates.', error: error.message });
  }
};
