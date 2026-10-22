import { dbQuery } from '../config/db.js';
import { buildProductVisibilityClause } from '../utils/productVisibility.js';

const PAGES = [
  { type: 'page', label: 'Smart Overview', path: '/SmartOverview' },
  { type: 'page', label: 'Products', path: '/products' },
  { type: 'page', label: 'Suppliers', path: '/suppliers' },
  { type: 'page', label: 'Supplier Orders', path: '/supplier-orders' },
  { type: 'page', label: 'Sales', path: '/sales' },
  { type: 'page', label: 'Sales History', path: '/sales-history' },
  { type: 'page', label: 'Reservations', path: '/reservations' },
  { type: 'page', label: 'Reports', path: '/reports' },
  { type: 'page', label: 'AI Insights', path: '/insights' },
  { type: 'page', label: 'Settings', path: '/settings' },
];

const scopes = new Set(['all', 'pages', 'products', 'suppliers', 'customers', 'notifications', 'reports']);

/**
 * Monta um padrão para cláusulas SQL `LIKE`/`ILIKE`, envolvendo o valor
 * com wildcards `%` após remover espaços nas extremidades.
 *
 * @param {string} value Valor de busca.
 * @returns {string} Padrão pronto para uso em `ILIKE $n`.
 */
const like = (value) => `%${String(value || '').trim()}%`;

/**
 * Serviço de busca transversal da aplicação.
 * Pesquisa páginas, produtos, fornecedores, clientes, notificações e relatórios.
 */
export const searchBusinessService = async ({ q = '', type = 'all' } = {}) => {
  const query = String(q || '').trim();
  const scope = scopes.has(String(type || '').toLowerCase()) ? String(type || '').toLowerCase() : 'all';
  if (query.length < 2) {
    return { query, scope, pages: [], products: [], suppliers: [], customers: [], notifications: [], reports: [] };
  }

  const term = like(query);
  const result = {
    query,
    scope,
    pages: [],
    products: [],
    suppliers: [],
    customers: [],
    notifications: [],
    reports: [],
  };

  if (scope === 'all' || scope === 'pages') {
    result.pages = PAGES.filter((page) => page.label.toLowerCase().includes(query.toLowerCase()));
  }

  if (scope === 'all' || scope === 'products') {
    const visibilityClause = await buildProductVisibilityClause('p', 'active');
    const clause = visibilityClause ? `${visibilityClause} AND (` : 'WHERE (';
    const reservedSub = `(SELECT COALESCE(SUM(ri.quantity),0)::int FROM reservation_items ri JOIN reservations r ON r.id = ri.reservation_id WHERE ri.product_id = p.id AND COALESCE(r.status,'') != 'completed')`;
    const products = await dbQuery(
      `SELECT id, name, category, quantity, ${reservedSub} AS reserved_quantity, price_sell, photo_url, deleted_at
       FROM products p
       ${clause}
           name ILIKE $1 OR
           category ILIKE $1 OR
           COALESCE(description, '') ILIKE $1
         )
       ORDER BY created_at DESC
       LIMIT 8`,
      [term]
    );
    result.products = products.rows;
  }

  if (scope === 'all' || scope === 'suppliers') {
    const suppliers = await dbQuery(
      `SELECT id, name, email, phone, lead_time, photo_url
       FROM suppliers
       WHERE name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1
       ORDER BY created_at DESC
       LIMIT 8`,
      [term]
    );
    result.suppliers = suppliers.rows;
  }

  if (scope === 'all' || scope === 'customers') {
    const customers = await dbQuery(
      `SELECT id, name, nif, email, phone
       FROM customers
       WHERE name ILIKE $1 OR nif ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1
       ORDER BY created_at DESC
       LIMIT 8`,
      [term]
    );
    result.customers = customers.rows;
  }

  if (scope === 'all' || scope === 'notifications') {
    const notifications = await dbQuery(
      `SELECT id, type, message, is_read, created_at
       FROM notifications
       WHERE type ILIKE $1 OR message ILIKE $1
       ORDER BY created_at DESC
       LIMIT 8`,
      [term]
    );
    result.notifications = notifications.rows;
  }

  if (scope === 'all' || scope === 'reports') {
    const reports = await dbQuery(
      `SELECT id, type, title, content, created_at
       FROM reports
       WHERE type ILIKE $1 OR title ILIKE $1 OR content ILIKE $1
       ORDER BY created_at DESC
       LIMIT 8`,
      [term]
    );
    result.reports = reports.rows;
  }

  return result;
};
