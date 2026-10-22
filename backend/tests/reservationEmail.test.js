import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReservationEmailContent, buildCompactReferenceCode } from '../src/utils/reservationEmail.js';

test('buildReservationEmailContent formats ready emails as HTML and text', () => {
  const result = buildReservationEmailContent({
    type: 'ready',
    customerName: 'Ana',
    companyName: 'SmartStock',
    reservationCode: 'R-100',
    items: [{ name: 'Pencil' }, { name: 'Notebook' }],
    storeName: 'Main Store',
    storeAddress: 'Rua das Flores',
    pickupDeadline: '01/07/2026'
  });

  assert.match(result.subject, /Reservation ready/i);
  assert.match(result.text, /READY/i);
  assert.match(result.html, /<strong>READY<\/strong>/i);
  assert.match(result.html, /<ul>/i);
});

test('buildReservationEmailContent includes a confirmation message for new reservations', () => {
  const result = buildReservationEmailContent({
    type: 'confirmation',
    customerName: 'Bruno',
    companyName: 'SmartStock',
    reservationCode: 'R-200',
    items: [{ name: 'Marker' }],
    storeName: 'Main Store',
    storeAddress: 'Rua das Flores',
    pickupDeadline: '02/07/2026'
  });

  assert.match(result.subject, /Reservation Confirmation/i);
  assert.match(result.text, /reservation has been created/i);
  assert.match(result.html, /reservation has been created/i);
});

test('buildCompactReferenceCode creates a short readable code', () => {
  const code = buildCompactReferenceCode('01316c24-03a7-41b7-bad9-1ea320d2af5f', 'R');
  assert.match(code, /^R-[A-Z0-9]{4,6}$/);
});
