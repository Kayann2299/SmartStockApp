import { dbQuery } from '../config/db.js';
import { generateDetailedText, generateSummaryText, getAnalyticsStats, resolveAnalysisWindow } from './analyticsService.js';
import { buildReportWindow, getHistoricalReportPeriods } from '../utils/reportPeriods.js';
import { sendEmail } from '../config/mail.js';
import { sendSMS } from '../config/sms.js';
import { getNotificationPreferencesService } from '../utils/notificationPreferences.js';

/**
 * Envia o relatório recém-gerado à empresa através dos canais ativos em
 * Settings > Notifications (reports.email / reports.sms). Falhas de envio
 * são registadas mas não interrompem a geração do relatório (best-effort).
 *
 * @param {Object} report Relatório recém-criado (linha da tabela `reports`).
 * @returns {Promise<void>}
 */
const notifyCompanyOfReport = async (report) => {
  try {
    const prefs = await getNotificationPreferencesService();
    if (!prefs.reports.email && !prefs.reports.sms) {
      return;
    }

    const settingsResult = await dbQuery(
      `SELECT company_name, company_email, company_phone FROM settings ORDER BY id DESC LIMIT 1`
    );
    const company = settingsResult.rows[0] || {};

    if (prefs.reports.email && company.company_email) {
      try {
        await sendEmail({
          to: company.company_email,
          subject: report.title,
          html: `<div style="white-space: pre-wrap; font-family: Arial, sans-serif; line-height: 1.6;">${report.content}</div>`,
          text: report.content
        });
      } catch (err) {
        console.error('Failed to send report email:', err?.message || err);
      }
    }

    if (prefs.reports.sms && company.company_phone) {
      try {
        await sendSMS({
          to: company.company_phone,
          message: `New ${report.type} report available: ${report.title}`
        });
      } catch (err) {
        console.error('Failed to send report SMS:', err?.message || err);
      }
    }
  } catch (err) {
    console.error('Failed to notify company about generated report:', err?.message || err);
  }
};

/**
 * Serviço de relatórios.
 * Responsável pela criação, listagem e detalhes dos relatórios gerados pela aplicação.
 */

const toDateValue = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Retorna as estatísticas do dashboard para o período informado.
 *
 * @param {Object} [params={}] Parâmetros da consulta.
 * @param {string|null} [params.period=null] Período de análise.
 * @param {string|null} [params.from=null] Data inicial.
 * @param {string|null} [params.to=null] Data final.
 * @param {boolean} [params.historicalStock=false] Indicador para dados históricos.
 * @returns {Promise<Object>} Estatísticas resumidas do dashboard.
 */
export const getDashboardStatsService = async ({
  period = null,
  from = null,
  to = null,
  historicalStock = false,
} = {}) => {

  const result = await getAnalyticsStats({
    period,
    from,
    to,
    historicalStock,
  });

  return result;
};
/**
 * Cria um relatório para um tipo e janela de tempo específicos.
 *
 * @param {string} [type='weekly'] Tipo do relatório.
 * @param {Date} [referenceDate=new Date()] Data de referência.
 * @param {Object|null} [window=null] Janela de tempo customizada.
 * @param {Object} [options={}] Opções adicionais.
 * @param {boolean} [options.notify=true] Se verdadeiro, notifica a empresa (email/SMS,
 *   de acordo com as preferências) quando um novo relatório é efetivamente criado.
 *   Usado como `false` durante o preenchimento de relatórios históricos, para evitar
 *   o envio de dezenas de notificações relativas a períodos já passados.
 * @returns {Promise<Object|null>} Relatório criado ou null quando não há dados.
 */
export const createReportService = async (type = 'weekly', referenceDate = new Date(), window = null, { notify = true } = {}) => {
  const reportWindow = window || buildReportWindow(type, referenceDate);
  const stats = await getAnalyticsStats({ period: type, from: reportWindow.since, to: reportWindow.until, historicalStock: true });

  const periodStart = toDateValue(reportWindow.since);
  const periodEnd = toDateValue(reportWindow.until);

  const existingReport = await dbQuery(
    `SELECT *
     FROM reports
     WHERE type = $1
       AND period_start = $2::date
       AND period_end = $3::date
     LIMIT 1`,
    [type, periodStart, periodEnd]
  );

  if (existingReport.rows.length > 0) {
    return existingReport.rows[0];
  }

  if (stats.salesCount === 0) {
    return null;
  }

  const content = generateSummaryText(stats);
  const details = await generateDetailedText(stats);
  const title = `${String(type).toUpperCase()} REPORT • ${periodStart} → ${periodEnd}`;

  const result = await dbQuery(
    `INSERT INTO reports (type, title, content, details, ai_generated, period_start, period_end, created_at)
     VALUES ($1, $2, $3, $4, TRUE, $5, $6, NOW())
     RETURNING *`,
    [type, title, content, details, periodStart, periodEnd]
  );

  const createdReport = result.rows[0];

  if (notify) {
    // best-effort: não bloqueia nem falha a criação do relatório
    notifyCompanyOfReport(createdReport);
  }

  return createdReport;
};

