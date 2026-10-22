import { useEffect, useMemo, useState, useContext, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { listSales, getSale } from '../services/salesService.js';
import { SettingsContext } from '../context/SettingsContext.jsx';
import { formatCurrency, formatDate } from '../utils/formatters.js';
import DetailsModal from '../components/DetailsModal.jsx';

const LIMIT = 50;

const toDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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
 * Página de histórico de vendas.
 * Permite filtrar vendas por período, pesquisar por cliente e abrir detalhes de cada transação.
 *
 * @returns {JSX.Element} Interface do histórico de vendas.
 */
export default function SalesHistory() {
  const { settings } = useContext(SettingsContext) ?? {};
  const location = useLocation();
  const initialCustomerName = new URLSearchParams(location.search).get('customerName') || '';
  const initialCustomerSearch = new URLSearchParams(location.search).get('customerSearch') || initialCustomerName;

  const [sales, setSales] = useState([]);
  const [selectedSale, setSelectedSale] = useState(null);

  const safeLocal = (fn) => {
    try {
      return fn();
    } catch {
      return null;
    }
  };

  const initialPeriod = safeLocal(() => localStorage.getItem('sales.period')) || 'weekly';
  const initialFromDraft = safeLocal(() => localStorage.getItem('sales.fromDraft')) || presetRange(initialPeriod).from;
  const initialToDraft = safeLocal(() => localStorage.getItem('sales.toDraft')) || presetRange(initialPeriod).to;
  const initialFrom = safeLocal(() => localStorage.getItem('sales.from')) || initialFromDraft;
  const initialTo = safeLocal(() => localStorage.getItem('sales.to')) || initialToDraft;

  const [period, setPeriod] = useState(initialPeriod);

  const [fromDraft, setFromDraft] = useState(initialFromDraft);
  const [toDraft, setToDraft] = useState(initialToDraft);

  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

  const [search, setSearch] = useState(initialCustomerSearch);
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSales, setTotalSales] = useState(0);

  /**
   * Carrega as vendas a partir do backend para o intervalo e pesquisa selecionados.
   *
   * @returns {Promise<void>} Promessa resolvida após o carregamento dos dados.
   */
  const load = useCallback(async () => {
    setLoading(true);

    try {
      const salesRes = await listSales({
        from: from || null,
        to: to || null,
        search: search.trim(),
        page,
        limit: LIMIT
      });

      const payload = salesRes.data ?? salesRes;

      setSales(payload.data || []);
      setTotalPages(payload.totalPages || 1);
      setTotalSales(payload.total || 0);
    } catch (error) {
      console.error('Failed to load sales:', error);
      setSales([]);
      setTotalPages(1);
      setTotalSales(0);
    } finally {
      setLoading(false);
    }
  }, [from, to, search, page]);

  const viewSaleDetails = async (saleId) => {
    try {
      setLoading(true);
      const res = await getSale(saleId);
      const payload = res.data ?? res;
      setSelectedSale(payload || null);
    } catch (err) {
      console.error('Unable to fetch sale details', err);
      setSelectedSale(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (initialCustomerSearch) {
      setSearch(initialCustomerSearch);
    }
  }, [initialCustomerSearch]);

  useEffect(() => {
    const handler = (e) => {
      try {
        setPage(1);
        // reload sales immediately
        load();
      } catch (err) {
        console.error('Error handling reservation:completed event', err);
      }
    };

    window.addEventListener('reservation:completed', handler);
    return () => window.removeEventListener('reservation:completed', handler);
  }, [load]);

  useEffect(() => {
    // persist period and date inputs so selection survives navigation
    safeLocal(() => localStorage.setItem('sales.period', period));
    safeLocal(() => localStorage.setItem('sales.fromDraft', fromDraft || ''));
    safeLocal(() => localStorage.setItem('sales.toDraft', toDraft || ''));
    safeLocal(() => localStorage.setItem('sales.from', from || ''));
    safeLocal(() => localStorage.setItem('sales.to', to || ''));
  }, [period, fromDraft, toDraft, from, to]);

  const applyPreset = (nextPeriod) => {
    setPeriod(nextPeriod);

    if (nextPeriod === 'custom') {
      if (fromDraft && toDraft) {
        setFrom(fromDraft);
        setTo(toDraft);
      }
      setPage(1);
      return;
    }

    const range = presetRange(nextPeriod);

    setFromDraft(range.from);
    setToDraft(range.to);
    setFrom(range.from);
    setTo(range.to);
    setPage(1);
  };

  const handleDateChange = (field, value) => {
    const nextFromDraft = field === 'from' ? value : fromDraft;
    const nextToDraft = field === 'to' ? value : toDraft;

    if (field === 'from') {
      setFromDraft(value);
    } else {
      setToDraft(value);
    }

    if (nextFromDraft && nextToDraft) {
      setPeriod('custom');
      setFrom(nextFromDraft);
      setTo(nextToDraft);
      setPage(1);
    }
  };

  const showCustomOption = Boolean(fromDraft && toDraft);
  const selectedItems = useMemo(() => selectedSale?.items || [], [selectedSale]);

  return (
    <div className="page-shell">
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '.75rem', marginBottom: '.75rem' }}>
          <div>
            <h1 className="page-title" style={{ fontSize: '2rem' }}>Sales History</h1>
          </div>
          <span className="nav-pill">{totalSales} sales</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr', gap: '1rem', alignItems: 'end' }}>
          <div>
            <label className="field-label">Period</label>
            <select value={period} onChange={(e) => applyPreset(e.target.value)}>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              {showCustomOption ? <option value="custom">Custom</option> : null}
            </select>
          </div>

          <div>
            <label className="field-label">From</label>
            <input
              type="date"
              value={fromDraft}
              onChange={(e) => handleDateChange('from', e.target.value)}
            />
          </div>

          <div>
            <label className="field-label">To</label>
            <input
              type="date"
              value={toDraft}
              onChange={(e) => handleDateChange('to', e.target.value)}
            />
          </div>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <label className="field-label">Search</label>
          <input
            type="text"
            placeholder="NIF, phone, email, customer, payment method..."
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
      </div>

      <div className="card table-card" style={{ marginTop: '0.25rem' }}>
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Customer</th>
              <th>Total</th>
              <th>Payment</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6">
                  <div className="empty-state" style={{ margin: '1rem 0' }}>
                    Loading sales...
                  </div>
                </td>
              </tr>
            ) : sales.length === 0 ? (
              <tr>
                <td colSpan="6">
                  <div className="empty-state" style={{ margin: '1rem 0' }}>
                    No sales found.
                  </div>
                </td>
              </tr>
            ) : (
              sales.map((sale) => (
                <tr key={sale.id}>
                  <td>#{sale.sale_number ?? '-'}</td>

                  <td>
                    <strong>{sale.customer_name || 'Walk-in customer'}</strong>
                    <div className="muted" style={{ fontSize: '.88rem', marginTop: '.25rem' }}>
                      {sale.description || 'No description available.'}
                    </div>
                  </td>

                  <td>{formatCurrency(sale.total || 0, settings?.currency, settings?.language)}</td>

                  <td>
                    <span className="chip chip-neutral">{sale.payment_method || '-'}</span>
                  </td>

                  <td>{formatDate(sale.created_at, settings?.timezone, settings?.dateFormat)}</td>

                  <td>
                    <button type="button" className="btn-secondary" onClick={() => viewSaleDetails(sale.id)}>
                      Details
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="page-actions" style={{ justifyContent: 'space-between', marginTop: '1rem' }}>
        <button
          type="button"
          className="btn-secondary"
          disabled={page === 1 || loading}
          onClick={() => setPage((prev) => prev - 1)}
        >
          Previous
        </button>

        <span className="nav-pill">
          Page {page} of {totalPages}
        </span>

        <button
          type="button"
          className="btn-secondary"
          disabled={page >= totalPages || loading}
          onClick={() => setPage((prev) => prev + 1)}
        >
          Next
        </button>
      </div>

      {selectedSale ? (
        <DetailsModal
          title={`Sale details #${selectedSale.sale_number || (selectedSale.id ? String(selectedSale.id).slice(0, 8) : '-')}`}
          subtitle={selectedSale.description || 'Sale receipt'}
          onClose={() => setSelectedSale(null)}
        >
          <div className="grid-2">
            <div className="card" style={{ padding: '1rem' }}>
              <strong>Customer</strong>
              <div style={{ marginTop: '.5rem' }}>
                {selectedSale.customer ? (
                  <div>
                    <div><strong>{selectedSale.customer.name || '—'}</strong></div>
                    <div className="muted">ID: {selectedSale.customer.id || '—'}</div>
                    <div style={{ marginTop: '.5rem' }}>
                      <div><strong>NIF:</strong> {selectedSale.customer.nif || '—'}</div>
                      <div><strong>Email:</strong> {selectedSale.customer.email ? (<a href={`mailto:${selectedSale.customer.email}`}>{selectedSale.customer.email}</a>) : '—'}</div>
                      <div><strong>Phone:</strong> {selectedSale.customer.phone ? (<a href={`tel:${selectedSale.customer.phone}`}>{selectedSale.customer.phone}</a>) : '—'}</div>
                      <div><strong>Created:</strong> {selectedSale.customer.created_at ? formatDate(selectedSale.customer.created_at, settings?.timezone, settings?.dateFormat) : '—'}</div>
                    </div>
                  </div>
                ) : (
                  <div className="muted">{selectedSale.customer_name || 'Walk-in customer'}</div>
                )}
              </div>
            </div>

            <div className="card" style={{ padding: '1rem' }}>
              <strong>Total</strong>
              <div className="muted">
                {formatCurrency(selectedSale.total || 0, settings?.currency, settings?.language)}
              </div>
              <div style={{ marginTop: '.5rem', fontSize: '.9rem' }}>
                <div><strong>Payment:</strong> {selectedSale.payment_method || '-'}</div>
                <div><strong>Date:</strong> {formatDate(selectedSale.created_at, settings?.timezone, settings?.dateFormat)}</div>
              </div>
            </div>
          </div>

            <div className="card" style={{ padding: '1rem', marginTop: '1rem' }}>
            <strong>Items sold</strong>
            <div style={{ marginTop: '.75rem' }}>
              {selectedItems.length === 0 ? (
                <div className="empty-state">No item details available.</div>
              ) : (
                selectedItems.map((item) => (
                  <div key={item.id} className="list-row">
                    <div>
                      <strong>{item.product_name}</strong>
                      <div className="muted">Quantity: {item.quantity}</div>
                    </div>
                    <div className="muted">
                      {formatCurrency(Number(item.subtotal || item.unit_price * item.quantity || 0), settings?.currency, settings?.language)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </DetailsModal>
      ) : null}
    </div>
  );
}