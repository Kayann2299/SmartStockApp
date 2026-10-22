import { dbQuery } from '../config/db.js';
import { askAI, generateReportRecommendation } from './aiService.js';
import {calculateStockAlertMetrics,classifyStockAlertRisk,isActionableStockAlertItem,} from '../utils/stockalertformat.js';
import { resolvePeriodWindow, getForecastWindow, computeForecastMetrics } from './stockForecastService.js';

/**
 * Serviço de análise de dados do SmartStock.
 * Fornece utilidades para calcular janelas de análise, previsões de estoque e métricas de negócio.
 */

/* ============================================================================
 * HELPERS
 * ========================================================================== */
/**
 * Converte um valor qualquer para número, tratando null/undefined/NaN como 0.
 *
 * @param {*} value Valor a converter.
 * @returns {number} Valor numérico (0 se inválido).
 */
const toNumber = (value) => Number(value || 0);

/**
 * Formata um valor numérico com 2 casas decimais, sem símbolo de moeda.
 *
 * @param {*} value Valor a formatar.
 * @returns {string} Valor formatado como string (ex.: "12.50").
 */
const currencyValue = (value) => toNumber(value).toFixed(2);

/**
 * Verifica se o texto normalizado contém pelo menos uma das palavras-chave.
 * Usada pelo analisador local (fallback quando a IA externa falha).
 *
 * @param {string} text Texto já normalizado (lowercase).
 * @param {string[]} keywords Lista de palavras-chave a procurar.
 * @returns {boolean} Verdadeiro se alguma palavra-chave estiver presente no texto.
 */
const keywordMatch = (text, keywords = []) =>
  keywords.some((keyword) => String(text || '').includes(keyword));

/**
 * Formata uma data (Date ou string) no formato ISO curto (YYYY-MM-DD),
 * usando os componentes UTC para evitar deslocamentos de fuso horário.
 *
 * @param {Date|string} value Data a formatar.
 * @returns {string} Data formatada, ou string vazia se inválida.
 */
const formatDateValue = (value) => {
  const date = value instanceof Date
    ? value
    : new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
};

/**
 * Formata um valor numérico como moeda localizada, com fallback manual caso
 * o código de moeda não seja suportado pelo Intl.NumberFormat.
 *
 * @param {*} value Valor a formatar.
 * @param {string} [currency='EUR'] Código ISO da moeda.
 * @returns {string} Valor formatado como moeda.
 */
const formatCurrency = (value, currency = 'EUR') => {
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
    }).format(toNumber(value));
  } catch {
    return `${currency} ${currencyValue(value)}`;
  }
};

/* ============================================================================
 * ANALYSIS WINDOW
 * ========================================================================== */

/**
 * Resolve a janela de análise com base em período ou intervalo de datas.
 *
 * @param {Object} [params={}] Parâmetros de análise.
 * @param {string} [params.period='weekly'] Período de referência para a janela.
 * @param {string|null} [params.from=null] Data inicial opcional da janela.
 * @param {string|null} [params.to=null] Data final opcional da janela.
 * @param {boolean} [params.historicalStock=false] Indica se a janela é usada para histórico de estoque.
 * @returns {{period: string, since: Date, until: Date, totalDays: number, forecastSince: Date, forecastUntil: Date, forecastTotalDays: number}} Objeto com a janela calculada.
 */
export const resolveAnalysisWindow = ({
  period = 'weekly',
  from = null,
  to = null,
  historicalStock = false,
} = {}) => {

  // "since/until" = período real escolhido pelo usuário. Só alimenta as
  // métricas de vendas (summary/trend/top products) — nunca o forecast.
  const { period: normalizedPeriod, since, until, totalDays } =
    resolvePeriodWindow({ period, from, to });

  // "forecastSince/forecastUntil" = SEMPRE 30 dias fixos.
  // - Ao vivo (dashboard/notificações/supplier orders/products): termina agora.
  // - Relatórios históricos: termina na data de referência do relatório (until).
  const { forecastSince, forecastUntil, forecastTotalDays } = historicalStock
    ? getForecastWindow(until)
    : getForecastWindow();

  return {
    period: normalizedPeriod,
    since,
    until,
    totalDays,
    forecastSince,
    forecastUntil,
    forecastTotalDays,
  };
};
/* ============================================================================
 * STOCK HELPERS
 * ========================================================================== */

