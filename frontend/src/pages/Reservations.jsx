import { useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { formatCurrency, formatDate } from '../utils/formatters.js';
import { AuthContext } from '../context/AuthContext.jsx';
import { listProducts } from '../services/productService.js';
import { listCustomers } from '../services/customerService.js';
import { listReservations, createReservation, completeReservation, updateReservationStatus } from '../services/reservationService.js';
import { SettingsContext } from '../context/SettingsContext.jsx';
import ReservationList from '../components/ReservationList.jsx';
import DetailsModal from '../components/DetailsModal.jsx';

const emptyNewCustomer = { name: '', nif: '', email: '', phone: '' };

/**
 * Página de gestão de reservas.
 * Permite criar reservas, associar clientes e produtos, concluir vendas e cancelar pedidos.
 *
 * @returns {JSX.Element} Interface de reservas da aplicação.
 */
export default function Reservations() {
  const location = useLocation();
  const { user } = useContext(AuthContext);
  const initialCustomerName = new URLSearchParams(location.search).get('customerName') || '';
  const initialCustomerSearch = new URLSearchParams(location.search).get('customerSearch') || initialCustomerName;

  const [reservations, setReservations] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [customerMode, setCustomerMode] = useState('existing');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [newCustomer, setNewCustomer] = useState(emptyNewCustomer);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [items, setItems] = useState([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [search, setSearch] = useState(initialCustomerSearch);
  const [statusFilter, setStatusFilter] = useState('ongoing');
  const [loading, setLoading] = useState(false);
  const canManageReservations = ['admin', 'manager'].includes(user?.role);

 /**
  * Carrega as reservas, produtos e clientes necessários para renderizar a tela.
  *
  * @returns {Promise<void>} Promessa resolvida após o carregamento dos dados.
  */
 const load = async () => {
  setLoading(true);

  try {
    const [reservationsRes, productsRes, customersRes] = await Promise.all([
      listReservations(),
      listProducts(),
      listCustomers()
    ]);

    setReservations(reservationsRes.data || []);
    setProducts(productsRes.data || []);
    setCustomers(customersRes.data || []);
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (initialCustomerSearch) {
      setSearch(initialCustomerSearch);
    }
  }, [initialCustomerSearch]);

  const selectedProduct = useMemo(() => products.find((product) => String(product.id) === String(selectedProductId)), [products, selectedProductId]);

  const addItem = () => {
    if (!selectedProductId || Number(quantity) <= 0) return;
    setItems((current) => {
      const existing = current.find((item) => String(item.product_id) === String(selectedProductId));
      if (existing) {
        return current.map((item) => item.product_id === selectedProductId
          ? { ...item, quantity: Number(item.quantity) + Number(quantity) }
          : item);
      }
      return [...current, { product_id: selectedProductId, product_name: selectedProduct?.name || 'Product', quantity: Number(quantity) }];
    });
    setSelectedProductId('');
    setQuantity(1);
  };

  const removeItem = (productId) => setItems((current) => current.filter((item) => item.product_id !== productId));

  const resetModal = () => {
    setShowModal(false);
    setCustomerMode('existing');
    setSelectedCustomerId('');
    setNewCustomer(emptyNewCustomer);
    setSelectedProductId('');
    setQuantity(1);
    setItems([]);
    setStatusMessage('');
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        items,
        customer_id: customerMode === 'existing' ? selectedCustomerId : null,
        newCustomer: customerMode === 'new' ? newCustomer : null
      };
      await createReservation(payload);
      setStatusMessage('Reservation created successfully.');
      await load();
      resetModal();
    } catch (error) {
      setStatusMessage(error.response?.data?.message || 'Unable to create reservation.');
    }
  };

  const completeReservationAction = async (reservation) => {
    setSelectedReservationForComplete(reservation);
    setCompletePaymentMethod('cash');
    setShowCompleteModal(true);
    setCustomerModeComplete('use_reservation');
    setSelectedCustomerIdForComplete(reservation.customer_id || '');
  };

  const markReady = async (reservation) => {
    try {
      setLoading(true);
      const res = await updateReservationStatus(reservation.id, {
        status: 'contacted'
      });
      const updatedReservation = res?.data || res;
      setStatusMessage(`Contact attempt sent for ${reservation.customer_name || 'this customer'}.`);
      setReservations((current) => current.map((item) => String(item.id) === String(reservation.id) ? { ...item, ...updatedReservation } : item));
    } catch (error) {
      setStatusMessage(error.response?.data?.message || 'Unable to contact customer.');
    } finally {
      setLoading(false);
    }
  };

  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [selectedReservationForComplete, setSelectedReservationForComplete] = useState(null);
  const [completePaymentMethod, setCompletePaymentMethod] = useState('cash');
  const [completeLoading, setCompleteLoading] = useState(false);
  const [completeError, setCompleteError] = useState('');
  const [customerModeComplete, setCustomerModeComplete] = useState('use_reservation');
  const [selectedCustomerIdForComplete, setSelectedCustomerIdForComplete] = useState('');

  const confirmComplete = async () => {
    if (!selectedReservationForComplete) return;
    setCompleteLoading(true);
    setCompleteError('');
    try {
      const payload = { status: 'completed', paymentMethod: completePaymentMethod };
      if (customerModeComplete === 'existing') {
        if (selectedCustomerIdForComplete) payload.customer_id = selectedCustomerIdForComplete;
      } 
      const res = await completeReservation(selectedReservationForComplete.id, payload);
      const saleId = res?.data?.linkedSale?.id || res?.data?.completed_sale_id || res?.completed_sale_id || null;
      try {
        window.dispatchEvent(new CustomEvent('reservation:completed', { detail: { saleId } }));
      } catch (e) {
        // ignore if dispatch fails in some environments
      }
      setStatusMessage('Reservation completed and transferred to sales.');
      setShowCompleteModal(false);
      setSelectedReservationForComplete(null);
      await load();
    } catch (error) {
      setCompleteError(error.response?.data?.message || 'Unable to complete reservation.');
    } finally {
      setCompleteLoading(false);
    }
  };


  const handleCancelReservation = async () => {
    if (!selectedReservation) return;
    try {
      setLoading(true);
      await updateReservationStatus(selectedReservation.id, { status: 'cancelled' });
      setStatusMessage('Reservation cancelled successfully.');
      setSelectedReservation(null);
      await load();
    } catch (error) {
      setStatusMessage(error.response?.data?.message || 'Unable to cancel reservation.');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = items.length > 0 && ((customerMode === 'existing' && selectedCustomerId) || (customerMode === 'new' && newCustomer.name.trim() && (newCustomer.email.trim() || newCustomer.phone.trim())));

  const filteredReservations = reservations.filter((reservation) => {
    const query = search.trim().toLowerCase();
    const normalizedStatus = String(reservation.status || 'pending').toLowerCase();
    const matchesStatus =
      statusFilter === 'all' ||
      normalizedStatus === statusFilter ||
      (statusFilter === 'ongoing' && ['ready', 'contacted','pending'].includes(normalizedStatus));

    if (!query) {
      return matchesStatus;
    }

    const customer = customers.find((item) => String(item.id) === String(reservation.customer_id));
    const searchableValues = [
      reservation.customer_name,
      reservation.customer_email,
      reservation.customer_phone,
      customer?.nif,
      customer?.phone,
      customer?.email,
      customer?.name
    ];

    const normalizedQuery = query.replace(/[^a-z0-9]/g, '');
    const matchesSearch = searchableValues.some((value) => {
      const normalizedValue = String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!normalizedValue) return false;
      if (/^\d+$/.test(normalizedQuery)) {
        return normalizedValue.startsWith(normalizedQuery);
      }
      return normalizedValue.includes(normalizedQuery);
    });

    return matchesSearch && matchesStatus;
  });
  return (
    <div className="page-shell">

<div className="card" style={{ marginBottom: '1rem', padding: '1rem 1.25rem' }}>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
    <h1 className="chart-title" style={{ margin: 0, fontSize: '2rem' }}>Reservations</h1>
  </div>

  <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center', marginTop: '.85rem', flexWrap: 'wrap' }}>
    <input
      type="text"
      placeholder="Search reservations..."
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      className="toolbar-search"
      style={{ flex: '1 1 260px', minWidth: '220px', height: '2.7rem' }}
    />

    <select
      value={statusFilter}
      onChange={(e) => setStatusFilter(e.target.value)}
      style={{ flex: '1 1 260px', minWidth: '220px', height: '2.7rem', padding: '.45rem .6rem', borderRadius: '8px', border: '1px solid #d6dbe2' }}
    >
      <option value="all">All</option>
      <option value="pending">Pending</option>
      <option value="ready">Ready</option>
      <option value="contacted">Contacted</option>
      <option value="ongoing">Ongoing</option>
      <option value="completed">Completed</option>
      <option value="cancelled">Cancelled</option>
    </select>

    <button type="button" onClick={() => setShowModal(true)} style={{ height: '2.7rem', whiteSpace: 'nowrap' }}>+ New reservation</button>
  </div>
</div>

      <section className="stats-grid">
        <div className="card stat-card"><span className="stat-label">Pending</span><span className="stat-value">{reservations.filter((r) => String(r.status).toLowerCase() === 'pending').length}</span><span className="stat-foot">Waiting for stock allocation</span></div>
        <div className="card stat-card"><span className="stat-label">Ready</span><span className="stat-value">{reservations.filter((r) => String(r.status).toLowerCase() === 'ready').length}</span><span className="stat-foot">Ready to contact client</span></div>
        <div className="card stat-card"><span className="stat-label">Contacted</span><span className="stat-value">{reservations.filter((r) => String(r.status).toLowerCase() === 'contacted').length}</span><span className="stat-foot">Customer contacted</span></div>
        <div className="card stat-card"><span className="stat-label">Total</span><span className="stat-value">{reservations.length}</span><span className="stat-foot">Registered reservations</span></div>
      </section>

      <ReservationList
        reservations={filteredReservations}
        onViewDetails={canManageReservations ? setSelectedReservation : null}
        onCompleteReservation={completeReservationAction}
        onMarkReady={markReady}
        canManageReservations={canManageReservations}
      />

      {statusMessage ? <p className="muted">{statusMessage}</p> : null}

      {selectedReservation ? (
        <DetailsModal
          title="Reservation details"
          subtitle={selectedReservation.description || 'Reservation summary'}
          onClose={() => setSelectedReservation(null)}
        >
          <div className="grid-2">
            <div className="card" style={{ padding: '1rem' }}>
              <strong>Customer</strong>
              <div className="muted">{selectedReservation.customer_name || 'Customer'}</div>
              <div className="muted" style={{ fontSize: '.88rem' }}>NIF: {customers.find((item) => String(item.id) === String(selectedReservation.customer_id))?.nif || '—'}</div>
              <div className="muted" style={{ fontSize: '.88rem' }}>Email: {selectedReservation.customer_email || customers.find((item) => String(item.id) === String(selectedReservation.customer_id))?.email || '—'}</div>
              <div className="muted" style={{ fontSize: '.88rem' }}>Phone: {selectedReservation.customer_phone || customers.find((item) => String(item.id) === String(selectedReservation.customer_id))?.phone || '—'}</div>
            </div>
            <div className="card" style={{ padding: '1rem' }}>
              <strong>Status</strong>
              <div className="muted">{selectedReservation.status}</div>
              {selectedReservation.completed_sale_id ? (
                <div className="muted" style={{ fontSize: '.88rem' }}>Transferred to sale {selectedReservation.completed_sale_id.slice(0, 8)}</div>
              ) : null}
            </div>
          </div>

          <div style={{ marginTop: '.75rem' }}>
            <strong>Created</strong>
            <div className="muted">{formatDate(selectedReservation.created_at)}</div>
            {selectedReservation.completed_at ? (
              <>
                <strong style={{ marginTop: '.5rem', display: 'block' }}>Completed</strong>
                <div className="muted">{formatDate(selectedReservation.completed_at)}</div>
              </>
            ) : null}
          </div>

          <div style={{ marginTop: '.75rem' }}>
            <strong>Total</strong>
            <div className="muted">{formatCurrency((selectedReservation.items || []).reduce((sum, it) => {
              const prod = products.find((p) => String(p.id) === String(it.product_id));
              const price = Number(prod?.price_sell || 0);
              return sum + price * Number(it.quantity || 0);
            }, 0), 'EUR')}</div>
          </div>

          <div className="card" style={{ padding: '1rem' }}>
            <strong>Items reserved</strong>
            <div style={{ marginTop: '.75rem' }}>
              {(selectedReservation.items || []).length === 0 ? (
                <div className="empty-state">No item details available.</div>
              ) : selectedReservation.items.map((item) => {
                const product = products.find((p) => String(p.id) === String(item.product_id));
                const totalAvailable = Number(product?.quantity || 0);
                const reservedCount = Number(product?.reserved_quantity || 0);
                const availableAfterReserved = Math.max(0, totalAvailable - reservedCount);
                return (
                  <div key={`${item.product_id}-${item.quantity}`} className="list-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                    <div>
                      <strong>{item.product_name}</strong>
                      <div className="muted">Quantity reserved: {item.quantity}</div>
                    </div>
                    <div className="muted" style={{ fontSize: '.85rem', marginTop: '.35rem' }}>
                      In stock: {totalAvailable} · Reserved total: {reservedCount} · Available after reserved: {availableAfterReserved}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </DetailsModal>
      ) : null}

      {showModal ? (
        <div className="modal-backdrop" onClick={resetModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">New reservation</h2>
                <p className="inline-help">Assign products to a customer in one flow.</p>
              </div>
              <button className="close-btn" type="button" onClick={resetModal}>×</button>
            </div>
            <form onSubmit={submit}>
              <div className="modal-body form-grid">
                <div className="form-columns-2">
                  <div>
                    <label className="field-label">Customer mode</label>
                    <select value={customerMode} onChange={(e) => setCustomerMode(e.target.value)}>
                      <option value="existing">Use existing customer</option>
                      <option value="new">Create new customer</option>
                    </select>
                  </div>
                  {customerMode === 'existing' ? (
                    <div>
                      <label className="field-label">Saved customer</label>
                      <select value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)}>
                        <option value="">Select a customer</option>
                        {customers.map((customer) => (
                          <option key={customer.id} value={customer.id}>{customer.name}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="field-label">New customer name</label>
                      <input value={newCustomer.name} onChange={(e) => setNewCustomer((p) => ({ ...p, name: e.target.value }))} placeholder="Customer name" />
                    </div>
                  )}
                </div>

                {customerMode === 'new' ? (
                  <>
                    <div>
                      <label className="field-label">NIF (Tax ID)</label>
                      <input value={newCustomer.nif} onChange={(e) => setNewCustomer((p) => ({ ...p, nif: e.target.value }))} placeholder="Tax ID" />
                    </div>
                    <div className="form-columns-2">
                      <div>
                        <label className="field-label">Email</label>
                        <input value={newCustomer.email} onChange={(e) => setNewCustomer((p) => ({ ...p, email: e.target.value }))} placeholder="email@example.com" />
                      </div>
                      <div>
                        <label className="field-label">Phone</label>
                        <input value={newCustomer.phone} onChange={(e) => setNewCustomer((p) => ({ ...p, phone: e.target.value }))} placeholder="+351..." />
                      </div>
                    </div>
                  </>
                ) : null}

                <div className="form-columns-2">
                  <div>
                    <label className="field-label">Product</label>
                    <select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)}>
                      <option value="">Select a product</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>{product.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Quantity</label>
                    <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
                  </div>
                </div>
                <button className="btn-secondary" type="button" onClick={addItem}>Add item</button>

                <div className="card" style={{ padding: '1rem' }}>
                  <h3 className="chart-title">Reservation items</h3>
                  {items.length === 0 ? (
                    <div className="empty-state" style={{ marginTop: '.6rem' }}>Add at least one item.</div>
                  ) : items.map((item) => (
                    <div key={item.product_id} className="list-row">
                      <div>
                        <strong>{item.product_name}</strong>
                        <div className="muted">Quantity: {item.quantity}</div>
                      </div>
                      <button type="button" className="btn-ghost" onClick={() => removeItem(item.product_id)}>Remove</button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn-secondary" type="button" onClick={resetModal}>Cancel</button>
                <button type="submit" disabled={!canSubmit}>Create reservation</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showCompleteModal && selectedReservationForComplete ? (
        <DetailsModal
          title="Complete reservation"
          subtitle={`Reservation #${selectedReservationForComplete.id} · ${selectedReservationForComplete.customer_name || 'Customer'}`}
          onClose={() => { setShowCompleteModal(false); setSelectedReservationForComplete(null); setCompleteError(''); }}
        >
 
                     <div>
            <div style={{ marginBottom: '.5rem' }}>
              <strong>Customer</strong>
              <div className="muted">{selectedReservationForComplete.customer_name || 'Customer'}</div>
              <div className="muted" style={{ fontSize: '.88rem' }}>NIF: {customers.find((item) => String(item.id) === String(selectedReservationForComplete.customer_id))?.nif || '—'}</div>
              <div className="muted" style={{ fontSize: '.88rem' }}>Email: {selectedReservationForComplete.customer_email || customers.find((item) => String(item.id) === String(selectedReservationForComplete.customer_id))?.email || '—'}</div>
              <div className="muted" style={{ fontSize: '.88rem' }}>Phone: {selectedReservationForComplete.customer_phone || customers.find((item) => String(item.id) === String(selectedReservationForComplete.customer_id))?.phone || '—'}</div>
            </div>

            <div style={{ marginTop: '.5rem' }}>
              <strong>Items</strong>
              <div style={{ marginTop: '.5rem' }}>
                {(selectedReservationForComplete.items || []).length === 0 ? (
                  <div className="empty-state">No item details available.</div>
                ) : (
                  (selectedReservationForComplete.items || []).map((item) => (
                    <div key={`${item.product_id}-${item.quantity}`} className="list-row">
                      <div>
                        <strong>{item.product_name}</strong>
                        <div className="muted">Quantity: {item.quantity}</div>
                      </div>
                      <div className="muted">
                        {formatCurrency((products.find((p) => String(p.id) === String(item.product_id))?.price_sell || 0) * Number(item.quantity || 0), 'EUR')}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div style={{ marginTop: '.75rem' }}>
                <strong>Total</strong>
                <div className="muted">{formatCurrency((selectedReservationForComplete.items || []).reduce((sum, it) => {
                  const prod = products.find((p) => String(p.id) === String(it.product_id));
                  const price = Number(prod?.price_sell || 0);
                  return sum + price * Number(it.quantity || 0);
                }, 0), 'EUR')}</div>
              </div>
            </div>

            <div style={{ marginBottom: '.5rem' }}>
              <label className="field-label">Payment method</label>
              <select value={completePaymentMethod} onChange={(e) => setCompletePaymentMethod(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="pos">POS</option>
                <option value="transfer">Bank transfer</option>
              </select>
            </div>

            {completeError ? <div className="error-text" style={{ marginBottom: '.5rem' }}>{completeError}</div> : null}

            <div style={{ display: 'flex', gap: '.6rem', justifyContent: 'flex-end', marginTop: '.75rem' }}>
              <button className="btn-secondary" type="button" onClick={() => { setShowCompleteModal(false); setSelectedReservationForComplete(null); setCompleteError(''); }}>Cancel</button>
              <button type="button" onClick={confirmComplete} disabled={completeLoading}>{completeLoading ? 'Processing...' : 'Confirm and transfer'}</button>
            </div>
          </div>
        </DetailsModal>
      ) : null}
    </div>
  );
}
