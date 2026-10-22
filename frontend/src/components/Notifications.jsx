import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api.js';
import { listReports } from '../services/reportService.js';


/**
 * Painel de notificações do dashboard: alertas de estoque crítico/baixo, últimos relatórios
 * gerados e notificações gerais do sistema.
 *
 * @param {Object} props Propriedades do componente.
 * @param {Array<Object>} [props.criticalAvailabilityItems=[]] Itens com estoque crítico ou esgotado.
 * @param {Array<Object>} [props.lowAvailabilityItems=[]] Itens com estoque baixo, recomendados para reposição.
 * @param {() => void} [props.onViewLowStock] Callback chamado ao clicar em "View details" na seção de estoque baixo.
 * @param {() => void} [props.onViewCriticalStock] Callback chamado ao clicar em "View details" na seção de estoque crítico.
 * @returns {JSX.Element} Painel com os alertas e notificações renderizados.
 */
export default function Notifications({ criticalAvailabilityItems = [],
  lowAvailabilityItems = [],
  onViewLowStock,
  onViewCriticalStock
}) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    api.get('/notifications')
      .then((res) => setNotifications(res.data))
      .catch(() => setNotifications([]));
  }, []);

  const [reports, setReports] = useState([]);
  useEffect(() => {
    listReports({ limit: 10 })
      .then((res) => setReports(res.data || []))
      .catch(() => setReports([]));
  }, []);

  const unavailableFallbackItems = (Array.isArray(criticalAvailabilityItems) ? criticalAvailabilityItems : []).filter((item) => {
    const quantity = Number(item?.normalized_quantity ?? 0);
    const reserved = Number(item?.normalized_reserved_quantity ?? 0);
    const availableStock = Number(item?.available_stock ?? (quantity - reserved));
    const min_levels = Number(item?.min_level ?? 0);
    return availableStock <= min_levels;
  });

  const displayCriticalItems = Array.isArray(criticalAvailabilityItems) && criticalAvailabilityItems.length > 0
    ? [
        ...criticalAvailabilityItems,
        ...unavailableFallbackItems.filter((item) => !criticalAvailabilityItems.some((critical) => critical.id === item.id))
      ]
    : (Array.isArray(criticalAvailabilityItems) ? criticalAvailabilityItems : []);

  // Show a single, latest critical stock notification that contains all current critical availability items.
  const hasCriticalStock = displayCriticalItems.length > 0;
  const isStockAlertNotification = (item) => {
    const type = String(item?.type || '').toLowerCase();
    const message = String(item?.message || '').toLowerCase();
    return type === 'availability_alert' || /low stock|out of stock|stock alert|below minimum stock/.test(message);
  };
  const visibleNotifications = (notifications || []).filter((item) => !isStockAlertNotification(item));
  const sortedReports = [...(reports || [])].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  const latestWeeklyReport = sortedReports.find((item) => String(item?.type || '').toLowerCase() === 'weekly') || null;
  const latestMonthlyReport = sortedReports.find((item) => String(item?.type || '').toLowerCase() === 'monthly') || null;
  const reportCards = [latestWeeklyReport, latestMonthlyReport].filter(Boolean);
  const lowStockAlerts = lowAvailabilityItems;
  const hasAnyContent = hasCriticalStock || lowStockAlerts.length > 0 || reportCards.length > 0 || visibleNotifications.length > 0;

  return (
    <div className="card">
      <div className="page-header" style={{ marginBottom: '1rem' }}>
        <div>
          <h3 className="page-title" style={{ fontSize: '1.15rem' }}>Notifications</h3>
          <p className="page-subtitle">Notifications and recent events.</p>
        </div>
      </div>

          {hasCriticalStock ? (
        <div className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
          <div style={{ marginBottom: '.5rem' }}>
            <strong>Critical stock alert</strong>
            <div className="muted" style={{ fontSize: '.9rem' }}>{`${displayCriticalItems.length} product(s) below minimum stock levels`}</div>
          </div>
          <div style={{ maxHeight: 160, overflow: 'auto' }}>
            {displayCriticalItems.map((it) => (
              <div key={it.id || it.product_id} className="list-row" style={{ padding: '.25rem 0' }}>
                <div>
                  <strong>{it.name || it.product_name}</strong>
                  <div className="muted" style={{ fontSize: '.85rem' }}>Reserved: {it.reserved_quantity ?? 0}</div>
                </div>
                <span className="chip chip-danger">{it.available_stock ?? (it.quantity - (it.reserved_quantity ?? 0))} left</span>
              </div>
            ))}
          </div>
          {(onViewCriticalStock) ? (
            <div style={{ marginTop: '.5rem' }}>
              <button type="button" className="btn-secondary" onClick={onViewCriticalStock}>View details</button>
            </div>
          ) : null}
        </div>
      ) : null}

    

      {lowStockAlerts.length > 0 ? (
        <div className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
          <div style={{ marginBottom: '.5rem' }}>
            <strong>Low Stock Alerts</strong>
            <div className="muted" style={{ fontSize: '.9rem' }}>Recommended replenishment before stockout or at lead time.</div>
          </div>
          <div style={{ maxHeight: 180, overflow: 'auto' }}>
            {lowStockAlerts.map((item) => (
             <div key={item.id || item.product_id} className="list-row" style={{ padding: '.25rem 0' }}>
             <div>
              <strong>{item.name || item.product_name}</strong>
              <div className="muted" style={{ fontSize: '.85rem' }}>
             {item.days_to_stockout !== null && item.days_to_stockout !== undefined ? `${Number(item.days_to_stockout).toFixed(2)} days`: 'Forecast pending'}
    {' · '} Lead time {item.supplier_lead_time || '—'} days
      </div>
    </div>
                <span className="chip chip-warning">Reorder</span>
              </div>
            ))}
          </div>
          {onViewLowStock ? (
            <div style={{ marginTop: '.5rem' }}>
              <button type="button" className="btn-secondary" onClick={onViewLowStock}>View details</button>
            </div>
          ) : null}
        </div>
      ) : null}
  {reportCards.length > 0 ? (
        <div className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
          <div style={{ marginBottom: '.5rem' }}>
            <strong>Latest reports</strong>
          </div>
          <div style={{ maxHeight: 180, overflow: 'auto' }}>
            {reportCards.map((r) => (
              <div key={r.id} className="list-row" style={{ padding: '.25rem 0' }}>
                <div>
                  <strong>{r.title || r.type}</strong>
                  <div className="muted" style={{ fontSize: '.85rem' }}>{String(r.type || '').toLowerCase() === 'weekly' ? 'Weekly' : 'Monthly'} · {r.created_at ? new Date(r.created_at).toLocaleString() : ''}</div>
                </div>
                <button type="button" className="btn-secondary" onClick={() => navigate(`/reports/${r.id}`)}>View details</button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {hasAnyContent ? (
        <>
          {visibleNotifications.length > 0 ? (
            visibleNotifications.map((item) => (
              <div key={item.id} className="list-item">
                <span>{item.message}</span>
                {!item.is_read ? <span className="chip chip-warning">New</span> : null}
              </div>
            ))
          ) : null}
        </>
        
      ) : (
        <div className="empty-state">No notifications.</div>
      )}
    </div>
  );
}