export const calculateStockForecast = (params = {}) =>
  calculateStockAlertMetrics(params);

/**
 * Classifica stock risk.
 */
export const classifyStockRisk = (params = {}) =>
  classifyStockAlertRisk(params);

/**
 * Verifica se actionable forecast item.
 */
export const isActionableForecastItem = (item = {}) =>
  isActionableStockAlertItem(item);

/* ============================================================================
 * AI
 * ========================================================================== */

/**
 * Solicita uma resposta de IA com base nas estatísticas atuais.
 *
 * @param {string} question Pergunta do usuário a ser respondida.
 * @param {Object} stats Estatísticas agregadas para compor o contexto.
 * @returns {Promise<string|null>} Resposta gerada pela IA ou null se não for possível.
 */
const askAIForAnswer = async (question, stats) => {
  const promptContext = {
    ...stats,
    stockForecast: stats.stockForecast || [],
  };

  const result = await askAI(question, promptContext);

  return result.success
    ? result.answer
    : null;
};

/* ============================================================================
 * ANALYTICS
 * ========================================================================== */

/**
 * Calcula as estatísticas analíticas para o período informado.
 *
 * @param {Object} [params={}] Parâmetros de consulta.
 * @param {string} [params.period='weekly'] Período de análise.
 * @param {string|null} [params.from=null] Data inicial opcional.
 * @param {string|null} [params.to=null] Data final opcional.
 * @param {boolean} [params.historicalStock=false] Indica se deve incluir dados históricos de estoque.
 * @returns {Promise<Object>} Objeto com métricas de vendas, estoque e previsões.
 */
