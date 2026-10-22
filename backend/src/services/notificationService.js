import { dbQuery } from '../config/db.js';
import { getLowAvailabilityItemsService, getStockAlertBreakdownService } from './stockService.js';
import { availabilityAlertTemplate, weeklyStockAlertTemplate } from '../utils/supplierEmailTemplate.js';
import { sendEmail } from '../config/mail.js';
import { sendSMS } from '../config/sms.js';
import { summarizeStockItems } from '../utils/recordDescriptions.js';
import { getNotificationPreferencesService } from '../utils/notificationPreferences.js';

/**
 * Serviço de notificações.
 * Gerencia a listagem e geração de alertas para baixa disponibilidade de estoque.
 */

export const listNotificationsService = async () => {
  const result = await dbQuery(`SELECT * FROM notifications ORDER BY created_at DESC`);
  const rows = result.rows || [];
  // ensure we only return the latest availability_alert (low stock) notification
  const out = [];
  let sawAvailability = false;
  for (const r of rows) {
    if (r.type === 'availability_alert') {
      if (sawAvailability) continue;
      sawAvailability = true;
      out.push(r);
      continue;
    }
    out.push(r);
  }
  return out;
};

/**
 * Marca uma notificação como lida.
 *
 * @param {string|number} id Identificador da notificação.
 * @returns {Promise<Object|null>} Notificação atualizada ou null se não existir.
 */
export const markNotificationReadService = async (id) => {
  const result = await dbQuery(`UPDATE notifications SET is_read = TRUE WHERE id = $1 RETURNING *`, [id]);
  return result.rows[0] || null;
};

/**
 * Cria uma nova notificação no sistema.
 *
 * @param {Object} params Dados da notificação.
 * @param {string} [params.type='system'] Tipo da notificação.
 * @param {string} params.message Conteúdo da mensagem.
 * @returns {Promise<Object>} Notificação criada.
 */
export const createNotificationService = async ({ type = 'system', message }) => {
  const result = await dbQuery(
    `INSERT INTO notifications (type, message) VALUES ($1, $2) RETURNING *`,
    [type, message]
  );
  return result.rows[0];
};

/**
 * Gera uma notificação de baixa disponibilidade com base nos itens de estoque críticos.
 *
 * @returns {Promise<Array<Object>>} Lista de notificações criadas ou atualizadas.
 */
export const generateLowAvailabilityNotificationsService = async () => {
  const lowAvailabilityItems = await getLowAvailabilityItemsService();
  if (lowAvailabilityItems.length === 0) {
    return [];
  }

  const summary = summarizeStockItems(lowAvailabilityItems, 3);
  const message = `Critical stock: ${summary}`;
  // ensure there's only one availability alert notification: update latest or create
  const existingRes = await dbQuery(`SELECT * FROM notifications WHERE type = $1 ORDER BY created_at DESC LIMIT 1`, ['availability_alert']);
  let notification = null;
  if (existingRes.rows.length > 0) {
    const existing = existingRes.rows[0];
    const updatedRes = await dbQuery(`UPDATE notifications SET message = $1, is_read = FALSE, created_at = NOW() WHERE id = $2 RETURNING *`, [message, existing.id]);
    notification = updatedRes.rows[0];
  } else {
    notification = await createNotificationService({ type: 'availability_alert', message });
  }

  // send the alert through the channels enabled in Settings > Notifications
  const prefs = await getNotificationPreferencesService();
  const settingsResult = await dbQuery(`SELECT company_email, company_phone FROM settings ORDER BY id DESC LIMIT 1`);
  const settings = settingsResult.rows[0] || {};

  if (prefs.alerts.email && settings.company_email) {
    try {
      await sendEmail({
        to: settings.company_email,
        subject: `Stock alert: ${lowAvailabilityItems.length} products`,
        html: availabilityAlertTemplate({ items: lowAvailabilityItems })
      });
    } catch (err) {
      console.error('Failed to send availability alert email:', err?.message || err);
    }
  }

  if (prefs.alerts.sms && settings.company_phone) {
    try {
      await sendSMS({
        to: settings.company_phone,
        message: `Stock alert: ${lowAvailabilityItems.length} product(s) with low or no availability.`
      });
    } catch (err) {
      console.error('Failed to send availability alert SMS:', err?.message || err);
    }
  }

  return [notification];
};

/**
 * Alias de {@link generateLowAvailabilityNotificationsService}, mantido por compatibilidade de nome.
 */
export const generateLowStockNotificationsService = generateLowAvailabilityNotificationsService;

/**
 * Gera e envia o alerta semanal de stock (produtos em low stock e produtos
 * em critical stock, em secções separadas), respeitando os canais ativos em
 * Settings > Notifications (alerts.email / alerts.sms). Regista sempre
 * `last_stock_alert_at`, mesmo quando não há itens a reportar, para que o
 * agendador (job) saiba que a verificação desta semana já foi feita.
 *
 * @returns {Promise<{lowStockItems: Array<Object>, criticalStockItems: Array<Object>}>}
 */
