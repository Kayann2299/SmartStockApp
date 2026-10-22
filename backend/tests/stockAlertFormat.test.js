import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateStockAlertMetrics, isActionableStockAlertItem } from '../src/utils/stockalertformat.js';

test('calculateStockAlertMetrics uses the 30-day forecast window for consistency', () => {
  const result = calculateStockAlertMetrics({
    quantity: 40,
    reservedQuantity: 5,
    minLevel: 10,
    supplierLeadTime: 7,
    sold_Period_30: 210,
    purchased_Period_30: 0,
    stockForecastDays: 30,
  });

  assert.equal(result.availableStock, 35);
  assert.equal(result.averageDailySales, 7);
  assert.equal(result.daysToStockout, 5);
  assert.equal(result.riskLevel, 'low');
  assert.equal(result.leadTimeAlert, true);
});

test('isActionableStockAlertItem keeps only forecast items that are actionable', () => {
  const actionable = isActionableStockAlertItem({
    risk_level: 'low',
    available_stock: 20,
    min_level: 10,
    supplier_lead_time: 7,
    days_to_stockout: 4,
  });
  const ignored = isActionableStockAlertItem({
    risk_level: 'critical',
    available_stock: 3,
    min_level: 10,
    supplier_lead_time: 7,
    days_to_stockout: 2,
  });

  assert.equal(actionable, true);
  assert.equal(ignored, false);
});