export const getAnalyticsStats = async ({
  period = 'weekly',
  from = null,
  to = null,
  historicalStock = false
} = {}) => {


const {
  since,
  until,
  forecastSince,
  forecastUntil,
  totalDays,
  forecastTotalDays,
  period: normalizedPeriod,
} = resolveAnalysisWindow({
  period,
  from,
  to,
  historicalStock
});

  const activeProducts = await dbQuery(`
      SELECT COUNT(*)::int AS total
      FROM products
      WHERE deleted_at IS NULL`);

  const hasSoftDelete =
    Number(activeProducts.rows[0]?.total || 0) > 0;

  const productFilter = hasSoftDelete? 'WHERE p.deleted_at IS NULL': '';

  const reservedStockExpr = `(SELECT COALESCE(SUM(ri.quantity),0)::int
          FROM reservation_items ri
          JOIN reservations r
          ON r.id = ri.reservation_id
          WHERE ri.product_id = p.id
          AND COALESCE(r.status,'') <> 'completed')`;
const currentQuantityExpr = `p.quantity`;

const historicalQuantityExpr  = historicalStock
  ? `
    (
      p.quantity

      + COALESCE((
          SELECT SUM(si.quantity)
          FROM sale_items si
          JOIN sales s
            ON s.id = si.sale_id
          WHERE si.product_id = p.id
            AND s.created_at > $2
      ),0)

      - COALESCE((
          SELECT SUM(soi.quantity)
          FROM supplier_order_items soi
          JOIN supplier_orders so
            ON so.id = soi.order_id
          WHERE soi.product_id = p.id
            AND so.status = 'completed'
            AND so.received_at > $2
      ),0)
    )
  `
  : `p.quantity`;

  const quantityExpr = historicalStock
    ? historicalQuantityExpr
    : currentQuantityExpr;

  const availableStockExpr = `
GREATEST(
  0,
  (${quantityExpr}) - (${reservedStockExpr})
)
`;
  const supplierLeadTimeExpr = `COALESCE(s.lead_time,0)`;

  // $1/$2 = [forecastSince, forecastUntil] — sempre a janela fixa de 30 dias
  // resolvida por getForecastWindow() (ver resolveAnalysisWindow acima).
  // days_to_stockout/average_daily_sales NÃO são calculados aqui em SQL:
  // isso é feito uma única vez em JS por computeForecastMetrics(), depois
  // que a linha volta do banco evitando ter a mesma fórmula duplicada em
  // SQL e em JS podendo divergir.
  const stockDataCTE = `
WITH stock_data AS (

SELECT

p.id,
p.name,
(${quantityExpr}) AS quantity,
p.min_level,
p.price_buy,
p.price_sell,

${reservedStockExpr} AS reserved_quantity,

${availableStockExpr} AS available_stock,

${supplierLeadTimeExpr} AS supplier_lead_time,

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
      AND so.status IN ('pending', 'completed', 'received')
      AND so.created_at BETWEEN $1 AND $2
), 0)::numeric AS purchased_period_30

FROM products p


LEFT JOIN suppliers s
ON s.id = p.supplier_id


${productFilter}

)
`;
const [
  companySettings,
  salesSummary,
  salesTrend,
  topProducts,
  topProfitProducts,
  stockForecastItems,
] = await Promise.all([
    

    /* =========================================================================
     * COMPANY SETTINGS 1
     * ========================================================================= */

    dbQuery(`
      SELECT
        company_name,
        currency,
        timezone,
        date_format,
        theme,
        reservation_enabled
      FROM settings
      ORDER BY id DESC
      LIMIT 1
    `),

    /* =========================================================================
     * SALES SUMMARY 2
     * ========================================================================= */

    dbQuery(
      `
      SELECT
        COUNT(*)::int                    AS sales_count,
        COALESCE(SUM(total),0)::numeric  AS total_sales,
        COALESCE(AVG(total),0)::numeric  AS average_ticket
      FROM sales
      WHERE created_at BETWEEN $1 AND $2
      `,
      [since, until]
    ),

    /* =========================================================================
     * SALES TREND 3
     * ========================================================================= */

    dbQuery(
      `
      WITH days AS (
          SELECT generate_series(
              $1::date,
              $2::date,
              interval '1 day'
          )::date AS day
      )
      SELECT
          to_char(days.day,'YYYY-MM-DD') AS date,
          COALESCE(SUM(s.total),0)::numeric AS total
      FROM days
      LEFT JOIN sales s
             ON s.created_at::date = days.day
      GROUP BY days.day
      ORDER BY days.day
      `,
      [since, until]
    ),

    /* =========================================================================
     * TOP SELLING PRODUCTS 4
     * ========================================================================= */

    dbQuery(
      `SELECT
      p.id,
      p.name,
      COALESCE(SUM(si.quantity),0)::numeric AS sold_quantity,
      COALESCE(SUM(si.quantity * si.unit_price),0)::numeric AS revenue
      FROM sale_items si
      JOIN sales s ON s.id=si.sale_id
      JOIN products p ON p.id=si.product_id
      WHERE s.created_at BETWEEN $1 AND $2
      GROUP BY p.id,p.name
      ORDER BY sold_quantity DESC
      LIMIT 5`,
      [since, until]
    ),

    /* =========================================================================
     * TOP PROFIT PRODUCTS 5
     * ========================================================================= */

    dbQuery(
      `
      SELECT
          p.id,
          p.name,

          COALESCE(SUM(si.quantity),0)::numeric AS sold_quantity,

          COALESCE(
              SUM(si.quantity*si.unit_price),
              0
          )::numeric AS revenue,

          COALESCE(
              SUM(si.quantity*COALESCE(p.price_buy,0)),
              0
          )::numeric AS cost

      FROM sale_items si

      JOIN sales s
           ON s.id=si.sale_id

      JOIN products p
           ON p.id=si.product_id

      WHERE s.created_at BETWEEN $1 AND $2

      GROUP BY
          p.id,
          p.name,
          p.price_buy

      ORDER BY(COALESCE(SUM(si.quantity * si.unit_price),0) -
      COALESCE(SUM(si.quantity * COALESCE(p.price_buy,0)),0)) DESC
      LIMIT 5`,
      [since, until]
    ),

/* =========================================================================
 * STOCK FORECAST 7
 * ========================================================================= */

  dbQuery(
`
${stockDataCTE}

SELECT *
FROM stock_data

`,
[forecastSince, forecastUntil]
),
  ]); 

  /* ==========================================================================
   * FORMAT TOP PRODUCTS
   * ========================================================================== */

  const topProductsRows = topProducts.rows.map((item) => ({
    ...item,
    sold_quantity: toNumber(item.sold_quantity),
    revenue: toNumber(item.revenue),
  }));

  /* ==========================================================================
   * FORMAT PROFIT PRODUCTS
   * ========================================================================== */

  const topProfitRows = topProfitProducts.rows.map((item) => {

    const revenue = toNumber(item.revenue);
    const cost = toNumber(item.cost);
    const grossProfit = revenue - cost;

    return {
      ...item,
      sold_quantity: toNumber(item.sold_quantity),
      revenue,
      cost,
      grossProfit,
      marginRate:
        cost > 0
          ? (grossProfit / cost) * 100
          : null,
    };

  });

  /* ==========================================================================
   * LOW STOCK FORECAST
   * ========================================================================== */

  const forecastRows = stockForecastItems.rows
    .map((item) => {

const forecast = computeForecastMetrics(item);

      return {

        ...item,

        quantity: forecast.quantity,
        reserved_quantity: forecast.reservedQuantity,

        min_level: forecast.minLevel,

        supplier_lead_time: forecast.supplierLeadTime,

        sold_period_30: forecast.sold_Period_30,
        purchased_period_30: forecast.purchased_Period_30,

        available_stock: forecast.availableStock,

        projected_stock: forecast.projectedStock,

        average_daily_sales: forecast.averageDailySales,

        days_to_stockout: forecast.daysToStockout,

        recommended_reorder: forecast.recommended_reorder,

        risk_level: forecast.riskLevel,

        lead_time_alert: forecast.leadTimeAlert,

      };
 
    })
    .sort((a, b) => {

      const rank = {
        out_of_stock: 0,
        critical: 1,
        low: 2,
        healthy: 3,
      };

      const rankA = rank[a.risk_level] ?? 99;
      const rankB = rank[b.risk_level] ?? 99;

      if (rankA !== rankB) {
        return rankA - rankB;
      }

      const daysA =
        a.days_to_stockout ??
        Number.POSITIVE_INFINITY;

      const daysB =
        b.days_to_stockout ??
        Number.POSITIVE_INFINITY;

      return daysA - daysB;

    });
/*console.log(
  '🟠 LOW STOCK PRODUCTS:',
  forecastRows.filter(item => item.risk_level === 'low')
);

console.log(
  '🔴 CRITICAL PRODUCTS:',
  forecastRows.filter(
    item =>
      item.risk_level === 'critical' ||
      item.risk_level === 'out_of_stock'
  )
);

console.log(
  '📦 ACTIONABLE PRODUCTS:',
  forecastRows.filter(isActionableForecastItem)
);

 */
  /* ==========================================================================
   * CRITICAL STOCK
   * ========================================================================== */

  const criticalAvailabilityRows =
 forecastRows.filter(item =>
    item.risk_level === 'critical' ||
    item.risk_level === 'out_of_stock'
  );

 /* ==========================================================================
 * STOCK STATUS
 * ========================================================================== */

const availabilityMap = forecastRows.reduce((acc, item) => {

  const status = item.risk_level;

  acc[status] = (acc[status] || 0) + 1;

  return acc;

}, {});


const availabilityRows = [
  'out_of_stock',
  'critical',
  'low',
  'healthy',
].map(status => ({
  status,
  total: availabilityMap[status] || 0,
}));

  /* ==========================================================================
   * ACTIONABLE FORECAST
   * ========================================================================== */

const actionableForecastRows =
  forecastRows.filter(item =>
    isActionableForecastItem(item) &&
    item.days_to_stockout != null
  );

  /* ==========================================================================
   * RETURN Do getAnalyticsStats
   * ========================================================================== */

  const result = {
  period: normalizedPeriod,

  companySettings: companySettings.rows[0] || null,

  since,
  until,

  forecastTotalDays,

  salesCount: Number(salesSummary.rows[0]?.sales_count ?? 0),

  totalSales: toNumber(salesSummary.rows[0]?.total_sales),

  averageTicket: toNumber(salesSummary.rows[0]?.average_ticket),

  salesTrend: salesTrend.rows.map(item => ({
    date: item.date,
    total: toNumber(item.total),
  })),

  topProducts: topProductsRows,

  topProfitProducts: topProfitRows,

  criticalAvailabilityItems: criticalAvailabilityRows,

  lowAvailabilityItems: actionableForecastRows,

  stockForecast: forecastRows,
  
  availabilityStatus: availabilityRows,

};

return result;
};
/* ============================================================================
 * SUMMARY
 * ========================================================================== */

