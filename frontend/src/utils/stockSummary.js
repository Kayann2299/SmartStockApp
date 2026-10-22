/**
 * Resume itens com estoque baixo para exibição na interface.
 * @module utils/stockSummary
 */
export const summarizeLowStockItems = (items = [], maxNames = 3) => {
  const normalized = Array.isArray(items)
    ? items
        .map((item) => {
          const name = item?.name || item?.product_name || 'Product';
          const quantity = Number(item?.quantity ?? 0);
          return `${name} (${quantity})`;
        })
        .filter(Boolean)
    : [];

  if (normalized.length === 0) return 'No critical stock items';

  const preview = normalized.slice(0, maxNames);
  const extra = normalized.length - preview.length;
  return extra > 0 ? `${preview.join(', ')} +${extra} more` : preview.join(', ');
};
