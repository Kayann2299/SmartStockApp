import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSupplierOrderEmailTemplate } from '../src/utils/supplierEmailTemplate.js';

test('builds supplier purchase-order email content from template placeholders and company contact details', () => {
  const result = buildSupplierOrderEmailTemplate({
    template: {
      subject: 'Purchase Order {{po_number}} - {{company_name}}',
      body: 'Contact Email: {{contact_email}}\nContact Phone: {{contact_phone}}\nCompany Address: {{company_address}}'
    },
    companyDetails: {
      companyName: 'SmartStock LTDA',
      deliveryAddress: 'Rua da Empresa, 123',
      contactEmail: 'contato@smartstock.com',
      contactPhone: '+351 912 000 111',
      companyVat: 'PT123456789'
    },
    supplierName: 'ACME Supplies',
    orderNumber: 'PO-2026-001',
    items: [],
    notes: '',
    date: '01/01/2026',
    deliveryDate: '08/01/2026',
    paymentTerms: 'Net 30',
    partialDelivery: 'Allowed',
    vatRate: 23,
    fallbackSubject: 'Purchase order - ACME Supplies',
    fallbackBody: 'Fallback body'
  });

  assert.equal(result.subject, 'Purchase Order PO-2026-001 - SmartStock LTDA');
  assert.match(result.html, /Contact Email: contato@smartstock\.com/);
  assert.match(result.html, /Contact Phone: \+351 912 000 111/);
  assert.match(result.html, /Company Address: Rua da Empresa, 123/);
});
