/**
 * Inicializa os jobs em segundo plano agendados usados pela aplicação.
 * @module jobs/backgroundJobs
 */
import { startReportGeneratorJob } from './reportGenerator.js';
import { startStockAlertJob } from './stockAlertJob.js';

/**
 * Inicia background jobs.
 */
export const startBackgroundJobs = () => {
  startReportGeneratorJob();
  startStockAlertJob();
};
