import test from 'node:test';
import assert from 'node:assert/strict';

import { formatDate } from '../src/utils/formatDate.js';
import {
  summarizeLineItems,
  buildSaleDescription,
  buildReservationDescription
} from '../src/utils/recordDescriptions.js';

test('formatDate returns a placeholder for empty values', () => {
  assert.equal(formatDate(null), '-');
  assert.equal(formatDate(undefined), '-');
  assert.equal(formatDate(''), '-');
});

test('formatDate renders readable local dates for valid values', () => {
  const rendered = formatDate('2024-01-02T03:04:05Z');

  assert.ok(rendered.includes('2024'));
  assert.ok(rendered.includes('/') || rendered.includes('-'));
});

test('summarizeLineItems uses fallback names and preserves the item preview', () => {
  const summary = summarizeLineItems([
    { name: 'Mouse', quantity: 2 },
    { product_name: 'Keyboard', quantity: 3 },
    { productName: 'Monitor', quantity: 1 }
  ], 2);

  assert.equal(summary, '2 x Mouse, 3 x Keyboard +1 more');
});

test('summarizeLineItems falls back to a generic label for incomplete records', () => {
  const summary = summarizeLineItems([{ quantity: 4 }, { product_name: 'Book' }]);

  assert.equal(summary, '4 x Item, 1 x Book');
});

test('buildSaleDescription prioritizes custom text and reservation transfer metadata', () => {
  const custom = buildSaleDescription({
    items: [{ name: 'Mouse', quantity: 1 }],
    customDescription: 'Custom sale note'
  });

  const transfer = buildSaleDescription({
    items: [{ name: 'Mouse', quantity: 1 }],
    paymentMethod: 'card',
    sourceReservationId: 42
  });

  assert.equal(custom, 'Custom sale note');
  assert.equal(transfer, 'Reservation transfer #42: 1 x Mouse');
});

test('buildReservationDescription uses the customer name and preserves custom descriptions', () => {
  const withCustomer = buildReservationDescription({
    items: [{ name: 'Book', quantity: 2 }],
    customerName: 'Ana'
  });

  const withCustom = buildReservationDescription({
    items: [{ name: 'Book', quantity: 2 }],
    customerName: 'Ana',
    customDescription: 'Collected by Ana'
  });

  assert.equal(withCustomer, 'Reservation for Ana: 2 x Book');
  assert.equal(withCustom, 'Collected by Ana');
});
