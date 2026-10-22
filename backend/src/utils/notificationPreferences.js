/**
 * Utilitários para normalizar e ler as preferências de canal de notificação
 * (alerts / reports, cada um com email e sms) guardadas na tabela `settings`.
 * @module utils/notificationPreferences
 */
import { dbQuery } from '../config/db.js';

/**
 * Preferências por omissão, usadas quando ainda não existe nenhum registo
 * em `settings` ou quando o valor guardado está incompleto.
 * @type {Object}
 */
export const DEFAULT_NOTIFICATION_PREFERENCES = {
  alerts: { email: true, sms: false },
  reports: { email: true, sms: false },
};

/**
 * Normaliza um payload de preferências de notificação vindo do frontend ou da
 * base de dados, garantindo que apenas os grupos e canais suportados (alerts/
 * reports, email/sms) são considerados e que os restantes assumem o valor
 * por omissão.
 *
 * @param {Object} [payload={}] Preferências brutas recebidas.
 * @returns {{alerts: {email: boolean, sms: boolean}, reports: {email: boolean, sms: boolean}}}
 *          Preferências normalizadas.
 */
export function normalizeNotificationPreferences(payload = {}) {
  const source = payload && typeof payload === 'object' ? payload : {};

  /**
   * Normaliza as preferências de um único grupo (alerts/reports), aplicando
   * os valores por omissão a canais ausentes ou com tipo inválido.
   *
   * @param {'alerts'|'reports'} group Nome do grupo a normalizar.
   * @returns {{email: boolean, sms: boolean}} Preferências normalizadas do grupo.
   */
  const normalizeGroup = (group) => ({
    email: typeof source?.[group]?.email === 'boolean'
      ? source[group].email
      : DEFAULT_NOTIFICATION_PREFERENCES[group].email,
    sms: typeof source?.[group]?.sms === 'boolean'
      ? source[group].sms
      : DEFAULT_NOTIFICATION_PREFERENCES[group].sms,
  });

  return {
    alerts: normalizeGroup('alerts'),
    reports: normalizeGroup('reports'),
  };
}

/**
 * Obtém as preferências de notificação atualmente guardadas (registo mais
 * recente da tabela `settings`). Quando ainda não existe nenhum registo, ou
 * quando o valor guardado não é um JSON válido, devolve os valores por
 * omissão.
 *
 * @returns {Promise<{alerts: {email: boolean, sms: boolean}, reports: {email: boolean, sms: boolean}}>}
 */
export const getNotificationPreferencesService = async () => {
  const result = await dbQuery(
    `SELECT notification_preferences FROM settings ORDER BY id DESC LIMIT 1`
  );

  const raw = result.rows[0]?.notification_preferences;
  if (!raw) {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }

  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return normalizeNotificationPreferences(parsed);
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
};
