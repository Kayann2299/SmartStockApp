import { NavLink } from 'react-router-dom';
import { useContext } from 'react';
import { SettingsContext } from '../context/SettingsContext.jsx';
import { AuthContext } from '../context/AuthContext.jsx';

const items1 = [
  { to: '/SmartOverview', label: 'Smart Overview' },
  { to: '/products', label: 'Products' },
  { to: '/sales', label: 'Sales' },
  { to: '/sales-history', label: 'Sales History' },
  { to: '/suppliers', label: 'Suppliers' },
  { to: '/supplier-orders', label: 'Supplier Orders' },
  { to: '/customers', label: 'Customers' },
  { to: '/reservations', label: 'Reservations' },
];

const items2 = [
  { to: '/insights', label: 'AI Insights' },
  { to: '/reports', label: 'Reports' },
  { to: '/settings', label: 'Settings' },
];

/**
 * Menu lateral de navegação principal da aplicação, com os links para as páginas do
 * sistema e a ação de logout.
 *
 * @returns {JSX.Element} Menu lateral renderizado.
 */
export default function Sidebar() {
  const { settings } = useContext(SettingsContext);
  const { logout } = useContext(AuthContext);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-mark">S</div>
        <div>
          <div className="sidebar-brand-title">SmartStock</div>
          <div className="sidebar-brand-subtitle">{settings.companyName ? settings.companyName : 'Business control center'}</div>
        </div>
      </div>

      <div className="sidebar-scroll">
        <div>
          <nav className="sidebar-nav" style={{ margintop: '1rem' }}>
            {items1.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-section-label">--------------------------------</div>
          {items2.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
          <button type="button" onClick={logout} className="btn sidebar-logout">Sign out</button>
        </div>
      </div>
    </aside>
  );
}
