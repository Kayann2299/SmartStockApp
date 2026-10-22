/**
 * Gera descrições resumidas para itens de venda e reserva.
 * @module utils/recordDescriptions
 */
export const summarizeLineItems = (items = [], maxNames = 3) => {
  const normalized = Array.isArray(items)
    ? items
        .map((item) => {
          const name = item?.name || item?.product_name || item?.productName || 'Item';
          const quantity = Number(item?.quantity ?? 1);
          return `${quantity} x ${name}`;
        })
        .filter(Boolean)
    : [];

  if (normalized.length === 0) {
    return 'No items';
  }

  const preview = normalized.slice(0, maxNames);
  const extra = normalized.length - preview.length;
  return extra > 0 ? `${preview.join(', ')} +${extra} more` : preview.join(', ');
};

/**
 * Executa a operação summarize stock items.
 */
export const summarizeStockItems = (items = [], maxNames = 3) => {
  const normalized = Array.isArray(items)
    ? items
        .map((item) => {
          const name = item?.name || item?.product_name || 'Product';
          const quantity = Number(item?.quantity ?? 0);
          return `${name} (${quantity})`;
        })
        .filter(Boolean)
    : [];

  if (normalized.length === 0) {
    return 'No critical stock items';
  }

  const preview = normalized.slice(0, maxNames);
  const extra = normalized.length - preview.length;
  return extra > 0 ? `${preview.join(', ')} +${extra} more` : preview.join(', ');
};

/**
 * Constrói sale description.
 */
export const buildSaleDescription = ({
  items = [],
  paymentMethod = 'cash',
  sourceReservationId = null,
  customDescription = ''
}) => {
  const cleanDescription = String(customDescription || '').trim();
  if (cleanDescription) return cleanDescription;

  const prefix = sourceReservationId ? `Reservation transfer #${sourceReservationId}` : `${paymentMethod} sale`;
  return `${prefix}: ${summarizeLineItems(items)}`;
};

/**
 * Constrói reservation description.
 */
export const buildReservationDescription = ({
  items = [],
  customerName = '',
  customDescription = ''
}) => {
  const cleanDescription = String(customDescription || '').trim();
  if (cleanDescription) return cleanDescription;

  const prefix = customerName ? `Reservation for ${customerName}` : 'Reservation';
  return `${prefix}: ${summarizeLineItems(items)}`;
};
