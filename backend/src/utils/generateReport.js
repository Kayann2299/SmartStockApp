/**
 * Gera conteúdo textual de relatórios com métricas de vendas e estoque.
 * @module utils/generateReport
 */
const formatCurrency = (value) => `${Number(value || 0).toFixed(2)} €`;

/**
 * Gera report text.
 */
export const generateReportText = ({ salesCount, totalSales, averageTicket, topProducts = [], lowAvailabilityItems = [], salesTrend = [], period = 'weekly' }) => {
  const periodLabel = period === 'monthly' ? 'monthly' : 'weekly';
  const performanceSignal = Number(totalSales || 0) > 0 ? '💰 Profit' : '📉 Loss';
  const stockSignal = lowAvailabilityItems.length ? '⚠️ Critical stock' : '✅ Healthy stock';

  const topProductList = topProducts.length
    ? topProducts.map((item) => `- ${item.name}: ${item.sold_quantity} units`).join('\n')
    : 'No top-performing products were recorded in this period.';

  const lowAvailabilityList = lowAvailabilityItems.length
    ? lowAvailabilityItems.map((item) => `- ${item.name}: ${item.quantity}/${item.reserved_quantity} available`).join('\n')
    : 'No products are currently below the minimum level.';

  const trendList = salesTrend.length
    ? salesTrend.map((item) => `- ${item.date}: ${formatCurrency(item.total)}`).join('\n')
    : 'No sales trend data is available yet.';

  return [
    `📈 ${periodLabel.toUpperCase()} REPORT`,
    `📊 Sales recorded: ${salesCount}`,
    `💵 Total revenue: ${formatCurrency(totalSales)}`,
    `🧾 Average ticket: ${formatCurrency(averageTicket)}`,
    `📌 ${performanceSignal}`,
    `🛒 ${stockSignal}`,
    '',
    '🏆 Top products:',
    topProductList,
    '',
    '⚠️ Critical stock products:',
    lowAvailabilityList,
    '',
    '📈 Trend:',
    trendList
  ].join('\n');
};