export const generateWeeklyStockAlertService = async () => {
  const { lowStockItems, criticalStockItems } = await getStockAlertBreakdownService();

  const settingsResult = await dbQuery(
    `SELECT company_name, company_email, company_phone FROM settings ORDER BY id DESC LIMIT 1`
  );
  const settings = settingsResult.rows[0] || {};

  if (lowStockItems.length > 0 || criticalStockItems.length > 0) {
    const combined = [...criticalStockItems, ...lowStockItems];
    const message = `Weekly stock alert: ${criticalStockItems.length} critical, ${lowStockItems.length} low stock — ${summarizeStockItems(combined, 3)}`;

    const existingRes = await dbQuery(`SELECT * FROM notifications WHERE type = $1 ORDER BY created_at DESC LIMIT 1`, ['weekly_stock_alert']);
    if (existingRes.rows.length > 0) {
      await dbQuery(`UPDATE notifications SET message = $1, is_read = FALSE, created_at = NOW() WHERE id = $2`, [message, existingRes.rows[0].id]);
    } else {
      await createNotificationService({ type: 'weekly_stock_alert', message });
    }

    const prefs = await getNotificationPreferencesService();

    if (prefs.alerts.email && settings.company_email) {
      try {
        await sendEmail({
          to: settings.company_email,
          subject: `Weekly stock alert: ${criticalStockItems.length} critical, ${lowStockItems.length} low stock`,
          html: weeklyStockAlertTemplate({ lowStockItems, criticalStockItems, companyName: settings.company_name })
        });
      } catch (err) {
        console.error('Failed to send weekly stock alert email:', err?.message || err);
      }
    }

    if (prefs.alerts.sms && settings.company_phone) {
      try {
        await sendSMS({
          to: settings.company_phone,
          message: `Weekly stock alert: ${criticalStockItems.length} critical, ${lowStockItems.length} low stock product(s).`
        });
      } catch (err) {
        console.error('Failed to send weekly stock alert SMS:', err?.message || err);
      }
    }
  }

  // A verificação foi feita atomicamente em claimWeeklyStockAlertService, antes
  // de chegarmos aqui — não precisamos (nem devemos) voltar a gravar o
  // timestamp no fim, ou perdemos a proteção contra corrida entre instâncias.
  return { lowStockItems, criticalStockItems };
};

/**
 * Reivindica atomicamente o envio do alerta semanal (à segunda-feira) para
 * a semana corrente. Ao contrário de um simples "SELECT depois decide",
 * isto é uma única query UPDATE ... WHERE ... RETURNING: só a primeira
 * instância/processo a chegar aqui na mesma semana consegue gravar o novo
 * `last_stock_alert_at` e recebe `true`. Isto evita que, ao correr duas
 * instâncias do backend ao mesmo tempo, ambas passem a verificação antes de
 * qualquer uma delas gravar o timestamp — e o alerta seja enviado em duplicado.
 *
 * @param {Date} [now=new Date()] Data de referência.
 * @returns {Promise<boolean>} Verdadeiro se ESTA chamada reivindicou o envio desta semana.
 */
export const claimWeeklyStockAlertService = async (now = new Date()) => {
  const mostRecentMonday = new Date(now);
  mostRecentMonday.setHours(0, 0, 0, 0);
  const dayOfWeek = mostRecentMonday.getDay(); // 0 = domingo, 1 = segunda, ...
  const daysSinceMonday = (dayOfWeek + 6) % 7; // segunda-feira = 0
  const isMonday = daysSinceMonday === 0;
  mostRecentMonday.setDate(mostRecentMonday.getDate() - daysSinceMonday);

  const settingsRes = await dbQuery(`SELECT id, last_stock_alert_at FROM settings ORDER BY id DESC LIMIT 1`);
  const settingsRow = settingsRes.rows[0];
  if (!settingsRow) return false;

  // Se nunca houve um envio anterior registado (`last_stock_alert_at` é NULL —
  // ex.: primeira vez que o job corre depois de uma instalação nova ou de
  // ligar os alertas de email pela primeira vez), não há nenhuma segunda-feira
  // "em falta" para recuperar. Sem esta verificação, o job interpretava isto
  // como um envio perdido e disparava o email de imediato, em qualquer dia da
  // semana em que o servidor arrancasse — o que explica o alerta a ser
  // enviado sozinho e em dias aleatórios. Aqui limitamo-nos a gravar a data
  // de referência, e o alerta passa a ser enviado normalmente a partir da
  // próxima segunda-feira.
  if (settingsRow.last_stock_alert_at === null && !isMonday) {
    await dbQuery(`UPDATE settings SET last_stock_alert_at = $1 WHERE id = $2`, [mostRecentMonday, settingsRow.id]);
    return false;
  }

  const result = await dbQuery(
    `UPDATE settings
     SET last_stock_alert_at = NOW()
     WHERE id = $1
       AND (last_stock_alert_at IS NULL OR last_stock_alert_at < $2)
     RETURNING id`,
    [settingsRow.id, mostRecentMonday]
  );

  return result.rows.length > 0;
};
