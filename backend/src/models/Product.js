import { dbQuery } from '../config/db.js';
import { buildProductVisibilityClause } from '../utils/productVisibility.js';
import { getForecastWindow, computeForecastMetrics } from '../services/stockForecastService.js';

/**
 * Helpers de acesso a dados para o catálogo de produtos e análises de estoque.
 *
 * days_to_stockout / average_daily_sales aqui SEMPRE usam a janela fixa de
 * 30 dias (getForecastWindow) — a página de Products não tem seletor de
 * período e não deve ter: precisa bater com Notifications e Supplier Orders.
 *
 * @module models/Product
 */
const selectColumns = `
  p.*,
  s.name AS supplier_name,
  s.email AS supplier_email,
  s.phone AS supplier_phone,
  s.photo_url AS supplier_photo_url,
  s.lead_time AS supplier_lead_time,
  (
    SELECT COALESCE(SUM(ri.quantity), 0)::int
    FROM reservation_items ri
    JOIN reservations r ON r.id = ri.reservation_id
    WHERE ri.product_id = p.id
      AND COALESCE(r.status, '') != 'completed'
  ) AS reserved_quantity,
  COALESCE((
    SELECT SUM(si.quantity)
    FROM sale_items si
    JOIN sales s2 ON s2.id = si.sale_id
    WHERE si.product_id = p.id
      AND s2.created_at BETWEEN $1 AND $2
  ), 0)::numeric AS sold_period_30,
  COALESCE((
    SELECT SUM(soi.quantity)
    FROM supplier_order_items soi
    JOIN supplier_orders so ON so.id = soi.order_id
    WHERE soi.product_id = p.id
      AND so.status IN ('pending', 'completed', 'received')
      AND so.created_at BETWEEN $1 AND $2
  ), 0)::numeric AS purchased_period_30
`;

/**
 * Enriquece uma linha de produto vinda do banco com as métricas de
 * previsão de stock (dias até rutura, reorder recomendado, nível de risco).
 *
 * @param {Object} row Linha do produto com os campos base de stock/vendas.
 * @returns {Object} A linha original combinada com as métricas de forecast.
 */
const annotateProductStock = (row) => {
  const metrics = computeForecastMetrics({
    quantity: row.quantity,
    reserved_quantity: row.reserved_quantity,
    min_level: row.min_level,
    supplier_lead_time: row.supplier_lead_time,
    sold_period_30: row.sold_period_30,
    purchased_period_30: row.purchased_period_30,
  });

  return {
    ...row,
    ...metrics,
    available_stock: metrics.availableStock,
    projected_stock: metrics.projectedStock,
    average_daily_sales: metrics.averageDailySales,
    days_to_stockout: metrics.daysToStockout,
    recommended_reorder: metrics.recommended_reorder,
    stock_status: metrics.riskLevel,
    risk_level: metrics.riskLevel,
    lead_time_alert: metrics.leadTimeAlert,
  };
};




export class ProductModel {
  /**
   * Lista os registros.
   *
   * @param {Object} options Opções da consulta.
   * @returns {Promise<*>} Resultado da operação.
   */
  static async list({ status = 'active' } = {}) {
    const visibilityClause = await buildProductVisibilityClause('p', status);
    const { forecastSince, forecastUntil } = getForecastWindow();

    const result = await dbQuery(
      `SELECT ${selectColumns}
       FROM products p
       LEFT JOIN suppliers s ON s.id = p.supplier_id
       ${visibilityClause}
       ORDER BY p.created_at DESC`,
      [forecastSince, forecastUntil]
    );
    return result.rows.map((row) => annotateProductStock(row));
  }

  /**
   * Lista todos os registros, sem filtro de visibilidade/status.
   *
   * @returns {Promise<*>} Resultado da operação.
   */
  static async listAll() {
    return this.list({ status: 'all' });
  }

