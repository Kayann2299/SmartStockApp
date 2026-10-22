import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { useCart } from '../hooks/useCart.js';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ThemeContext } from '../context/ThemeContext.jsx';
import { SettingsContext } from '../context/SettingsContext.jsx';
import { searchBusiness } from '../services/searchService.js';

const labels = {
  '/SmartOverview': 'Smart Overview',
  '/products': 'Products',
  '/sales': 'Sales',
  '/sales-history': 'Sales History',
  '/reports': 'Reports',
  '/reservations': 'Reservations',
  '/suppliers': 'Suppliers',
  '/supplier-orders': 'Supplier Orders',
  '/customers': 'Customers',
  '/insights': 'AI Insights',
  '/settings': 'Settings',
};

const pageDescriptions = {
  '/SmartOverview': 'Monitor sales, stock, and business activity in one place.',
  '/products': 'Manage your catalog, stock levels, and product details.',
  '/sales': 'Create and review sales quickly from the point of sale.',
  '/sales-history': 'Track completed sales and revenue history over time.',
  '/reports': 'Explore business reports and performance summaries.',
  '/reservations': 'Handle customer reservations and pending orders.',
  '/suppliers': 'Manage supplier profiles, contacts, and purchasing details.',
  '/supplier-orders': 'Create and follow supplier purchase orders and low-stock requests.',
  '/customers': 'Keep customer records and relationships organized.',
  '/insights': 'Chat with AI about your sales, stock, and business insights.',
  '/settings': 'Adjust preferences, profile information, and app settings.',
};

const scopeOptions = [
  { value: 'all', label: 'All' },
  { value: 'pages', label: 'Functions' },
  { value: 'products', label: 'Products' },
  { value: 'suppliers', label: 'Suppliers' },
  { value: 'customers', label: 'Customers' },
  { value: 'notifications', label: 'Notifications' },
  { value: 'reports', label: 'Reports' },
];

const entityPath = {
  page: (item) => item.path,
  product: () => '/products',
  supplier: () => '/suppliers',
  customer: () => '/customers',
  notification: () => '/SmartOverview',
  report: () => '/reports',
};

/**
 * Barra de navegação superior: título/descrição da página atual, busca global (páginas,
 * produtos, fornecedores, clientes, notificações e relatórios), alternância de tema e
 * indicador do carrinho de vendas.
 *
 * @returns {JSX.Element} Barra de navegação renderizada.
 */
