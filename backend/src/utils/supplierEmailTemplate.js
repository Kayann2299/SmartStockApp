/**
 * Monta templates de e-mail para pedidos de fornecedores e alertas de estoque.
 * @module utils/supplierEmailTemplate
 */
import { renderEmailTemplate } from './emailTemplateRenderer.js';

/**
 * Escapa caracteres HTML especiais antes de inserir valores (ex.: nomes de
 * produtos) dentro do corpo HTML de um email. Sem isto, um nome de produto
 * que contenha por acaso marcação HTML (por exemplo colado de um Word/Docs,
 * ou com um "<" ou ">" perdido) é interpretado como HTML real em vez de
 * texto — podendo, entre outras coisas, fazer esse produto aparecer
 * formatado como citação/bloco (<blockquote>) em vez de aparecer como texto normal.
 */
const escapeHtml = (value = '') => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const defaultSupplierOrderTemplate = {
  subject: 'Purchase order - {{company_name}} - {{date}} - {{po_number}}',
  body: `<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; color: #222; line-height: 1.6;">
    <h2 style="margin: 0 0 12px; font-size: 1.25rem; color: #111;">Purchase order - {{company_name}} - {{date}} - {{po_number}}</h2>
    <p>Dear {{supplier_name}},</p>
    <p>Please find below our purchase order details:</p>
    <p>Company: {{company_name}}<br/>
    Address: {{company_address}}<br/>
    Contact Email: {{contact_email}}<br/>
    Contact Phone: {{contact_phone}}<br/>
    VAT Number: {{company_vat}}<br/>
    Date: {{date}}<br/>
    Purchase Order No: {{po_number}}</p>
    <h3 style="margin: 16px 0 8px;">Order details</h3>
    <div style="margin-bottom: 12px;">
      {{#each items}}<div style="margin-bottom: 10px;">{{name}}<br/>Reference: {{ref}}<br/>Quantity: {{quantity}}<br/>Unit Price: €{{unit_price}}<br/>Subtotal: €{{subtotal}}</div>{{/each}}
    </div>
    <p>Subtotal: €{{subtotal_total}}<br/>
    VAT ({{vat_rate}}%): €{{vat_amount}}<br/>
    TOTAL: €{{total_amount}}</p>
    <p>Delivery deadline: {{delivery_date}}<br/>
    Payment terms: {{payment_terms}}<br/>
    Partial delivery: {{partial_delivery}}</p>
    <p>Please confirm receipt of this order.</p>
    <p>Kind regards,<br/>{{company_name}}</p>
  </body>
</html>`
};

/**
 * Executa a operação availability alert template.
 */
export const availabilityAlertTemplate = ({ items = [] }) => {
  const rows = items
    .map((item) => `<li><strong>${escapeHtml(item.name)}</strong> — ${escapeHtml(item.quantity)} in stock (reserved ${escapeHtml(item.reserved_quantity)})</li>`)
    .join('');

  return `
    <h2>Stock alert</h2>
    <p>The following products are running low:</p>
    <ul>${rows}</ul>
  `;
};

/**
 * Constrói o template de email do alerta semanal de stock, com secções
 * separadas para produtos em "low stock" e produtos em "critical stock".
 */
export const weeklyStockAlertTemplate = ({ lowStockItems = [], criticalStockItems = [], companyName = '' } = {}) => {
  const renderRow = (item) =>
    `<li><strong>${escapeHtml(item.name)}</strong> — ${escapeHtml(item.available_stock)} available (min. level ${escapeHtml(item.min_level)})</li>`;

  const criticalSection = criticalStockItems.length
    ? `<h3 style="color:#b91c1c;margin:16px 0 8px;">Critical stock (${criticalStockItems.length})</h3><ul>${criticalStockItems.map(renderRow).join('')}</ul>`
    : `<p style="color:#666;">No products in critical stock. 🎉</p>`;

  const lowSection = lowStockItems.length
    ? `<h3 style="color:#b45309;margin:16px 0 8px;">Low stock (${lowStockItems.length})</h3><ul>${lowStockItems.map(renderRow).join('')}</ul>`
    : `<p style="color:#666;">No products in low stock.</p>`;

  return `
    <h2>Weekly stock alert${companyName ? ` - ${escapeHtml(companyName)}` : ''}</h2>
    <p>Here is this week's stock summary.</p>
    ${criticalSection}
    ${lowSection}
  `;
};

