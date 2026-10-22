import { useContext, useState, useMemo, useEffect } from 'react';
import { createSale } from '../services/salesService.js';
import { listProducts } from '../services/productService.js';
import { listCustomers, createCustomer } from '../services/customerService.js';
import Cart from '../components/Cart.jsx';
import { CartContext } from '../context/CartContext.jsx';
import { SettingsContext } from '../context/SettingsContext.jsx';
import DetailsModal from '../components/DetailsModal.jsx';

/**
 * Página de vendas.
 * Permite buscar produtos, selecionar clientes e concluir vendas a partir do carrinho.
 *
 * @returns {JSX.Element} Interface de realização de vendas.
 */
export default function Sales() {
  const { cart, addToCart, clearCart } = useContext(CartContext);
  const { settings } = useContext(SettingsContext);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState([]);
  const [searched, setSearched] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerSearchField, setCustomerSearchField] = useState('all');
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '', nif: '' });
  const [customerError, setCustomerError] = useState('');

  useEffect(() => {
    listCustomers()
      .then((res) => setCustomers(res.data || []))
      .catch(() => setCustomers([]));
  }, []);

  /**
   * Cria um novo cliente a partir do modal de cadastro e atualiza a lista disponível.
   *
   * @returns {Promise<void>} Promessa resolvida após a criação do cliente.
   */
  const createCustomerFromModal = async () => {
    setCustomerError('');
    if (!newCustomer.email && !newCustomer.phone) {
      setCustomerError('Provide an email or phone number for the new customer');
      return;
    }
    try {
      const res = await createCustomer(newCustomer);
      const createdId = res.data?.id || null;
      try {
        const listRes = await listCustomers();
        setCustomers(listRes.data || []);
      } catch (e) {
        // ignore
      }
      setSelectedCustomerId(createdId);
      setNewCustomer({ name: '', phone: '', email: '', nif: '' });
      setShowNewCustomerModal(false);
    } catch (err) {
      setCustomerError(err.response?.data?.message || 'Failed to create customer');
      // eslint-disable-next-line no-console
      console.error(err);
    }
  };

  /**
   * Filtra a lista de clientes com base no texto pesquisado e no campo selecionado.
   *
   * @returns {Array<Object>} Lista de clientes compatível com a busca.
   */
  const filteredCustomers = useMemo(() => {
    const q = String(customerSearch || '').trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => {
      if (customerSearchField === 'all') {
        return (
          String(c.name || '').toLowerCase().includes(q) ||
          String(c.email || '').toLowerCase().includes(q) ||
          String(c.phone || '').toLowerCase().includes(q) ||
          String(c.nif || '').toLowerCase().includes(q)
        );
      }
      return String(c[customerSearchField] || '').toLowerCase().includes(q);
    });
  }, [customers, customerSearch, customerSearchField]);

  /**
   * Busca produtos ativos pelo texto digitado e atualiza a lista da tela.
   *
   * @param {React.FormEvent} e Evento de submissão do formulário de busca.
   * @returns {Promise<void>} Promessa resolvida após a pesquisa.
   */
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!search.trim()) {
      setProducts([]);
      setSearched(false);
      return;
    }

    try {
      const res = await listProducts({ status: 'active' });
      const filtered = res.data.filter((p) => {
        const term = search.toLowerCase();
        return (
          p.name?.toLowerCase().includes(term) ||
          p.category?.toLowerCase().includes(term) ||
          p.supplier_name?.toLowerCase().includes(term)
        );
      });
      setProducts(filtered);
      setSearched(true);
    } catch (err) {
      console.error(err);
      setProducts([]);
    }
  };

  /**
   * Finaliza a venda com base no carrinho atual e no cliente selecionado.
   *
   * @returns {Promise<void>} Promessa resolvida após o processamento da venda.
   */
  const checkout = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    setMessage('');
    setCustomerError('');

    try {
      let customerId = selectedCustomerId;

      if (!customerId) {
        setCustomerError('Select or create the customer before confirming the sale.');
        setShowNewCustomerModal(true);
        setLoading(false);
        return;
      }

      await createSale({
        items: cart.map((item) => ({
          product_id: item.id,
          quantity: item.quantity,
          unit_price: item.price_sell,
        })),
        paymentMethod,
        customerId,
      });

      clearCart();
      setMessage('✅ Sale completed successfully!');
      setSearch('');
      setProducts([]);
      setSearched(false);
      
      setNewCustomer({ name: '', phone: '', email: '', nif: '' });
      setSelectedCustomerId(null);
      setPaymentMethod('cash');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('❌ Error completing sale. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: '1rem'}}>
        <h1 className="page-title">Sales</h1>
        <p className="page-subtitle">Search products and manage your shopping cart.</p>
      </div>

      <div className="grid-2" style={{ maxWidth: '100%', gap: '2rem' }}>
        {/* Left side - Product Search */}
        <div>
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', justifyContent: 'space-between' }}>
                  <label className="field-label" style={{ margin: 0 , fontSize: '1.1rem'}}>Customer</label>
                  <button type="button" className="btn-secondary" onClick={() => setShowNewCustomerModal(true)}>New</button>
                </div>
                <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
                  <input
                    placeholder="Search customers"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  <select value={customerSearchField} onChange={(e) => setCustomerSearchField(e.target.value)} style={{ width: '150px' }}>
                    <option value="all">All</option>
                    <option value="name">Name</option>
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                    <option value="nif">NIF</option>
                  </select>
                </div>
                <select value={selectedCustomerId || ''} onChange={(e) => setSelectedCustomerId(e.target.value || null)} style={{ width: '100%', minWidth: 0 }}>
                  <option value="">Select customer</option>
                  {filteredCustomers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name || c.email || c.phone || c.nif}</option>
                  ))}
                </select>
              </div>
              {showNewCustomerModal ? (
                <DetailsModal title="Create customer" subtitle="Add a new customer" onClose={() => setShowNewCustomerModal(false)}>
                  <div style={{ display: 'grid', gap: '.5rem' }}>
                    <input placeholder="Name" value={newCustomer.name} onChange={(e) => setNewCustomer((s) => ({ ...s, name: e.target.value }))} style={{ width: '100%' }} />
                    <input placeholder="Phone" value={newCustomer.phone} onChange={(e) => setNewCustomer((s) => ({ ...s, phone: e.target.value }))} style={{ width: '100%' }} />
                    <input placeholder="Email" value={newCustomer.email} onChange={(e) => setNewCustomer((s) => ({ ...s, email: e.target.value }))} style={{ width: '100%' }} />
                    <input placeholder="NIF" value={newCustomer.nif} onChange={(e) => setNewCustomer((s) => ({ ...s, nif: e.target.value }))} style={{ width: '100%' }} />
                    {customerError ? <div className="muted" style={{ color: 'red', marginTop: '.4rem' }}>{customerError}</div> : null}
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn-secondary" onClick={() => setShowNewCustomerModal(false)}>Cancel</button>
                    <button type="button" className="btn-primary" onClick={createCustomerFromModal}>Create</button>
                  </div>
                </DetailsModal>
              ) : null}
            </div>
          <form onSubmit={handleSearch} className="card" style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn-secondary">Search</button>
            </div>
          </form>

          {message && (
            <div style={{
              padding: '0.75rem',
              borderRadius: '6px',
              background: message.includes('✅') ? 'rgba(21, 128, 61, 0.12)' : 'rgba(185, 28, 28, 0.12)',
              color: message.includes('✅') ? '#15803d' : '#b91c1c',
              fontSize: '0.9rem',
              marginBottom: '1rem'
            }}>
              {message}
            </div>
          )}

          {searched ? (
            <div className="card">
              {products.length === 0 ? (
                <div className="empty-state">No products found.</div>
              ) : (
                <div className="page-stack">
                  <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: '#666' }}>
                    Found {products.length} product{products.length !== 1 ? 's' : ''}
                  </p>
                  {products.map((product) => (
                    <div key={product.id} className="list-row">
                      <div>
                        <strong>{product.name}</strong>
                        <div className="muted">
                          {product.supplier_name || 'No supplier'} • {product.category || 'Uncategorized'}
                        </div>
                        <div style={{ color: '#1e3a8a', fontWeight: 500, marginTop: '0.25rem' }}>
                          €{Number(product.price_sell || 0).toFixed(2)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => addToCart(product)}
                        className="btn-secondary"
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        + Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="card empty-state" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '1rem', color: '#999' }}>Search for products to add to your cart</p>
            </div>
          )}
        </div>

        {/* Right side - Cart */}
        <div>
          <Cart />

          {cart.length > 0 && (
            <div className="card" style={{ marginTop: '1rem' }}>
              <label className="field-label" htmlFor="payment-method">Payment method</label>
              <select
                id="payment-method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                style={{ width: '100%', marginBottom: '.75rem' }}
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="mbway">MB WAY</option>
                <option value="bank_transfer">Bank transfer</option>
              </select>
              <button
                type="button"
                className="btn-primary"
                onClick={checkout}
                disabled={loading}
                style={{ width: '100%' }}
              >
                {loading ? '⟳ Processing...' : '✓ Confirm Sale'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