export const generateSummaryText = (stats = {}) => {

  const periodLabel =
    stats.period === 'monthly'
      ? 'MONTHLY'
      : stats.period === 'yearly'
      ? 'YEARLY'
      : 'WEEKLY';

  const periodText =
    stats.period === 'monthly'
      ? 'month'
      : stats.period === 'yearly'
      ? 'year'
      : 'week';

  const currency =
    stats.companySettings?.currency || 'EUR';

  const topProduct =
    stats.topProducts?.[0];

  const bestProfit =
    stats.topProfitProducts?.[0];

  const criticalItems =
    Array.isArray(stats.criticalAvailabilityItems)
      ? stats.criticalAvailabilityItems
      : [];

  const forecastItems =
    (stats.stockForecast || []).filter(
      isActionableForecastItem
    );

  const salesLine =
    stats.salesCount === 0
      ? `📊 No sales registered during this ${periodText}.`
      : `📊 Sales recorded: ${stats.salesCount}`;

  return [

    `📈 ${periodLabel} SUMMARY`,

    salesLine,

    `💵 Total revenue: ${formatCurrency(stats.totalSales, currency)}`,

    `🧾 Average ticket: ${formatCurrency(stats.averageTicket, currency)}`,

    topProduct
      ? `🏆 Top-selling product: ${topProduct.name} (${currencyValue(topProduct.sold_quantity)} units)`
      : '🏆 Top-selling product: No sales.',

    bestProfit
      ? `💹 Most profitable: ${bestProfit.name} (${formatCurrency(bestProfit.grossProfit, currency)})`
      : '💹 Profit data Unavailable.',

    criticalItems.length
      ? `⚠️ Critical stock alerts: ${criticalItems.length}`
      : '✅ No critical stock alerts.',

    forecastItems.length
      ? `📦 Low stock forecast: ${forecastItems.length} product(s)`
      : '✅ No stock forecast alerts.'

  ].join('\n');

};

