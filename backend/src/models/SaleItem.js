/**
 * Helpers de acesso a dados para linhas de itens de venda.
 * @module models/SaleItem
 */
export class SaleItemModel {
  /**
   * Cria uma linha de item de uma venda.
   *
   * @param {import('pg').PoolClient} client Cliente de conexão (transação em andamento).
   * @param {Object} options Opções da consulta.
   * @param {*} productId Parâmetro `productId`.
   * @param {*} quantity Parâmetro `quantity`.
   * @param {*} unitPrice Parâmetro `unitPrice`.
   * @param {*} subtotal } Parâmetro `subtotal }`.
   * @returns {Promise<*>} Resultado da operação.
   */
  static async create(client, { saleId, productId, quantity, unitPrice, subtotal }) {
    const result = await client.query(
      `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [saleId, productId, quantity, unitPrice, subtotal]
    );
    return result.rows[0];
  }
}
