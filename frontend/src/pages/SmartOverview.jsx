import { useEffect, useMemo, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';


import { listReports, getDashboard } from '../services/reportService.js';
import Notifications from '../components/Notifications.jsx';
import DetailsModal from '../components/DetailsModal.jsx';
import { SettingsContext } from '../context/SettingsContext.jsx';
import { formatCurrency, formatDate, formatReportTitle } from '../utils/formatters.js';


const AVAILABILITY_COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#6b7280'];

/**
 * Converte uma data para o formato aceito por inputs do tipo date.
 *
 * @param {Date} date Data a ser convertida.
 * @returns {string} Data no formato yyyy-mm-dd.
 */
const toDateInput = (date) => date.toISOString().slice(0, 10);

/**
 * Gera um intervalo de datas predefinido com base no período desejado.
 *
 * @param {string} period Período de tempo para o filtro.
 * @returns {{from: string, to: string}} Intervalo de datas em formato yyyy-mm-dd.
 */
const presetRange = (period) => {
  const end = new Date();
  const start = new Date();
  // Subtrai (dias - 1) para que o intervalo [from, to] tenha exatamente N dias
  // corridos (inclusive), na mesma convenção usada pelo backend em
  // resolvePeriodWindow()/PERIOD_DAYS. Antes disto, o "weekly" cobria 8 dias
  // e o "monthly" normalmente 31, inflacionando todas as métricas do
  // dashboard (Most Popular products, Total Sales, etc).
  if (period === 'monthly') start.setDate(start.getDate() - 29); // 30 dias
  else if (period === 'yearly') start.setDate(start.getDate() - 364); // 365 dias
  else if (period === 'custom') start.setFullYear(1970); // treat custom as all-time by default
  else start.setDate(start.getDate() - 6); // 7 dias
  return { from: toDateInput(start), to: toDateInput(end) };
};

/**
 * Página de overview inteligente.
 * Apresenta métricas, tendências de vendas e alertas de disponibilidade para o usuário.
 *
 * @returns {JSX.Element} Interface de resumo executivo da aplicação.
 */
export default function SmartOverview() {
  
  const [stats, setStats] = useState({
    salesCount: 0,
    totalSales: 0,
    averageTicket: 0,
    topProducts: [],
    topProfitProducts: [],
    criticalAvailabilityItems: [],
    lowAvailabilityItems: [],
    stockForecast: [],
    salesTrend: [],
  });
  useEffect(() => {

}, [stats]);
  const [showCriticalStockDetails, setShowCriticalStockDetails] = useState(false);
  const [showLowstockDetails, setShowLowstockDetails] = useState(false);
  const [period, setPeriod] = useState('weekly');
  const [from, setFrom] = useState(() => presetRange('weekly').from);
  const [to, setTo] = useState(() => presetRange('weekly').to);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { settings } = useContext(SettingsContext);
  const navigate = useNavigate();

  const [latestReports, setLatestReports] = useState({ weekly: null, monthly: null });


  const load = async (range = { from, to }, nextPeriod = period) => {
    setLoading(true);
    setError('');
    try {
      const params = nextPeriod === 'custom'
        ? { period: 'weekly', from: range.from, to: range.to }
        : { period: nextPeriod, from: range.from, to: range.to };
      const res = await getDashboard(params);


      setStats({
        salesCount: res.data?.salesCount ?? 0,
        totalSales: res.data?.totalSales ?? 0,
        averageTicket: res.data?.averageTicket ?? 0,
        topProducts: res.data?.topProducts ?? [],
        topProfitProducts: res.data?.topProfitProducts ?? [],
        criticalAvailabilityItems: res.data?.criticalAvailabilityItems ?? [],
        stockForecast: res.data?.stockForecast ?? [],
        lowAvailabilityItems: res.data?.lowAvailabilityItems ?? [],
        salesTrend: res.data?.salesTrend ?? [],
      });
    } catch {
      setError('Unable to load dashboard data.');
      setStats({
        salesCount: 0,
        totalSales: 0,
        averageTicket: 0,
        topProducts: [],
        topProfitProducts: [],
        lowAvailabilityItems: [],
        criticalAvailabilityItems: [],
        stockForecast: [],
        salesTrend: [],
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const loadLatestReports = async () => {
      try {
        const res = await listReports();
        const reports = res.data || [];
        const sorted = reports.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const latestMonthly = sorted.find((r) => String(r.type).toLowerCase() === 'monthly') || null;
        const latestWeekly = sorted.find((r) => String(r.type).toLowerCase() === 'weekly') || null;
        setLatestReports({ monthly: latestMonthly, weekly: latestWeekly });
      } catch (err) {
        setLatestReports({ monthly: null, weekly: null });
      }
    };

    loadLatestReports();
  }, []);

  // Reload data when period or dates change
  useEffect(() => {
    load({ from, to }, period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, from, to]);

  const applyPreset = (nextPeriod) => {
    setPeriod(nextPeriod);
    if (nextPeriod === 'custom') {
      load({ from, to }, 'custom');
      return;
    }
    const range = presetRange(nextPeriod);
    setFrom(range.from);
    setTo(range.to);
    load(range, nextPeriod);
  };

  const applyCustom = () => {
    setPeriod('custom');
    load({ from, to }, 'custom');
  };

  const resetWeekly = () => applyPreset('weekly');

  const salesTrendData = useMemo(
    () => (stats.salesTrend || []).map((item) => ({ date: item.date, total: Number(item.total || 0) })),
    [stats.salesTrend]
  );


  const topProductsData = useMemo(
    () => (stats.topProducts || []).map((item) => ({ name: item.name, sold_quantity: Number(item.sold_quantity || 0) })),
    [stats.topProducts]
  );

const lowStockAlerts = stats.lowAvailabilityItems ?? [];

const availabilityStatusData = useMemo(() => {

  const totals = {
    healthy: 0,
    low: 0,
    critical: 0,
    out_of_stock: 0,
  };

  (stats.stockForecast || []).forEach((item) => {
    const risk = String(item.risk_level || 'healthy');

    if (totals[risk] !== undefined) {
      totals[risk]++;
    }
  });

  return [
    {
      name: 'Healthy',
      value: totals.healthy,
    },
     {
      name: 'Low',
      value: totals.low,
    },
    {
      name: 'Critical',
      value: totals.critical,
    },
    {
      name: 'Unavailable',
      value: totals.out_of_stock,
    },
  ];

}, [stats.stockForecast]);

  const topProfitProductsData = useMemo(() => {
    const items = Array.isArray(stats.topProfitProducts) ? stats.topProfitProducts : [];
    return items.slice(0, 6).map((item) => ({
      name: item?.name || 'Product',
      grossProfit: Number(item?.grossProfit || 0),
      marginRate: Number(item?.marginRate || 0),
    }));
  }, [stats.topProfitProducts]);
if (showLowstockDetails) {
  console.table(
    lowStockAlerts.map(item => ({
      name: item.name || item.product_name,
      risk: item.risk_level,
      days: item.days_to_stockout,
      lead: item.supplier_lead_time,
    }))
  );
}
  return (
    <div className="page-shell">
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="page-header">
          <div>
            <h1 className="page-title">Smart Overview</h1>
            <p className="page-subtitle">A clear view of sales, stock alerts, and your most active products.</p>
          </div>
        </div>

        <div className="form-columns-2" style={{ alignItems: 'end', marginTop: '1rem' }}>
          <div>
            <label className="field-label">Period</label>
            <select value={period} onChange={(e) => applyPreset(e.target.value)}>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div className="form-columns-2">
            <div>
              <label className="field-label">From</label>
              <input type="date" value={from} onChange={(e) => { setPeriod('custom'); setFrom(e.target.value); }} />
            </div>
            <div>
              <label className="field-label">To</label>
              <input type="date" value={to} onChange={(e) => { setPeriod('custom'); setTo(e.target.value); }} />
            </div>
          </div>
        </div>

        {loading ? <p className="muted" style={{ marginTop: '.75rem' }}>Loading dashboard data...</p> : null}
        {error ? <p className="muted" style={{ marginTop: '.75rem' }}>{error}</p> : null}
      </div>

      <section className="stats-grid">
        <div className="card stat-card">
          <span className="stat-label">Sales</span>
          <span className="stat-value">{stats.salesCount}</span>
          <span className="stat-foot">Recorded transactions</span>
        </div>

        <div className="card stat-card">
          <span className="stat-label">Revenue</span>
          <span className="stat-value">{formatCurrency(stats.totalSales, settings.currency, settings.language)}</span>
          <span className="stat-foot">Total accumulated</span>
        </div>

        <div className="card stat-card">
          <span className="stat-label">Average ticket</span>
          <span className="stat-value">{formatCurrency(stats.averageTicket, settings.currency, settings.language)}</span>
          <span className="stat-foot">Per sale</span>
        </div>

        <div className="card stat-card">
          <span className="stat-label">Critical Stock alerts</span>
          <span className="stat-value">{stats.criticalAvailabilityItems.length}</span>
          <span className="stat-foot">Items below minimum</span>
          <button type="button" className="btn-secondary" onClick={() => setShowCriticalStockDetails(true)} style={{ marginTop: '.35rem' }}>
            View details
          </button>
        </div>
      </section>

      <div className="grid-2">
        <div className="page-stack">
          <div className="card" style={{ minHeight: 360 }}>
            <h3 className="chart-title">Revenue trend</h3>
            {salesTrendData.length === 0 ? (
              <div className="empty-state" style={{ marginTop: '.8rem' }}>No sales data yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={salesTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="total" stroke="#2563eb" fill="#dbeafe" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="card" style={{ minHeight: 280 }}>
            <h3 className="chart-title">Top profit products</h3>
            {topProfitProductsData.length === 0 ? (
              <div className="empty-state" style={{ marginTop: '.8rem' }}>No profit data yet.</div>
            ) : (
              <div className="page-stack" style={{ marginTop: '.8rem' }}>
                {topProfitProductsData.map((item) => (
                  <div key={item.name} className="list-row">
                    <div>
                      <strong>{item.name}</strong>
                      <div className="muted" style={{ fontSize: '.88rem' }}>Margin: {item.marginRate.toFixed(1)}%</div>
                    </div>
                    <span className="chip chip-success">{formatCurrency(item.grossProfit, settings.currency, settings.language)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <Notifications
          criticalAvailabilityItems={stats.criticalAvailabilityItems}
          lowAvailabilityItems={stats.lowAvailabilityItems}
          onViewCriticalStock={() => setShowCriticalStockDetails(true)}
          onViewLowStock={() => setShowLowstockDetails(true)}
        />
      </div>

      <div className="grid-2">
        <div className="card" style={{ minHeight: 360 }}>
          <h3 className="chart-title">Most Popular products</h3>
          {topProductsData.length === 0 ? (
            <div className="empty-state" style={{ marginTop: '.8rem' }}>No product data yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topProductsData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={120} />
                <Tooltip />
                <Bar dataKey="sold_quantity" fill="#0f766e" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card" style={{ minHeight: 360 }}>
          <h3 className="chart-title">Stock status</h3>
          {availabilityStatusData.every((item) => item.value === 0) ? (
            <div className="empty-state" style={{ marginTop: '.8rem' }}>No stock data yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={availabilityStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {availabilityStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={AVAILABILITY_COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {showCriticalStockDetails ? (
        <DetailsModal
          title="Critical stock details"
          subtitle="Complete list of products currently at or below minimum level."
          onClose={() => setShowCriticalStockDetails(false)}
        >
          {stats.criticalAvailabilityItems.length === 0 ? (
            <div className="empty-state">No critical stock products right now.</div>
          ) : (
            <div className="page-stack">
              <div className="page-actions" style={{ justifyContent: 'flex-end' }}>
              </div>
              {stats.criticalAvailabilityItems.map((item) => (
                <div key={item.id} className="list-row">
                  <div>
                    <strong>{item.name}</strong>
                    <div className="muted">Reserved: {item.reserved_quantity}</div>
                  </div>
                  <span className="chip chip-danger">{item.available_stock ?? (item.quantity - item.reserved_quantity)} left</span>
                </div>
              ))}
            </div>
          )}
          <div className="page-actions" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button type="button" className="btn" onClick={() => navigate('/supplier-orders')}>Open supplier orders</button>
          </div>
        </DetailsModal>
      ) : null}

{showLowstockDetails ? (
  <DetailsModal
    title="Low Stock details"
    subtitle="Products that need replenishment soon based on projected stockout timing and supplier lead time."
    onClose={() => setShowLowstockDetails(false)}
  >
    {lowStockAlerts.length === 0 ? (
  <div className="empty-state">No low stock alerts right now.</div>
) : (
  <div className="page-stack">
   {lowStockAlerts.map((item) => (
      <div key={item.id || item.product_id} className="list-row">
        <div>
          <strong>{item.name || item.product_name}</strong>
          <div className="muted">
            {Number(item.days_to_stockout).toFixed(1)} days to stockout
          </div>
          <div className="muted">
            Lead time: {item.supplier_lead_time || item.supplierLeadTime} days
          </div>
        </div>
        <span className="chip chip-warning">WARNING</span>
      </div>
    ))}
  </div>
)}

    <div className="page-actions" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
      <button type="button" className="btn" onClick={() => navigate('/supplier-orders')}>
        Open supplier orders
      </button>
    </div>
  </DetailsModal>
) : null}
    </div>
  );
}
