/**
 * Agenda e executa jobs automatizados de geração de relatórios.
 * @module jobs/reportGenerator
 */
import { createReportService, populateHistoricalReportsService } from '../services/reportService.js';

const REPORT_TYPES = ['weekly', 'monthly'];

/**
 * Determina se um relatório do tipo indicado deve ser gerado agora
 * (semanal aos domingos, mensal no dia 1). Nunca gera na execução de
 * arranque (`isStartup`), que serve apenas para preencher o histórico.
 *
 * @param {string} type Tipo de relatório ('weekly' ou 'monthly').
 * @param {Date} [now=new Date()] Data de referência.
 * @param {boolean} [isStartup=false] Indica se é a execução de arranque do worker.
 * @returns {boolean} Verdadeiro se o relatório deve ser gerado agora.
 */
const shouldGenerate = (type, now = new Date(), isStartup = false) => {
  if (isStartup) {
    return false;
  }

  if (type === 'weekly') {
    return now.getDay() === 0;
  }

  if (type === 'monthly') {
    return now.getDate() === 1;
  }

  return false;
};

/**
 * Calcula a data/hora da próxima execução agendada, considerando tanto o
 * próximo domingo (relatório semanal) quanto o próximo dia 1 (relatório
 * mensal), retornando a mais próxima das duas.
 *
 * @param {Date} [now=new Date()] Data de referência.
 * @returns {Date} Data/hora da próxima execução.
 */
const getNextRunAt = (now = new Date()) => {
  const weeklyRun = new Date(now);
  weeklyRun.setHours(0, 0, 0, 0);
  const daysUntilSunday = (7 - weeklyRun.getDay()) % 7;
  weeklyRun.setDate(weeklyRun.getDate() + (daysUntilSunday === 0 ? 7 : daysUntilSunday));

  const monthlyRun = new Date(now);
  monthlyRun.setHours(0, 0, 0, 0);
  monthlyRun.setDate(1);
  monthlyRun.setMonth(monthlyRun.getMonth() + 1);

  return new Date(Math.min(weeklyRun.getTime(), monthlyRun.getTime()));
};

/**
 * Inicia report generator job.
 */
export const startReportGeneratorJob = () => {
  let timer = null;

  /**
   * Agenda a próxima execução do job (timeout até ao próximo domingo ou
   * dia 1, o que ocorrer primeiro), reagendando-se recursivamente após
   * cada execução.
   *
   * @param {Date} [now=new Date()] Data de referência para o agendamento.
   * @returns {void}
   */
  const scheduleNextRun = (now = new Date()) => {
    if (timer) {
      clearTimeout(timer);
    }

    const nextRunAt = getNextRunAt(now);
    const delay = Math.max(1000, nextRunAt.getTime() - now.getTime());

    timer = setTimeout(() => {
      runJob(false);
      scheduleNextRun(new Date());
    }, delay);
  };

  /**
   * Executa uma verificação e gera os relatórios (semanal/mensal) que
   * estejam pendentes para a data atual, além de preencher relatórios
   * históricos em falta quando não é a execução de arranque.
   *
   * @param {boolean} [isStartup=false] Indica se é a execução de arranque do worker.
   * @returns {Promise<void>} Resolve quando o job terminar (erros são apenas registados).
   */
  const runJob = async (isStartup = false) => {
    try {
      const now = new Date();
      const generatedReports = [];

      for (const type of REPORT_TYPES) {
        if (!shouldGenerate(type, now, isStartup)) {
          continue;
        }

        const report = await createReportService(type, now);
        if (report) {
          generatedReports.push(report);
        }
      }

      if (!isStartup) {
        const historicalReports = await populateHistoricalReportsService(now);
        if (historicalReports.length > 0) {
          console.log(`[job] backfilled ${historicalReports.length} historical report(s).`);
        }
      }

      if (generatedReports.length > 0) {
        console.log(`[job] automatic reports generated: ${generatedReports.map((item) => item.type).join(', ')}`);
      }
    } catch (error) {
      console.error('[job] error generating report:', error.message);
    }
  };

  runJob(false);
  scheduleNextRun(new Date());
};
