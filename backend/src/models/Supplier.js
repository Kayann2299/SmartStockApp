/**
 * Helpers de acesso a dados para registros de fornecedores e resumos de estoque relacionados.
 * @module models/Supplier
 */
import { dbQuery } from '../config/db.js';
import { getForecastWindow, stockForecastCTE, computeForecastMetrics } from '../services/stockForecastService.js';



export class SupplierModel {

  /**
   * Lista os registros.
   *
   * @returns {Promise<*>} Resultado da operação.
   */
  static async list() {

    const suppliers = await dbQuery(
      `
      SELECT 
        s.*,
        COUNT(DISTINCT po.id)::int AS orders_count
      FROM suppliers s
      LEFT JOIN supplier_orders po 
        ON po.supplier_id = s.id
      GROUP BY s.id
      ORDER BY s.created_at DESC
      `
    );

    const { forecastSince, forecastUntil } = getForecastWindow();

    const products = await dbQuery(
      `
      ${stockForecastCTE('WHERE p.deleted_at IS NULL')}

      SELECT
        p.id,
        p.supplier_id,
        stock_data.quantity,
        stock_data.min_level,
        stock_data.reserved_quantity,
        stock_data.supplier_lead_time,
        stock_data.sold_period_30,
        stock_data.purchased_period_30
      FROM products p
      JOIN stock_data ON stock_data.id = p.id
      `,
      [forecastSince, forecastUntil]
    );


    const counts = {};


    for (const product of products.rows) {

const forecast = computeForecastMetrics(product);

      const supplierId = product.supplier_id;

      if (!counts[supplierId]) {
        counts[supplierId] = {
          low_stock_items: 0,
          critical_stock_items: 0,
        };
      }


      if (forecast.riskLevel === 'low') {
        counts[supplierId].low_stock_items++;
      }


      if (
        forecast.riskLevel === 'critical' ||
        forecast.riskLevel === 'out_of_stock'
      ) {
        counts[supplierId].critical_stock_items++;
      }

    }


    return suppliers.rows.map((supplier)=>({
      ...supplier,
      low_stock_items:
        counts[supplier.id]?.low_stock_items || 0,

      critical_stock_items:
        counts[supplier.id]?.critical_stock_items || 0,
    }));

  }


  /**
   * Busca um registro pelo seu identificador.
   *
   * @param {*} id Parâmetro `id`.
   * @returns {Promise<*>} Resultado da operação.
   */
  static async findById(id) {
    const result = await dbQuery(`SELECT * FROM suppliers WHERE id = $1 LIMIT 1`, [id]);
    return result.rows[0] || null;
  }

  /**
   * Cria um novo fornecedor.
   *
   * @param {*} data Parâmetro `data`.
   * @returns {Promise<*>} Resultado da operação.
   */
  static async create(data) {
    const { name, email, phone, lead_time, photo_url, photo_filename } = data;
    const result = await dbQuery(
      `INSERT INTO suppliers (name, email, phone, lead_time, photo_url, photo_filename)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, email || null, phone || null, lead_time ?? null, photo_url || null, photo_filename || null]
    );
    return result.rows[0];
  }

  /**
   * Atualiza os dados de um fornecedor existente.
   *
   * @param {*} id Parâmetro `id`.
   * @param {*} data Parâmetro `data`.
   * @returns {Promise<*>} Resultado da operação.
   */
  static async update(id, data) {
    const { name, email, phone, lead_time, photo_url, photo_filename } = data;

    const result = await dbQuery(
      `UPDATE suppliers
       SET name = COALESCE($2, name),
           email = COALESCE($3, email),
           phone = COALESCE($4, phone),
           lead_time = COALESCE($5, lead_time),
           photo_url = COALESCE($6, photo_url),
           photo_filename = COALESCE($7, photo_filename)
       WHERE id = $1
       RETURNING *`,
      [id, name ?? null, email ?? null, phone ?? null, lead_time ?? null, photo_url ?? null, photo_filename ?? null]
    );

    return result.rows[0] || null;
  }
}
