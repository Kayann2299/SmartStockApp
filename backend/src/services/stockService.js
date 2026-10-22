import { dbQuery, pool } from '../config/db.js';
import { buildProductVisibilityClause } from '../utils/productVisibility.js';
import { getAnalyticsStats, isActionableForecastItem } from './analyticsService.js';

/**
 * Serviço de controle de estoque.
 * Centraliza operações de disponibilidade, ajustes de quantidade e alertas de estoque.
 */

export const listAvailabilityService = async () => {
  const visibilityClause = await buildProductVisibilityClause('p', 'active');
  const result = await dbQuery(
    `SELECT p.id, p.name, p.category, p.quantity, (
        SELECT COALESCE(SUM(ri.quantity),0)::int FROM reservation_items ri JOIN reservations r ON r.id = ri.reservation_id WHERE ri.product_id = p.id AND COALESCE(r.status,'') != 'completed'
      ) AS reserved_quantity, p.photo_url, p.supplier_id,
       s.name AS supplier_name
       FROM products p
      LEFT JOIN suppliers s
      ON s.id = p.supplier_id`
  );
  return result.rows;
};

/**
 * Atualiza o nível mínimo de estoque de um produto.
 *
 * @param {string|number} productId Identificador do produto.
 * @param {number} minLevel Novo nível mínimo de estoque.
 * @returns {Promise<Object|null>} Produto atualizado ou null.
 */
export const setProductMinLevelService = async (productId, minLevel) => {
  const result = await dbQuery(
    `UPDATE products
     SET min_level = $2
     WHERE id = $1
     RETURNING id, name, category, quantity, min_level`,
    [productId, minLevel]
  );
  return result.rows[0] || null;
};

/**
 * Ajusta a quantidade em estoque de um produto de forma transacional.
 *
 * @param {string|number} productId Identificador do produto.
 * @param {number} delta Diferença a ser aplicada ao estoque.
 * @param {string} [description='Manual adjustment'] Descrição do ajuste.
 * @returns {Promise<Object>} Produto atualizado após o ajuste.
 */
export const adjustProductQuantityService = async (productId, delta, description = 'Manual adjustment') => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const productResult = await client.query(
      `SELECT quantity FROM products WHERE id = $1 FOR UPDATE`,
      [productId]
    );
    if (!productResult.rows[0]) {
      throw new Error('Product not found.');
    }

    const currentQuantity = Number(productResult.rows[0].quantity || 0);
    const nextQuantity = currentQuantity + Number(delta);
    if (nextQuantity < 0) {
      throw new Error('Quantity cannot go below zero.');
    }

    const updated = await client.query(
      `UPDATE products
       SET quantity = $2
       WHERE id = $1
       RETURNING id, name, category, quantity, min_level`,
      [productId, nextQuantity]
    );

    await client.query('COMMIT');
    return updated.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Retorna os itens de stock agrupados por risco para o alerta semanal por
 * email: produtos em "low stock" (risco 'low') e produtos em "critical
 * stock" (risco 'critical' ou 'out_of_stock'), separadamente.
 *
 * @returns {Promise<{lowStockItems: Array<Object>, criticalStockItems: Array<Object>}>}
 */
export const getStockAlertBreakdownService = async () => {
  const stats = await getAnalyticsStats({ historicalStock: false });
  const forecast = stats.stockForecast || [];

  const lowStockItems = forecast.filter(
    (item) => String(item.risk_level || '').toLowerCase() === 'low'
  );
  const criticalStockItems = forecast.filter((item) => {
    const risk = String(item.risk_level || '').toLowerCase();
    return risk === 'critical' || risk === 'out_of_stock';
  });

  return { lowStockItems, criticalStockItems };
};

/**
 * Retorna os itens com baixa disponibilidade ou risco operacional.
 *
 * @returns {Promise<Array<Object>>} Lista de itens com alerta de estoque.
 */
export const getLowAvailabilityItemsService = async () => {
  // historicalStock:false garante a janela de forecast fixa (30 dias reais,
  // via getForecastWindow). "period" não afeta mais o forecast, então nem
  // é passado aqui — só o cálculo de vendas do dashboard usa period.
  const stats = await getAnalyticsStats({ historicalStock: false });

  return stats.stockForecast.filter(isActionableForecastItem);
};


/** Alias de {@link listAvailabilityService}, mantido por compatibilidade de nome. */
export const listStockService = listAvailabilityService;
/** Alias de {@link setProductMinLevelService}, mantido por compatibilidade de nome. */
export const setMinLevelService = setProductMinLevelService;
/** Alias de {@link adjustProductQuantityService}, mantido por compatibilidade de nome. */
export const adjustStockService = adjustProductQuantityService;
/** Alias de {@link getLowAvailabilityItemsService}, mantido por compatibilidade de nome. */
export const getLowStockItemsService = getLowAvailabilityItemsService;
