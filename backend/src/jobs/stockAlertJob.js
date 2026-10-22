/**
 * Agenda e executa o alerta semanal de stock (produtos em low stock e
 * produtos em critical stock), enviado às segundas-feiras. Se o servidor
 * estiver em baixo numa segunda-feira, o alerta é enviado automaticamente no
 * primeiro dia seguinte em que este job correr (deteção via
 * `last_stock_alert_at`).
 * @module jobs/stockAlertJob
 */
import { generateWeeklyStockAlertService, claimWeeklyStockAlertService } from '../services/notificationService.js';

const CHECK_INTERVAL_MS = 1000 * 60 * 60; // verifica de hora a hora

/**
 * Inicia o job do alerta semanal de stock.
 *
 * @returns {NodeJS.Timeout} Referência do intervalo agendado (para testes/encerramento).
 */
export const startStockAlertJob = () => {
  const runJob = async () => {
    try {
      const claimed = await claimWeeklyStockAlertService();
      if (!claimed) return;

      const { lowStockItems, criticalStockItems } = await generateWeeklyStockAlertService();
      console.log(`[job] weekly stock alert sent: ${criticalStockItems.length} critical, ${lowStockItems.length} low stock.`);
    } catch (error) {
      console.error('[job] weekly stock alert error:', error.message);
    }
  };

  runJob();
  return setInterval(runJob, CHECK_INTERVAL_MS);
};