/**
 * Constrói supplier order email template.
 */
export const buildSupplierOrderEmailTemplate = ({ template, companyDetails = {}, templateData = {}, fallbackSubject = '', fallbackBody = '', orderNumber, supplierName, ...rest }) => {
  const normalizedTemplateData = {
    ...(templateData || {}),
    ...(rest || {}),
    supplier_name: templateData?.supplier_name || supplierName || rest?.supplier_name || '',
    company_name: companyDetails.companyName || templateData?.company_name || rest?.company_name || '',
    company_address: companyDetails.deliveryAddress || templateData?.company_address || rest?.company_address || '',
    contact_email: companyDetails.contactEmail || templateData?.contact_email || rest?.contact_email || '',
    contact_phone: companyDetails.contactPhone || templateData?.contact_phone || rest?.contact_phone || '',
    company_vat: companyDetails.companyVat || templateData?.company_vat || rest?.company_vat || '',
    po_number: templateData?.po_number || orderNumber || rest?.po_number || rest?.orderNumber || '',
    orderNumber: templateData?.orderNumber || orderNumber || rest?.orderNumber || templateData?.po_number || rest?.po_number || '',
    contact: [companyDetails.contactEmail || templateData?.contact_email || rest?.contact_email, companyDetails.contactPhone || templateData?.contact_phone || rest?.contact_phone].filter(Boolean).join(' / '),
  };

  const data = {
    ...normalizedTemplateData,
    ...companyDetails,
  };

  const resolvedSubject = renderEmailTemplate(template?.subject || fallbackSubject || defaultSupplierOrderTemplate.subject, data);
  const resolvedBody = renderEmailTemplate(template?.body || fallbackBody || defaultSupplierOrderTemplate.body, data);

  return {
    subject: resolvedSubject || fallbackSubject || defaultSupplierOrderTemplate.subject,
    html: resolvedBody || fallbackBody || defaultSupplierOrderTemplate.body,
    text: resolvedBody || fallbackBody || defaultSupplierOrderTemplate.body
  };
};

/**
 * Executa a operação supplier order template.
 */
export const supplierOrderTemplate = ({ supplierName, items = [], notes = '', companyDetails = {} }) => {
  const rows = items
    .map((item) => `<li><strong>${escapeHtml(item.product_name || item.name)}</strong> — ${escapeHtml(item.quantity)}</li>`)
    .join('');

  return `
    <h2>Purchase order for ${escapeHtml(supplierName)}</h2>
    <p>The following items were requested:</p>
    <ul>${rows}</ul>
    <p><strong>Company:</strong> ${escapeHtml(companyDetails.companyName || '')}</p>
    <p><strong>Address:</strong> ${escapeHtml(companyDetails.deliveryAddress || '')}</p>
    <p><strong>Contact Email:</strong> ${escapeHtml(companyDetails.contactEmail || '')}</p>
    <p><strong>Contact Phone:</strong> ${escapeHtml(companyDetails.contactPhone || '')}</p>
    ${notes ? `<p><strong>Notes:</strong> ${escapeHtml(notes)}</p>` : ''}
  `;
};

/**
 * Alias de {@link availabilityAlertTemplate}, mantido por compatibilidade de nome.
 */
export const stockAlertTemplate = availabilityAlertTemplate;
/**
 * Executa a operação report template.
 */
export const reportTemplate = ({ title, content }) => `
  <h2>${title}</h2>
  <pre style="white-space:pre-wrap;font-family:inherit;">${content}</pre>
`;