/* ============================================================================
 * DETAILED REPORT
 * ========================================================================== */

export const generateDetailedText = async (stats = {}) => {

  const currency =
    stats.companySettings?.currency || 'EUR';

  const topSelling =
    (stats.topProducts || []).length
      ? stats.topProducts
          .map((item, index) =>
            `${index + 1}. ${item.name} — ${currencyValue(item.sold_quantity)} units (${formatCurrency(item.revenue, currency)})`
          )
          .join('\n')
      : 'No sales recorded.';

  const profitable =
    (stats.topProfitProducts || []).length
      ? stats.topProfitProducts
          .map((item, index) => {

            const margin =
              item.marginRate == null
                ? 'n/a'
                : `${item.marginRate.toFixed(1)}%`;

            return `${index + 1}. ${item.name} — Profit ${formatCurrency(item.grossProfit, currency)} | Margin ${margin}`;

          })
          .join('\n')
      : 'No profitability information available.';

  const critical =
    (stats.criticalAvailabilityItems || []).length
      ? stats.criticalAvailabilityItems
          .map(item =>
            `🔴 ${item.name} — Available ${item.available_stock}/${item.min_level}`
          )
          .join('\n')
      : 'No critical products.';

  const forecast =
    (stats.stockForecast || []).filter(isActionableForecastItem).length
      ? stats.stockForecast
          .filter(isActionableForecastItem)
          .map(item => {

            const badge =
              item.risk_level === 'out_of_stock'
                ? '⛔'
                : item.risk_level === 'critical'
                ? '🔴'
                : item.risk_level === 'low'
                ? '🟠'
                : '🟢';

            return `${badge} ${item.name}
Available: ${item.available_stock}
Projected(7 days): ${item.projected_stock.toFixed(0)}
Days to stockout: ${
              item.days_to_stockout == null
                ? 'N/A'
                : item.days_to_stockout.toFixed(1)
            }
Recommended reorder: ${item.recommended_reorder}`;

          })
          .join('\n\n')
      : 'No forecast alerts.';

  const trend =
    (stats.salesTrend || []).length
      ? stats.salesTrend
          .map(item =>
            `${item.date} - ${formatCurrency(item.total, currency)}`
          )
          .join('\n')
      : 'No trend information.';

  return [

    `📈 ${stats.period.toUpperCase()} ANALYTICS REPORT`,
    `📅 ${formatDateValue(stats.since)} → ${formatDateValue(stats.until)}`,
    '',
    '🏆 TOP SELLING',
    topSelling,
    '',
    '💹 MOST PROFITABLE',
    profitable,
    '',
    '⚠️ CRITICAL STOCK',
    critical,
    '',
    '📦 LOW STOCK FORECAST',
    forecast,
    '',
    '📈 SALES TREND',
    trend,
    '',
    '💡 RECOMMENDATION',
    await generateAIRecommendation(stats),

  ].join('\n');

};

