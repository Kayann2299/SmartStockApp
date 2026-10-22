import { useContext, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getReportDetails, listReports } from '../services/reportService.js';
import DetailsModal from '../components/DetailsModal.jsx';
import { SettingsContext } from '../context/SettingsContext.jsx';
import { formatDate, formatReportTitle } from '../utils/formatters.js';

const toDateInput = (date) => date.toISOString().slice(0, 10);
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
 * Página de relatórios e resumos automáticos.
 * Exibe relatórios gerados em diferentes períodos e permite abrir detalhes de análise.
 *
 * @returns {JSX.Element} Interface de visualização de relatórios da aplicação.
 */
export default function Reports() {
  const { settings } = useContext(SettingsContext);
  const { id: openId } = useParams();
  const [reports, setReports] = useState([]);
  const [status, setStatus] = useState('');
  const [period, setPeriod] = useState('weekly');
  const [from, setFrom] = useState(() => presetRange('weekly').from);
  const [to, setTo] = useState(() => presetRange('weekly').to);
  const [reportType, setReportType] = useState('all');
  const [selectedReport, setSelectedReport] = useState(null);
  const [details, setDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  /**
   * Carrega a lista de relatórios com base no período e tipo selecionados.
   *
   * @param {Object} [range={ from, to }] Intervalo de datas para consulta.
   * @param {string} [type=reportType] Tipo de relatório a ser filtrado.
   * @returns {Promise<void>} Promessa resolvida após o carregamento dos dados.
   */
  const load = async (range = { from, to }, type = reportType) => {
    try {
      const params = { ...range };
      if (type && type !== 'all') params.type = type;
      const res = await listReports(params);
      setReports(res.data || []);
    } catch {
      setReports([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!openId) return;
    const found = reports.find((r) => String(r.id) === String(openId));
    if (found) {
      openDetails(found);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, reports]);

  const applyPreset = (nextPeriod) => {
    setPeriod(nextPeriod);
    const range = presetRange(nextPeriod);
    setFrom(range.from);
    setTo(range.to);
    load(range, reportType);
  };

  const applyCustom = () => load({ from, to });
  const reset = () => applyPreset('weekly');

  const sorted = useMemo(() => reports.slice().sort((a, b) => new Date(b.period_end || b.period_start || b.created_at) - new Date(a.period_end || a.period_start || a.created_at)), [reports]);
  const filtered = useMemo(() => (reportType === 'all' ? sorted : sorted.filter((r) => String(r.type) === String(reportType))), [sorted, reportType]);
  const hasData = filtered.length > 0;

  const openDetails = async (report) => {
    setSelectedReport(report);
    setLoadingDetails(true);
    setDetails(null);
    try {
      const res = await getReportDetails(report.id);
      setDetails(res.data);
    } finally {
      setLoadingDetails(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="page-header">
          <div>
            <h1 className="page-title">Reports</h1>
            <p className="page-subtitle">Weekly and monthly AI-assisted summaries with a detailed view for each report.</p>
          </div>
          <div className="page-actions">
            <span className="nav-pill">{filtered.length} reports</span>
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
          <div>
            <label className="field-label">Type</label>
            <select value={reportType} onChange={(e) => { setReportType(e.target.value); load({ from, to }, e.target.value); }}>
              <option value="all">All</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
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
      </div>

      {!hasData ? (
        <div className="card empty-state">
          <h3 style={{ marginTop: 0 }}>No reports yet</h3>
          <p style={{ marginBottom: 0 }}>Once sales, reservations, or product updates are recorded, this area will show weekly and monthly summaries.</p>
        </div>
      ) : (
        <div className="grid-2">
          {filtered.map((report) => (
            <div key={report.id} className="card">
              <div className="page-header" style={{ marginBottom: '.75rem' }}>
                <div>
                  <h3 className="chart-title" style={{ marginBottom: '.15rem' }}>{formatReportTitle(report.title, settings?.timezone, settings?.dateFormat) || (report.type ? `${report.type.toUpperCase()} REPORT` : 'Report')}</h3>
                  <p className="muted" style={{ margin: 0 }}>Created at - {report.created_at ? formatDate(report.created_at, settings?.timezone, settings?.dateFormat) : ''}</p>
                </div>
                <span className="chip chip-neutral">{report.ai_generated ? 'AI summary' : 'Manual'}</span>
              </div>
              <div className="page-stack" style={{ marginTop: '.5rem' }}>
                <div className="muted" style={{ fontSize: '.9rem' }}>Summary</div>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: 'inherit', fontSize: '.9rem', lineHeight: 1.35 }}>{report.content || 'No summary available.'}</pre>
              </div>
              <div className="page-actions" style={{ marginTop: '1rem' }}>
                <button type="button" className="btn-secondary" onClick={() => openDetails(report)}>View details</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedReport ? (
        <DetailsModal
          title={selectedReport.title || selectedReport.type}
          subtitle={selectedReport.period_start && selectedReport.period_end ? `${formatDate(selectedReport.period_start, settings?.timezone, settings?.dateFormat)} → ${formatDate(selectedReport.period_end, settings?.timezone, settings?.dateFormat)}` : 'AI analysis'}
          onClose={() => {
            setSelectedReport(null);
            setDetails(null);
          }}
        >
          {loadingDetails ? (
            <div className="empty-state">Loading details...</div>
          ) : details ? (
            <div className="page-stack">
              <div className="card" style={{ padding: '1rem' }}>
                <strong>AI analysis</strong>
                <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: '.5rem 0 0', color: 'inherit' }}>{details.details || details.summary || 'No analysis available.'}</pre>
              </div>
              <div className="grid-2">
                <div className="card" style={{ padding: '1rem' }}>
                  <strong>Top products</strong>
                  <div className="page-stack" style={{ marginTop: '.75rem' }}>
                    {(details.stats?.topProducts || []).length === 0 ? <div className="empty-state">No data.</div> : details.stats.topProducts.map((item) => (
                      <div key={item.id} className="list-item">
                        <span>{item.name}</span>
                        <strong>{Number(item.sold_quantity || 0)} sold</strong>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="card" style={{ padding: '1rem' }}>
                  <strong>Profit leaders</strong>
                  <div className="page-stack" style={{ marginTop: '.75rem' }}>
                    {(details.stats?.topProfitProducts || []).length === 0 ? <div className="empty-state">No data.</div> : details.stats.topProfitProducts.map((item) => (
                      <div key={item.id} className="list-item">
                        <span>{item.name}</span>
                        <span className={`chip ${Number(item.grossProfit || 0) >= 0 ? 'chip-success' : 'chip-danger'}`}>
                          {Number(item.grossProfit || 0).toFixed(2)} €
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="card" style={{ padding: '1rem' }}>
                <strong>Stock forecast</strong>
                <div className="page-stack" style={{ marginTop: '.75rem' }}>
                  {(details.stats?.stockForecast || []).filter((item) => item.risk_level !== 'healthy' && item.days_to_stockout !== null).length === 0 ? (
                    <div className="empty-state">No actionable forecast alerts.</div>
                  ) : (details.stats?.stockForecast || []).filter((item) => item.risk_level !== 'healthy' && item.days_to_stockout !== null).slice(0, 5).map((item) => (
                    <div key={item.id} className="list-item">
                      <div>
                        <strong>{item.name}</strong>
                        <div className="muted" style={{ fontSize: '.88rem' }}>
                          Risk: {item.lead_time_alert ? 'lead time' : item.risk_level} · Forecast: {item.days_to_stockout === null ? 'n/a' : `${Number(item.days_to_stockout).toFixed(1)} days`}
                          {item.projected_stock !== undefined ? ` · Projected stock: ${Number(item.projected_stock || 0)}` : ''}
                          {item.recommended_reorder !== undefined ? ` · Reorder: ${item.recommended_reorder > 0 ? Number(item.recommended_reorder) : 'none'}` : ''}
                          {item.supplier_lead_time ? ` · Lead time: ${item.supplier_lead_time} days` : ''}
                          {item.min_level !== undefined ? ` · Min level: ${Number(item.min_level || 0)}` : ''}
                        </div>
                      </div>
                      <span className={`chip ${item.risk_level === 'critical' ? 'chip-danger' : item.risk_level === 'warning' ? 'chip-warning' : 'chip-neutral'}`}>
                        {Number(item.quantity || 0)} in stock
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state">No details available.</div>
          )}
        </DetailsModal>
      ) : null}

      {status ? <p className="muted">{status}</p> : null}
    </div>
  );
}
