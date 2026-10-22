/**
 * Monta conteúdos de e-mail para confirmações e notificações de reservas.
 * @module utils/reservationEmail
 */
/**
 * Escapa caracteres HTML especiais (&, <, >, ") para inserção segura de
 * texto dentro de um corpo de email em HTML.
 *
 * @param {string} [value=''] Texto a escapar.
 * @returns {string} Texto com os caracteres especiais escapados.
 */
const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/**
 * Monta uma lista HTML (`<li>`) com os nomes dos itens de uma reserva,
 * escapando cada nome e mostrando uma mensagem padrão quando vazia.
 *
 * @param {Object[]} [items=[]] Itens da reserva.
 * @returns {string} Marcação HTML com os itens em `<li>`.
 */
const buildListHtml = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    return '<li>No items listed.</li>';
  }

  return items.map((item) => `<li>${escapeHtml(item.name || item.product_name || 'Item')}</li>`).join('');
};

/**
 * Constrói compact reference code.
 */
export const buildCompactReferenceCode = (value = '', prefix = 'R') => {
  const raw = String(value || '').trim();
  if (!raw) return `${prefix}-0000`;

  const parts = raw.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  const lastPart = parts.at(-1) || raw;
  const compact = lastPart.replace(/[^A-Z0-9]/gi, '').slice(0, 6).toUpperCase();
  return compact ? `${prefix}-${compact}` : `${prefix}-0000`;
};

/**
 * Constrói reservation email content.
 */
export const buildReservationEmailContent = ({
  type = 'ready',
  customerName = 'customer',
  companyName = 'SmartStock',
  companyAddress = '',
  reservationCode = '',
  items = [],
  storeName = '',
  storeAddress = '',
  pickupDeadline = '',
  sentDate = ''
}) => {
  const safeCustomerName = escapeHtml(customerName);
  const safeCompanyName = escapeHtml(companyName);
  const safeStoreName = escapeHtml(companyName); 
  const safeStoreAddress = escapeHtml(companyAddress); 
  const compactReservationCode = buildCompactReferenceCode(reservationCode, 'R');
  const safeReservationCode = escapeHtml(compactReservationCode);
  const safePickupDeadline = escapeHtml(pickupDeadline);
  const resolvedSentDate = sentDate || new Date().toLocaleDateString();
  const safeSentDate = escapeHtml(resolvedSentDate);

  if (type === 'confirmation') {
    const subject = `Reservation confirmation - ${safeCompanyName} - ${safeSentDate} - ${safeReservationCode}`;
    const text = `Hello ${customerName},\n\nYour reservation has been created successfully.\n\nReservation Code: ${reservationCode}\nItems:\n${items.map((item) => `- ${item.name || item.product_name || 'Item'}`).join('\n')}\n\nPickup location: ${storeName} - ${storeAddress}\nPickup deadline: ${pickupDeadline}\n\nBest regards,\n${companyName} Team`;
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222;">
        <h2 style="margin-bottom: 8px;">Reservation Confirmation - ${safeCompanyName} - ${safeSentDate}</h2>
        <p>Hello ${safeCustomerName},</p>
        <p>Your reservation has been created successfully.</p>
        <p>Reservation Code: ${safeReservationCode}</p>
        <p>Items:</p>
        <ul>${buildListHtml(items)}</ul>
        <p>Pickup location: ${safeStoreName} - ${safeStoreAddress}</p>
        <p>Pickup deadline: ${safePickupDeadline}</p>
        <p>Best regards,<br />${safeCompanyName} Team</p>
      </div>
    `;
    return { subject, text, html };
  }

  const subject = `Reservation ready - ${safeCompanyName} - ${safeSentDate} - ${safeReservationCode}`;
  const text = `Hello ${customerName},\n\nGreat news! Your reservation is now READY for pickup.\n\nReservation Code: ${reservationCode}\nItems:\n${items.map((item) => `- ${item.name || item.product_name || 'Item'}`).join('\n')}\n\nPickup location: ${storeName} - ${storeAddress}\nPickup deadline: ${pickupDeadline}\n\nBest regards,\n${companyName} Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222;">
      <h2 style="margin-bottom: 8px;">Reservation Ready - ${safeCompanyName} - ${safeSentDate}</h2>
      <p>Hello ${safeCustomerName}</p>
      <p>Great news! Your reservation is now READY for pickup.</p>
      <p>Reservation Code: ${safeReservationCode}</p>
      <p>Items:</p>
      <ul>${buildListHtml(items)}</ul>
      <p>Pickup location: ${safeStoreName} - ${safeStoreAddress}</p>
      <p>Pickup deadline: ${safePickupDeadline}</p>
      <p>Best regards,<br />${safeCompanyName} Team</p>
    </div>
  `;

  return { subject, text, html };
};
