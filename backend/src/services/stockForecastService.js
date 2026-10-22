import {
  calculateStockAlertMetrics,
  classifyStockAlertRisk,
  isActionableStockAlertItem,
} from '../utils/stockalertformat.js';

/**
 * Fonte única de verdade para as duas janelas de tempo usadas no sistema:
 *
 * 1. "Período de exibição" (resolvePeriodWindow) — controlado pelo usuário
 *    (weekly / monthly / yearly / custom). Usado SOMENTE para métricas de
 *    vendas "cruas": sales summary, sales trend, top products, top profit
 *    products. Isso é o que muda quando alguém troca o filtro no dashboard.
 *
 * 2. "Janela de previsão de estoque" (getForecastWindow) — SEMPRE fixa em
 *    30 dias corridos. Usada para days_to_stockout, average_daily_sales,
 *    recommended_reorder, risk_level e, por consequência, os alertas de
 *    critical stock, low stock e o gráfico de stock status. Nunca é
 *    afetada pelo período escolhido no dashboard.
 *
 * @module services/stockForecastService
 */

export const PERIOD_DAYS = { weekly: 7, monthly: 30, yearly: 365 };

/**
 * Janela real baseada no período escolhido pelo usuário.
 *
 * @param {Object} [params={}]
 * @param {string} [params.period='weekly']
 * @param {string|null} [params.from=null]
 * @param {string|null} [params.to=null]
 * @returns {{period:string, since:Date, until:Date, totalDays:number}}
 */
export const resolvePeriodWindow = ({ period = 'weekly', from = null, to = null } = {}) => {
  const normalizedPeriod = ['weekly', 'monthly', 'yearly', 'custom'].includes(period)
    ? period
    : 'weekly';

  let since;
  let until;

  if (from || to) {
    since = from ? new Date(from) : new Date('1970-01-01');
    until = to ? new Date(to) : new Date();
    if (Number.isNaN(since.getTime())) since = new Date('1970-01-01');
    if (Number.isNaN(until.getTime())) until = new Date();
  } else {
    const days = PERIOD_DAYS[normalizedPeriod] || 7;
    since = new Date();
    since.setDate(since.getDate() - (days - 1));
    until = new Date();
  }

  since.setHours(0, 0, 0, 0);
  until.setHours(23, 59, 59, 999);

  return {
    period: normalizedPeriod,
    since,
    until,
    totalDays: Math.max(1, Math.round((until - since) / 86400000) + 1),
  };
};

/**
 * Janela FIXA de 30 dias usada para previsão de estoque. Por padrão termina
 * "agora" (uso ao vivo: dashboard, notificações, supplier orders, products).
 * Para relatórios históricos, passe a data de referência do relatório e a
 * janela vira "os 30 dias que terminam naquela data".
 *
 * @param {Date} [referenceDate=new Date()]
 * @returns {{forecastSince:Date, forecastUntil:Date, forecastTotalDays:number}}
 */
export const getForecastWindow = (referenceDate = new Date()) => {
  const forecastUntil = new Date(referenceDate);
  forecastUntil.setHours(23, 59, 59, 999);

  const forecastSince = new Date(referenceDate);
  forecastSince.setDate(forecastSince.getDate() - 29);
  forecastSince.setHours(0, 0, 0, 0);

  return { forecastSince, forecastUntil, forecastTotalDays: 30 };
};

/**
 * CTE SQL única para todo lugar que precisa de days_to_stockout /
 * average_daily_sales / recommended_reorder a partir de produtos "ao vivo"
 * (sem reconstrução histórica de quantidade). $1/$2 devem ser
 * [forecastSince, forecastUntil] vindos de getForecastWindow().
 *
 * @param {string} [productFilter=''] Cláusula WHERE opcional (ex.: soft delete / visibilidade)
 */
export const stockForecastCTE = (productFilter = '') => `
WITH stock_data AS (
  SELECT
    p.id,
    p.name,
    p.quantity,
    p.min_level,
    p.price_buy,
    p.price_sell,

    (SELECT COALESCE(SUM(ri.quantity),0)::int
       FROM reservation_items ri
       JOIN reservations r ON r.id = ri.reservation_id
       WHERE ri.product_id = p.id
         AND COALESCE(r.status,'') <> 'completed') AS reserved_quantity,

    GREATEST(
      0,
      p.quantity - (SELECT COALESCE(SUM(ri.quantity),0)::int
        FROM reservation_items ri
        JOIN reservations r ON r.id = ri.reservation_id
        WHERE ri.product_id = p.id
          AND COALESCE(r.status,'') <> 'completed')
    ) AS available_stock,

    COALESCE(s.lead_time,0) AS supplier_lead_time,

    COALESCE((
      SELECT SUM(si.quantity)
      FROM sale_items si
      JOIN sales sale ON sale.id = si.sale_id
      WHERE si.product_id = p.id
        AND sale.created_at BETWEEN $1 AND $2
    ),0)::numeric AS sold_period_30,

    COALESCE((
      SELECT SUM(soi.quantity)
      FROM supplier_order_items soi
      JOIN supplier_orders so ON so.id = soi.order_id
      WHERE soi.product_id = p.id
        AND so.status IN ('pending','completed','received')
        AND so.created_at BETWEEN $1 AND $2
    ),0)::numeric AS purchased_period_30

  FROM products p
  LEFT JOIN suppliers s ON s.id = p.supplier_id
  ${productFilter}
)`;

/**
 * Envolve calculateStockAlertMetrics garantindo que só sold_period_30 /
 * purchased_period_30 (a janela fixa de 30 dias) alimentem o cálculo.
 *
 * @param {Object} row Linha vinda de stockForecastCTE (ou equivalente).
 */
export const computeForecastMetrics = (row) =>
  calculateStockAlertMetrics({
    quantity: Number(row.quantity || 0),
    reservedQuantity: Number(row.reserved_quantity || 0),
    minLevel: Number(row.min_level || 0),
    supplierLeadTime: Number(row.supplier_lead_time || 0),
    sold_Period_30: Number(row.sold_period_30 || 0),
    purchased_Period_30: Number(row.purchased_period_30 || 0),
  });

export { calculateStockAlertMetrics, classifyStockAlertRisk, isActionableStockAlertItem };