  /**
   * Busca um registro pelo seu identificador.
   *
   * @param {*} id Parâmetro `id`.
   * @returns {Promise<*>} Resultado da operação.
   */
  static async findById(id) {
    const { forecastSince, forecastUntil } = getForecastWindow();

    const result = await dbQuery(
      `SELECT ${selectColumns}
       FROM products p
       LEFT JOIN suppliers s ON s.id = p.supplier_id
       WHERE p.id = $3
       LIMIT 1`,
      [forecastSince, forecastUntil, id]
    );
    return result.rows[0] ? annotateProductStock(result.rows[0]) : null;
  }

  /**
   * Cria um novo produto.
   *
   * @param {*} data Parâmetro `data`.
   * @returns {Promise<*>} Resultado da operação.
   */
  static async create(data) {
    const {
      name,
      category,
      description,
      price_buy,
      price_sell,
      unit,
      quantity = 0,
      min_level = 0,
      is_active = true,
      photo_url = null,
      photo_filename = null,
      primary_supplier_id = null,
    } = data;

    const enforcedMinLevel = Number(min_level ?? 0);

    const result = await dbQuery(
      `INSERT INTO products (
         name, category, description, price_buy, price_sell, unit,
         quantity, min_level, is_active, photo_url, photo_filename, supplier_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        name,
        category || null,
        description || null,
        price_buy ?? 0,
        price_sell ?? 0,
        unit || null,
        quantity ?? 0,
        enforcedMinLevel,
        is_active,
        photo_url || null,
        photo_filename || null,
        primary_supplier_id || null,
      ]
    );

    return result.rows[0];
  }

  /**
   * Atualiza os campos informados de um produto existente (campos omitidos permanecem inalterados via COALESCE).
   *
   * @param {*} id Parâmetro `id`.
   * @param {*} data Parâmetro `data`.
   * @returns {Promise<*>} Resultado da operação.
   */
  static async update(id, data) {
    const {
      name,
      category,
      description,
      price_buy,
      price_sell,
      unit,
      quantity,
      min_level,
      is_active,
      photo_url,
      photo_filename,
      primary_supplier_id,
    } = data;

    const result = await dbQuery(
      `UPDATE products
       SET name = COALESCE($2, name),
           category = COALESCE($3, category),
           description = COALESCE($4, description),
           price_buy = COALESCE($5, price_buy),
           price_sell = COALESCE($6, price_sell),
           unit = COALESCE($7, unit),
           quantity = COALESCE($8, quantity),
           min_level = COALESCE($9, min_level),
           is_active = COALESCE($10, is_active),
           photo_url = COALESCE($11, photo_url),
           photo_filename = COALESCE($12, photo_filename),
           supplier_id = COALESCE($13, supplier_id)
       WHERE id = $1
       RETURNING *`,
      [
        id,
        name ?? null,
        category ?? null,
        description ?? null,
        price_buy ?? null,
        price_sell ?? null,
        unit ?? null,
        quantity ?? null,
        min_level ?? null,
        is_active ?? null,
        photo_url ?? null,
        photo_filename ?? null,
        primary_supplier_id ?? null,
      ]
    );

    return result.rows[0] || null;
  }

  /**
   * Arquiva (soft delete) um registro, marcando deleted_at.
   *
   * @param {*} id Parâmetro `id`.
   * @returns {Promise<*>} Resultado da operação.
   */
  static async softDelete(id) {
    const result = await dbQuery(
      `UPDATE products
       SET deleted_at = NOW(),
           is_active = FALSE
       WHERE id = $1
       RETURNING id`,
      [id]
    );
    return result.rows[0] || null;
  }
/**
 * Restaura um registro previamente arquivado.
 *
 * @param {*} id Parâmetro `id`.
 * @returns {Promise<*>} Resultado da operação.
 */
static async restore(id) {
  const result = await dbQuery(
    `
    UPDATE products
    SET deleted_at = NULL,
        is_active = TRUE
    WHERE id = $1
    RETURNING *;
    `,
    [id]
  );

  return result.rows[0] || null;
}
}
