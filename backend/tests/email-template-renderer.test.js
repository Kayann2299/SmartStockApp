import test from 'node:test';
import assert from 'node:assert/strict';
import { renderEmailTemplate } from '../src/utils/emailTemplateRenderer.js';
import { renderEmailTemplateBody } from '../src/config/mail.js';
import { buildReservationEmailContent } from '../src/utils/reservationEmail.js';
import { buildSupplierOrderEmailTemplate } from '../src/utils/supplierEmailTemplate.js';

test('renders loop and placeholder values in email templates', () => {
  const template = 'Hello {{customer_name}}\n\nItems:\n{{#each items}}- {{name}} (Qty: {{quantity}})\n{{/each}}\n\nRegards, {{company_name}}';
  const rendered = renderEmailTemplate(template, {
    customer_name: 'Ana',
    company_name: 'SmartStock',
    items: [
      { name: 'Mouse', quantity: 2 },
      { name: 'Keyboard', quantity: 1 }
    ]
  });

  assert.match(rendered, /Hello Ana/);
  assert.match(rendered, /Mouse/);
  assert.match(rendered, /Keyboard/);
  assert.match(rendered, /SmartStock/);
});

test('preserves blank lines and spacing when rendering templates', () => {
  const template = 'Hello {{customer_name}}\n\n\nItems:\n\n{{#each items}}- {{name}}\n{{/each}}\n\nRegards, {{company_name}}';
  const rendered = renderEmailTemplate(template, {
    customer_name: 'Ana',
    company_name: 'SmartStock',
    items: [{ name: 'Mouse' }]
  });

  assert.match(rendered, /Hello Ana\n\n\nItems:/);
  assert.match(rendered, /\n\nRegards, SmartStock/);
});

test('renders plain-text body content without collapsing blank lines', () => {
  const result = renderEmailTemplateBody({
    subject: 'Hello {{customer_name}}',
    body: 'Hello {{customer_name}}\n\n\nRegards,\n{{company_name}}',
    data: { customer_name: 'Ana', company_name: 'SmartStock' }
  });

  assert.equal(result.subject, 'Hello Ana');
  assert.equal(result.text, 'Hello Ana\n\n\nRegards,\nSmartStock');
  assert.match(result.html, /Hello Ana<br \/><br \/><br \/>Regards,<br \/>SmartStock/);
  assert.match(result.html, /white-space: pre-wrap/);
});

test('creates a readable text version for HTML email templates', () => {
  const result = renderEmailTemplateBody({
    subject: 'Purchase order - {{company_name}}',
    body: '<p>Dear {{supplier_name}},</p><p>Please find below our purchase order details:</p><p><strong>Company:</strong> {{company_name}}</p>',
    data: { supplier_name: 'Porto Editora', company_name: 'SmartStock' }
  });

  assert.match(result.html, /<p>/);
  assert.match(result.text, /Dear Porto Editora,/);
  assert.match(result.text, /Please find below our purchase order details:/);
  assert.match(result.text, /Company:/);
  assert.doesNotMatch(result.text, /<p>/);
  assert.match(result.text, /\n/);
});

test('renders line breaks explicitly for plain-text email bodies', () => {
  const result = renderEmailTemplateBody({
    subject: 'Reservation ready',
    body: 'Hello {{customer_name}}\n\nYour reservation is ready.\nPlease collect it soon.',
    data: { customer_name: 'Ana' }
  });

  assert.match(result.html, /<br\s*\/?>/i);
  assert.match(result.text, /Hello Ana\n\nYour reservation is ready\.\nPlease collect it soon\./);
});

test('reservation fallback emails include the company name and send date in the title', () => {
  const result = buildReservationEmailContent({
    type: 'confirmation',
    customerName: 'Ana',
    companyName: 'SmartStock',
    reservationCode: 'R-1234',
    items: [{ name: 'Book' }],
    storeName: 'Main Store',
    storeAddress: 'Main Street',
    pickupDeadline: '10/07/2026',
    sentDate: '01/07/2026'
  });

  assert.match(result.subject, /SmartStock/);
  assert.match(result.subject, /01\/07\/2026/);
  assert.match(result.html, /SmartStock/);
  assert.match(result.html, /01\/07\/2026/);
});

test('supplier order templates include the company name and send date in the title', () => {
  const result = buildSupplierOrderEmailTemplate({
    template: {
      subject: 'Purchase order - {{company_name}} - {{date}}',
      body: '<h2>Purchase order - {{company_name}} - {{date}}</h2><p>Dear {{supplier_name}},</p>'
    },
    companyDetails: { companyName: 'SmartStock' },
    templateData: { supplier_name: 'Texto Editores, Lda.', date: '01/07/2026' }
  });

  assert.match(result.subject, /SmartStock/);
  assert.match(result.subject, /01\/07\/2026/);
  assert.match(result.html, /SmartStock/);
  assert.match(result.html, /01\/07\/2026/);
});