/**
 * Gera relatórios históricos com base no período de vendas existente.
 *
 * @param {Date} [referenceDate=new Date()] Data de referência para geração.
 * @returns {Promise<Array<Object>>} Lista de relatórios criados.
 */
export const populateHistoricalReportsService = async (referenceDate = new Date()) => {
  const salesRangeResult = await dbQuery(
    `SELECT MIN(created_at)::date AS min_created_at, MAX(created_at)::date AS max_created_at
     FROM sales`
  );

  const minCreatedAt = salesRangeResult.rows[0]?.min_created_at;
  const maxCreatedAt = salesRangeResult.rows[0]?.max_created_at;

  if (!minCreatedAt || !maxCreatedAt) {
    return [];
  }

  const periods = getHistoricalReportPeriods(minCreatedAt, maxCreatedAt, referenceDate);
  const createdReports = [];

  for (const period of periods) {
    // notify: false — evita enviar dezenas de emails/SMS ao preencher relatórios
    // históricos (períodos já passados, sem relevância imediata para a empresa)
    const report = await createReportService(period.type, referenceDate, period, { notify: false });
    if (report) {
      createdReports.push(report);
    }
  }

  return createdReports;
};

/**
 * Lista relatórios filtrados por intervalo e tipo.
 *
 * @param {string|null} [from=null] Data inicial do filtro.
 * @param {string|null} [to=null] Data final do filtro.
 * @param {string|null} [type=null] Tipo do relatório.
 * @returns {Promise<Array<Object>>} Lista de relatórios encontrados.
 */
export const listReportsService = async (from = null, to = null, type = null) => {
  const params = [];
  const whereClauses = [];

  if (from || to) {
    const since = from ? new Date(from) : new Date('1970-01-01T00:00:00.000Z');
    const until = to ? new Date(to) : new Date();
    since.setHours(0, 0, 0, 0);
    until.setHours(23, 59, 59, 999);
    params.push(since, until);
    whereClauses.push('created_at BETWEEN $1 AND $2');
  }

  if (type && String(type).toLowerCase() !== 'all') {
    params.push(String(type).toLowerCase());
    whereClauses.push(`type = $${params.length}`);
  }

  const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const result = await dbQuery(
    `SELECT *
     FROM reports
     ${where}
     ORDER BY created_at DESC`,
    params
  );
  return result.rows;
};

/**
 * Resolve o intervalo de datas (de/até) de um relatório já existente,
 * usando o período gravado no registro ou recalculando a partir do tipo
 * do relatório quando não houver período gravado.
 *
 * @param {Object} report Registro do relatório.
 * @returns {{from: Date, to: Date}} Intervalo de datas do relatório.
 */
const getReportWindow = (report) => {
  if (report?.period_start && report?.period_end) {
    return {
      from: new Date(report.period_start),
      to: new Date(report.period_end),
    };
  }

  const { since, until } = resolveAnalysisWindow({ period: report?.type || 'weekly' });
  return { from: since, to: until };
};

/**
 * Retorna os detalhes de um relatório, incluindo análise resumida e estatísticas.
 *
 * @param {string|number} reportId Identificador do relatório.
 * @returns {Promise<Object|null>} Detalhes do relatório ou null se não existir.
 */
export const getReportDetailsService = async (reportId) => {
  const reportResult = await dbQuery(
    `SELECT *
     FROM reports
     WHERE id = $1
     LIMIT 1`,
    [reportId]
  );

  const report = reportResult.rows[0];
  if (!report) {
    return null;
  }

  const { from, to } = getReportWindow(report);
  const stats = await getAnalyticsStats({ period: report.type || 'weekly', from, to , historicalStock: true});
  const savedAnalysis = report.content?.trim();

  let details = report.details;
  if (!details) {
    details = await generateDetailedText(stats);
    await dbQuery(`UPDATE reports SET details = $2 WHERE id = $1`, [reportId, details]);
  }

  return {
    report,
    summary: report.content || generateSummaryText(stats),
    details,
    stats,
  };
};