/**
 * Gera uma recomendação em texto livre através do assistente de IA, com
 * base nas estatísticas já calculadas. Em caso de falha da IA, recorre a
 * uma recomendação determinística simples como fallback.
 *
 * @param {Object} stats Estatísticas de negócio (vendas, stock, previsão).
 * @returns {Promise<string>} Recomendação gerada.
 */
const generateAIRecommendation = async (stats = {}) => {
  const forecastItems = (stats.stockForecast || []).filter(isActionableForecastItem);

  try {
    const result = await generateReportRecommendation(forecastItems);
    if (result.success && result.answer) {
      return result.answer;
    }
  } catch (error) {
    console.warn('[analytics] Unable to generate AI recommendation, using fallback:', error?.message || error);
  }

  return forecastItems.length
    ? 'Replenishment is recommended for products at risk.'
    : 'Inventory levels are healthy.';
};

// ==========================================================
// BUILDS STOCK ANALYSIS RESPONSE
// ==========================================================

/**
 * Monta uma resposta textual estruturada (fallback local, sem IA externa)
 * descrevendo um grupo de produtos com problema de stock, incluindo
 * disponibilidade, previsão e recomendações de ação.
 *
 * @param {string} title Título/cabeçalho da análise (ex.: número de produtos afetados).
 * @param {Object[]} products Lista de produtos com métricas de forecast já calculadas.
 * @returns {string} Texto formatado pronto para apresentar ao usuário.
 */