export default function Navbar() {
  const { user } = useAuth();
  const { cart } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  const { theme } = useContext(ThemeContext);
  const { settings } = useContext(SettingsContext);
  const title = labels[location.pathname] || 'SmartStock';
  const subtitle = pageDescriptions[location.pathname] || `${settings.companyName || 'SmartStock'} · products, suppliers, customers and reports`;

  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('all');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const searchRef = useRef(null);

  const initials = (user?.name || user?.email || 'U')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  useEffect(() => {
    const onClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults(null);
      setOpen(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timeout = setTimeout(() => {
      searchBusiness({ q: term, type: scope })
        .then((res) => {
          setResults(res.data);
          setOpen(true);
        })
        .catch(() => setResults({ pages: [], products: [], suppliers: [], customers: [], notifications: [], reports: [] }))
        .finally(() => setLoading(false));
    }, 250);

    return () => clearTimeout(timeout);
  }, [query, scope]);

  const sections = useMemo(() => {
    if (!results) return [];
    return [
      { key: 'pages', label: 'Functions', items: results.pages || [], type: 'page' },
      { key: 'products', label: 'Products', items: results.products || [], type: 'product' },
      { key: 'suppliers', label: 'Suppliers', items: results.suppliers || [], type: 'supplier' },
      { key: 'customers', label: 'Customers', items: results.customers || [], type: 'customer' },
      { key: 'notifications', label: 'Notifications', items: results.notifications || [], type: 'notification' },
      { key: 'reports', label: 'Reports', items: results.reports || [], type: 'report' },
    ].filter((section) => section.items.length > 0);
  }, [results]);

  const handleSelect = (type, item) => {
    const pathResolver = entityPath[type];
    const path = pathResolver ? pathResolver(item) : null;
    const searchValue = type === 'customer'
      ? (item.nif || item.phone || item.email || item.name || item.label || '')
      : (item.name || item.label || item.title || '');
    setOpen(false);
    if (!path) return;

    const query = encodeURIComponent(searchValue.trim());
    if (type === 'product') {
      navigate(`/products?search=${query}`);
      return;
    }
    if (type === 'supplier') {
      navigate(`/suppliers?search=${query}`);
      return;
    }
    if (type === 'customer') {
      navigate(`/customers?search=${query}`);
      return;
    }
    navigate(path);
  };

  const clearSearch = () => {
    setQuery('');
    setResults(null);
    setOpen(false);
  };

  return (
    <header className="navbar">
      <div className="navbar-left">
        <div className="navbar-title">
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
      </div>

      <div className="navbar" ref={searchRef}>
        <div className="search-shell">
          <div className="top-search-wrap">
            <span className="top-search-icon">⌕</span>
            <input
              className="top-search"
              placeholder="Search products, suppliers, customers..."
              aria-label="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => { if (results) setOpen(true); }}
            />
          </div>
          <select className="search-scope" value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Search scope">
            {scopeOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {open ? (
            <div className="search-popover card">
              <div className="search-popover-header">
                <strong>Search results</strong>
                <button type="button" className="btn-ghost search-clear" onClick={clearSearch}>Clear</button>
              </div>
              {loading ? <div className="empty-state">Searching...</div> : null}
              {!loading && sections.length === 0 ? (
                <div className="empty-state">No matches found.</div>
              ) : null}
              {!loading ? sections.map((section) => (
                <div key={section.key} className="search-section">
                  <div className="search-section-title">{section.label}</div>
                  <div className="search-list">
                    {section.items.slice(0, 5).map((item) => (
                      <button
                        key={item.id || `${section.key}-${item.label || item.name}`}
                        type="button"
                        className="search-result"
                        onClick={() => handleSelect(section.type, item)}
                      >
                        <strong>{item.label || item.name || item.title || item.type}</strong>
                        <span>
                          {section.type === 'product' && `${item.category || 'Uncategorized'} · Qty ${item.quantity ?? '—'}`}
                          {section.type === 'supplier' && `${item.email || item.phone || 'No contact'}`}
                          {section.type === 'customer' && `${item.nif || 'No NIF'} · ${item.email || item.phone || 'No contact'}`}
                          {section.type === 'notification' && `${item.type || 'notification'} · ${item.is_read ? 'read' : 'new'}`}
                          {section.type === 'report' && `${item.type || 'report'} · ${item.created_at ? new Date(item.created_at).toLocaleDateString('en-GB') : ''}`}
                          {section.type === 'page' && item.path}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )) : null}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          className="nav-pill"
          onClick={() => navigate('/sales')}
          title={`${cart.length} item${cart.length !== 1 ? 's' : ''} in cart`}
          style={{ position: 'relative', cursor: 'pointer', border: '1px solid grey', background: 'none', padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
        >
          🛒
          {cart.length > 0 && (
            <span style={{
              background: '#e63946',
              color: 'white',
              borderRadius: '50%',
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 'bold'
            }}>
              {cart.length}
            </span>
          )}
        </button>

        <div className="account-chip">
          <Link to="/settings?tab=profile" className="account-chip-link">
            <div className="nav-avatar" title={user?.email || 'User'}>{initials}</div>
          </Link>
          <Link to="/settings?tab=profile" className="account-chip-link">
            <div className="account-chip-copy">
              <strong>{user?.name || settings.displayName || 'Account'}</strong>
              <span>{user?.email || 'No email'}</span>
            </div>
          </Link>
        </div>
        <span className="nav-pill role-pill">{user?.role || 'employee'}</span>
      </div>
    </header>
  );
}
