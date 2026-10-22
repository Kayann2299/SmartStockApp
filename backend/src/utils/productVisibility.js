/**
 * Constrói a cláusula de visibilidade para produtos com base em seu estado ativo ou arquivado.
 * @module utils/productVisibility
 */
import { dbQuery } from '../config/db.js';

/**
 * Constrói product visibility clause.
 */
export const buildProductVisibilityClause = async (alias = 'p', status = 'active') => {
  const normalized = String(status || 'active').toLowerCase();

  if (normalized === 'all') {
    return '';
  }

  if (normalized === 'archived') {
    return `WHERE ${alias}.deleted_at IS NOT NULL`;
  }

  const activeResult = await dbQuery('SELECT COUNT(*)::int AS active_count FROM products WHERE deleted_at IS NULL');
  const activeCount = Number(activeResult.rows[0]?.active_count || 0);

  return activeCount > 0 ? `WHERE ${alias}.deleted_at IS NULL` : '';
};
