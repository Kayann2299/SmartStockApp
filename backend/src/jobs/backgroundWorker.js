/**
 * Ponto de entrada do worker que inicializa jobs em segundo plano e trata sinais de encerramento.
 * @module jobs/backgroundWorker
 */
import { loadEnv } from '../config/env.js';
import { startReportGeneratorJob } from './reportGenerator.js';
import { startStockAlertJob } from './stockAlertJob.js';

loadEnv();

console.log('[worker] starting background jobs...');
startReportGeneratorJob();
startStockAlertJob();

const shutdown = (signal) => {
  console.log(`[worker] received ${signal}, stopping background jobs...`);
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (error) => {
  console.error('[worker] unhandled rejection:', error);
});
process.on('uncaughtException', (error) => {
  console.error('[worker] uncaught exception:', error);
});
