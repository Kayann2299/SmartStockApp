import test from 'node:test';
import assert from 'node:assert/strict';

import { buildReportWindow, getHistoricalReportPeriods } from '../src/utils/reportPeriods.js';
import { calculateStockForecast, classifyStockRisk, generateSummaryText, isActionableForecastItem } from '../src/services/analyticsService.js';

test('generateSummaryText reports no stock forecast alerts when none are actionable', () => {
  const text = generateSummaryText({
    period: 'weekly',
    companySettings: { currency: 'EUR' },
    salesCount: 12,
    totalSales: 3200,
    averageTicket: 266.67,
    topProducts: [{ name: 'Notebook', sold_quantity: 8 }],
    topProfitProducts: [{ name: 'Notebook', grossProfit: 200 }],
    lowAvailabilityItems: [{ name: 'Mouse', quantity: 1, reserved_quantity: 1 }],
    stockForecast: [{ name: 'Mouse', risk_level: 'critical', days_to_stockout: null, supplier_lead_time: 0, lead_time_alert: false }],
  });

  assert.match(text, /No stock forecast alerts\./);
});

test('classifyStockRisk marks items as critical below min level and warning when forecast is inside lead time', () => {
  const critical = classifyStockRisk({ availableStock: 2, projectedStock: 2, minLevel: 5, supplierLeadTime: 7, daysToStockout: 3 });
  const warning = classifyStockRisk({ availableStock: 10, projectedStock: 10, minLevel: 5, supplierLeadTime: 7, daysToStockout: 3 });

  assert.equal(critical.riskLevel, 'critical');
  assert.equal(critical.leadTimeAlert, false);
  assert.equal(warning.riskLevel, 'low');
  assert.equal(warning.leadTimeAlert, true);
});

test('isActionableForecastItem keeps critical items out of low-stock alerts', () => {
  const criticalItem = {
    risk_level: 'critical',
    available_stock: 2,
    min_level: 5,
    supplier_lead_time: 7,
    days_to_stockout: 3,
    lead_time_alert: false,
  };
  const warningItem = {
    risk_level: 'warning',
    available_stock: 10,
    min_level: 5,
    supplier_lead_time: 7,
    days_to_stockout: 3,
    lead_time_alert: true,
  };

  assert.equal(isActionableForecastItem(criticalItem), false);
  assert.equal(isActionableForecastItem(warningItem), true);
});

test('calculateStockForecast uses the 30-day forecast window for consistency', () => {
  const forecast = calculateStockForecast({
    quantity: 20,
    reservedQuantity: 3,
    minLevel: 5,
    supplierLeadTime: 7,
    sold_Period: 80,
    sold_Period_30: 180,
    purchased_Period: 6,
    purchased_Period_30: 30,
    totalDays: 7,
  });

  assert.equal(forecast.availableStock, 17);
  assert.equal(forecast.averageDailySales, 80 / 30);
  assert.equal(forecast.daysToStockout, 17 / (80 / 30));
  assert.equal(forecast.riskLevel, 'low');
  assert.equal(forecast.leadTimeAlert, true);
});

test('buildReportWindow uses the previous completed week for Sunday runs', () => {
  const referenceDate = new Date('2026-07-05T12:00:00Z');
  const window = buildReportWindow('weekly', referenceDate);

  assert.equal(window.since.toISOString().slice(0, 10), '2026-06-29');
  assert.equal(window.until.toISOString().slice(0, 10), '2026-07-05');
});

test('buildReportWindow uses the previous month for first-day monthly runs', () => {
  const referenceDate = new Date('2026-08-01T12:00:00Z');
  const window = buildReportWindow('monthly', referenceDate);

  assert.equal(window.since.toISOString().slice(0, 10), '2026-07-01');
  assert.equal(window.until.toISOString().slice(0, 10), '2026-07-31');
});

test('buildReportWindow uses the previous completed week when the app starts on Monday', () => {
  const referenceDate = new Date('2026-07-06T12:00:00Z');
  const window = buildReportWindow('weekly', referenceDate);

  assert.equal(window.since.toISOString().slice(0, 10), '2026-06-29');
  assert.equal(window.until.toISOString().slice(0, 10), '2026-07-05');
});

test('getHistoricalReportPeriods creates weekly and monthly ranges from existing data', () => {
  const periods = getHistoricalReportPeriods(new Date('2026-06-15T00:00:00Z'), new Date('2026-08-01T00:00:00Z'));
  assert.ok(periods.some((entry) => entry.type === 'weekly'));
  assert.ok(periods.some((entry) => entry.type === 'monthly'));
  assert.ok(periods.find((entry) => entry.type === 'weekly' && entry.since.toISOString().slice(0, 10) === '2026-06-15'));
  assert.ok(periods.find((entry) => entry.type === 'monthly' && entry.since.toISOString().slice(0, 10) === '2026-06-01'));
});

test('getHistoricalReportPeriods skips the current incomplete month when a reference date is provided', () => {
  const periods = getHistoricalReportPeriods(
    new Date('2026-06-15T00:00:00Z'),
    new Date('2026-07-06T00:00:00Z'),
    new Date('2026-07-06T12:00:00Z')
  );

  assert.ok(periods.some((entry) => entry.type === 'monthly' && entry.since.toISOString().slice(0, 10) === '2026-06-01'));
  assert.ok(!periods.some((entry) => entry.type === 'monthly' && entry.since.toISOString().slice(0, 10) === '2026-07-01'));
});

test('getHistoricalReportPeriods skips the current incomplete week when a reference date is provided', () => {
  const periods = getHistoricalReportPeriods(
    new Date('2026-06-15T00:00:00Z'),
    new Date('2026-07-08T00:00:00Z'),
    new Date('2026-07-08T12:00:00Z')
  );

  assert.ok(periods.some((entry) => entry.type === 'weekly' && entry.since.toISOString().slice(0, 10) === '2026-06-29'));
  assert.ok(!periods.some((entry) => entry.type === 'weekly' && entry.since.toISOString().slice(0, 10) === '2026-07-06'));
});
