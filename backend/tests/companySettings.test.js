import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCompanySettingsPayload, resolvePurchaseOrderCompanyDetails } from '../src/utils/companySettings.js';

test('normalizes frontend company settings into backend fields', () => {
  const payload = normalizeCompanySettingsPayload({
    companyName: 'SmartStock LTDA',
    companyAddress: 'Rua da Empresa, 123',
    companyEmail: 'contato@smartstock.com',
    companyPhone: '+351 912 000 111',
    company_vat: 'PT123456789',
    currency: 'EUR',
    timezone: 'Europe/Lisbon',
    dateFormat: 'dd/MM/yyyy'
  });

  assert.equal(payload.company_name, 'SmartStock LTDA');
  assert.equal(payload.company_address, 'Rua da Empresa, 123');
  assert.equal(payload.company_email, 'contato@smartstock.com');
  assert.equal(payload.company_phone, '+351 912 000 111');
  assert.equal(payload.company_vat, 'PT123456789');
  assert.equal(payload.currency, 'EUR');
  assert.equal(payload.timezone, 'Europe/Lisbon');
  assert.equal(payload.date_format, 'dd/MM/yyyy');
});

test('prefers company settings from the database and falls back to env values', () => {
  const result = resolvePurchaseOrderCompanyDetails(
    {
      company_name: 'SmartStock LTDA',
      company_address: 'Rua da Empresa, 123',
      company_email: 'contato@smartstock.com',
      company_phone: '+351 912 000 111',
      company_vat: 'PT123456789'
    },
    {
      COMPANY_ADDRESS: 'Fallback address',
      COMPANY_EMAIL: 'fallback@smartstock.com',
      COMPANY_PHONE: '+351 999 999 999'
    }
  );

  assert.equal(result.companyName, 'SmartStock LTDA');
  assert.equal(result.deliveryAddress, 'Rua da Empresa, 123');
  assert.equal(result.contactEmail, 'contato@smartstock.com');
  assert.equal(result.contactPhone, '+351 912 000 111');
  assert.equal(result.companyVat, 'PT123456789');
});