function buildStockResponse(title, products) {
  const productList = products
    .map(product => {
      const days =
        product.days_to_stockout == null
          ? 'N/A'
          : product.days_to_stockout.toFixed(1);

      return `- ${product.name}
  Available stock: ${product.available_stock}
  Average daily sales: ${Number(product.average_daily_sales || 0).toFixed(2)}
  Days to stockout: ${days}
  Recommended reorder: ${product.recommended_reorder}`;
    })
    .join('\n\n');

  return `${title}

Affected products:

${productList}

Current status:
- ${products.length} product(s) require immediate attention.
- Current inventory levels increase the risk of stock shortages.
- Continuous monitoring is recommended until stock levels recover.

Risk assessment:
- Products with low inventory may become unavailable.
- Stockouts can lead to lost sales and lower customer satisfaction.
- Delayed replenishment may negatively affect future revenue.

Recommended actions:
- Place replenishment orders as soon as possible.
- Prioritize products with the lowest Days to Stockout.
- Review supplier lead times and delivery schedules.
- Increase reorder quantities if demand remains consistent.
- Monitor inventory daily until stock returns to healthy levels.

Business impact:
Maintaining healthy inventory levels helps prevent lost revenue, improves customer satisfaction, and supports uninterrupted business operations.`;
  }
// ==========================
// STOCK BUSINESS QUESTIONS
// ==========================
/**
 * Executa a operação answer business question.
 */
export const answerBusinessQuestion = async (question, stats) => {
  const normalized = String(question || '').toLowerCase();

  const outOfStockItems = stats.stockForecast.filter(
    p => p.risk_level === 'out_of_stock'
  );

  const criticalItems = stats.stockForecast.filter(
    p => p.risk_level === 'critical' 
  );

  const lowItems = stats.stockForecast.filter(
    p => p.risk_level === 'low'
  );
if (keywordMatch(normalized, ['stock', 'inventory', 'estoque'])) {

  if (outOfStockItems.length) {
    return {
      type: 'stock',
      answer: buildStockResponse(
        `Inventory analysis detected ${outOfStockItems.length} out-of-stock product(s).`,
        outOfStockItems
      ),
    };
  }

  if (criticalItems.length) {
    return {
      type: 'stock',
      answer: buildStockResponse(
        `Inventory analysis detected ${criticalItems.length} critical stock product(s).`,
        criticalItems
      ),
    };
  }

  if (lowItems.length) {
    return {
      type: 'stock',
      answer: buildStockResponse(
        `Inventory analysis detected ${lowItems.length} low stock product(s).`,
        lowItems
      ),
    };
  }

  return {
    type: 'stock',
    answer:
`Inventory analysis completed.

Current status:
- All products currently have healthy stock levels.
- No products require immediate replenishment.

Business impact:
Current inventory levels are sufficient to support expected demand.`,
  };
}

  // Pergunta não menciona stock/inventário: devolve uma resposta genérica em
  // vez de undefined, para não rebentar o código que lê `heuristic.answer`
  return {
    type: 'general',
    answer: 'I do not have enough specific data to answer that question in detail right now. Try asking about stock levels, top-selling products, or profit to get a data-driven answer.',
  };
}
/* ============================================================================
 * AI INSIGHTS
 * ========================================================================== */

export const persistInsight = async ({
  type,
  question = null,
  answer,
  relatedEntity = null,
  relatedEntityId = null,
  userId = null,
}) => {

  const result = await dbQuery(
    `INSERT INTO ai_insights
      (
        type,
        question,
        answer,
        related_entity,
        related_entity_id,
        user_id,
        created_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,NOW())
      RETURNING *`,
    [
      type,
      question,
      answer,
      relatedEntity,
      relatedEntityId,
      userId,
    ]
  );

  return result.rows[0];

};

/**
 * Retorna recent insights. Quando `userId` é indicado, devolve apenas o
 * histórico de chat de IA desse utilizador (cada conta só vê as suas
 * próprias perguntas/respostas).
 */
export const getRecentInsights = async (
  limit = 5,
  userId = null
) => {

  const result = userId
    ? await dbQuery(
        `SELECT *
          FROM ai_insights
          WHERE user_id = $2
          ORDER BY created_at DESC
          LIMIT $1`,
        [limit, userId]
      )
    : await dbQuery(
        `SELECT *
          FROM ai_insights
          ORDER BY created_at DESC
          LIMIT $1`,
        [limit]
      );

  return result.rows;

};