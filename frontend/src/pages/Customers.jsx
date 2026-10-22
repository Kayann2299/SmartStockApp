import { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DetailsModal from '../components/DetailsModal.jsx';
import { AuthContext } from '../context/AuthContext.jsx';
import { listCustomers, updateCustomer, createCustomer } from '../services/customerService.js';

/**
 * Página de gerenciamento de clientes.
 * Permite listar, pesquisar, visualizar detalhes, editar e criar clientes.
 *
 * @returns {JSX.Element} Interface de gerenciamento de clientes renderizada na aplicação.
 */
export default function Customers() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [searchParams, setSearchParams] = useSearchParams();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [searchField, setSearchField] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerDraft, setCustomerDraft] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createError, setCreateError] = useState('');
  const canManageCustomerDetails = ['admin', 'manager'].includes(user?.role);

  /**
   * Carrega a lista de clientes a partir do serviço e atualiza o estado local.
   */
  const loadCustomers = () => {
    listCustomers()
      .then((res) => setCustomers(res.data || []))
      .catch(() => setCustomers([]));
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    const urlSearch = searchParams.get('search') || '';
    if (urlSearch !== search) {
      setSearch(urlSearch);
    }
  }, [searchParams]);

  useEffect(() => {
    if (selectedCustomer) {
      setCustomerDraft(selectedCustomer);
    } else {
      setCustomerDraft(null);
    }
  }, [selectedCustomer]);

  /**
   * Salva as alterações de um cliente selecionado quando houver campos modificados.
   *
   * @returns {Promise<void>} Promessa resolvida após o envio da atualização.
   */
  const handleCustomerSave = async () => {
    if (!selectedCustomer || !customerDraft) return;

    const payload = {};
    if (customerDraft.name !== selectedCustomer.name) payload.name = customerDraft.name;
    if (customerDraft.nif !== selectedCustomer.nif) payload.nif = customerDraft.nif;
    if (customerDraft.email !== selectedCustomer.email) payload.email = customerDraft.email;
    if (customerDraft.phone !== selectedCustomer.phone) payload.phone = customerDraft.phone;

    if (Object.keys(payload).length === 0) return;

    try {
      const res = await updateCustomer(selectedCustomer.id, payload);
      setSelectedCustomer((prev) => prev ? { ...prev, ...res.data } : prev);
      loadCustomers();
    } catch (err) {
      console.error('Unable to update customer.', err);
    }
  };

  /**
   * Atualiza o texto de pesquisa e sincroniza o valor com a URL.
   *
   * @param {string} value Texto digitado no campo de busca.
   */
  const handleSearchChange = (value) => {
    setSearch(value);
    const nextSearchParams = new URLSearchParams(searchParams);
    if (value.trim()) {
      nextSearchParams.set('search', value.trim());
    } else {
      nextSearchParams.delete('search');
    }
    setSearchParams(nextSearchParams, { replace: true });
  };

  /**
   * Filtra os clientes com base no termo pesquisado e no campo selecionado.
   *
   * @returns {Array<Object>} Lista de clientes que atendem aos critérios de busca.
   */
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers;

    const normalizeValue = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedTerm = normalizeValue(term);
    const isNumericQuery = /^\d+$/.test(normalizedTerm);

    return customers.filter((customer) => {
      const fieldOrder = {
        name: [customer.name],
        nif: [customer.nif],
        phone: [customer.phone],
        email: [customer.email],
        all: [customer.nif, customer.phone, customer.email, customer.name],
      };

      const candidates = (fieldOrder[searchField] || fieldOrder.all).map((value) => normalizeValue(value));

      if (isNumericQuery) {
        return candidates.some((value) => value.startsWith(normalizedTerm));
      }

      const score = candidates.reduce((total, value, index) => {
        if (!value) return total;

        const weight = searchField === 'all'
          ? [50, 35, 20, 8][index] ?? 5
          : 25;
        const exact = value === normalizedTerm;
        const startsWith = value.startsWith(normalizedTerm);
        const includes = value.includes(normalizedTerm);
        const containsWord = normalizedTerm.split(/\s+/).every((word) => value.includes(word));

        if (exact) return total + weight + 40;
        if (startsWith) return total + weight + 12;
        if (includes) return total + weight + 6;
        if (containsWord) return total + weight + 2;
        return total;
      }, 0);

      if (searchField === 'all') {
        return score >= 20;
      }

      return score > 0;
    });
  }, [customers, search, searchField]);

  return (
    <div className="page-shell">
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
        <h1 className="chart-title" style={{ margin: 0, fontSize: '2rem' }}>Customers</h1>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={searchField === 'all' ? 'Search by name, NIF, email or phone...' : `Search by ${searchField}...`}
            style={{ flex: '3 1 240px', minWidth: '220px' }}
          />
          <select
            value={searchField}
            onChange={(e) => setSearchField(e.target.value)}
            style={{ flex: '1 1 140px', minWidth: '140px', minHeight: '3rem', padding: '.45rem .6rem', borderRadius: '8px', border: '1px solid #d6dbe2' }}
          >
            <option value="all">All</option>
            <option value="name">Name</option>
            <option value="nif">NIF</option>
            <option value="phone">Phone</option>
            <option value="email">Email</option>
          </select>
            <div style={{ marginLeft: 8 }}>
              <button type="button" onClick={() => { setCustomerDraft({ name: '', nif: '', email: '', phone: '' }); setShowCreate(true); }}>+ Add customer</button>
            </div>
        </div>
      </div>

      <div className="card table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>NIF</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="6">
                  <div className="empty-state" style={{ margin: '1rem 0' }}>No customers found.</div>
                </td>
              </tr>
            ) : filtered.map((customer) => (
              <tr key={customer.id}>
                <td><strong>{customer.name}</strong></td>
                <td>{customer.nif || '—'}</td>
                <td>{customer.email || '—'}</td>
                <td>{customer.phone || '—'}</td>
                <td>{customer.created_at ? new Date(customer.created_at).toLocaleDateString('en-GB') : '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setSelectedCustomer(customer)}
                    >
                      Details
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        const searchValue = [customer.nif, customer.phone, customer.email, customer.name].find(Boolean) || '';
                        navigate(`/sales-history?customerName=${encodeURIComponent(customer.name || '')}&customerSearch=${encodeURIComponent(searchValue)}`);
                      }}
                    >
                      Sales
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        const searchValue = [customer.nif, customer.phone, customer.email, customer.name].find(Boolean) || '';
                        navigate(`/reservations?customerName=${encodeURIComponent(customer.name || '')}&customerSearch=${encodeURIComponent(searchValue)}`);
                      }}
                    >
                      Reservations
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedCustomer ? (
        <DetailsModal title={selectedCustomer.name || 'Customer'} subtitle="Customer profile" onClose={() => setSelectedCustomer(null)}>
          <div className="detail-stack">
            {canManageCustomerDetails ? (
              <>
                <div>
                  <label className="field-label">Name</label>
                  <input
                    value={customerDraft?.name || ''}
                    onChange={(e) => setCustomerDraft((prev) => prev ? { ...prev, name: e.target.value } : prev)}
                  />
                </div>
                <div>
                  <label className="field-label">NIF</label>
                  <input
                    value={customerDraft?.nif || ''}
                    onChange={(e) => setCustomerDraft((prev) => prev ? { ...prev, nif: e.target.value } : prev)}
                  />
                </div>
                <div>
                  <label className="field-label">Email</label>
                  <input
                    value={customerDraft?.email || ''}
                    onChange={(e) => setCustomerDraft((prev) => prev ? { ...prev, email: e.target.value } : prev)}
                  />
                </div>
                <div>
                  <label className="field-label">Phone</label>
                  <input
                    value={customerDraft?.phone || ''}
                    onChange={(e) => setCustomerDraft((prev) => prev ? { ...prev, phone: e.target.value } : prev)}
                  />
                </div>
                <div className="modal-footer" style={{ padding: 0, borderTop: 0 }}>
                  <button type="button" className="btn-secondary" onClick={() => setSelectedCustomer(null)}>Cancel</button>
                  <button type="button" onClick={handleCustomerSave}>Save</button>
                </div>
              </>
            ) : (
              <>
                <div className="product-meta"><span>Name</span><strong>{selectedCustomer.name || '—'}</strong></div>
                <div className="product-meta"><span>NIF</span><strong>{selectedCustomer.nif || '—'}</strong></div>
                <div className="product-meta"><span>Email</span><strong>{selectedCustomer.email || '—'}</strong></div>
                <div className="product-meta"><span>Phone</span><strong>{selectedCustomer.phone || '—'}</strong></div>
              </>
            )}
          </div>
        </DetailsModal>
      ) : null}

      {showCreate ? (
        <DetailsModal title="New customer" subtitle="Add a customer to the system." onClose={() => setShowCreate(false)}>
          <form onSubmit={async (e) => {
            e.preventDefault();
            setCreateError('');
            if (!customerDraft?.email && !customerDraft?.phone) {
              setCreateError('Provide an email or phone number for the new customer');
              return;
            }
            try {
              await createCustomer(customerDraft || { name: '', nif: '', email: '', phone: '' });
              setShowCreate(false);
              setCustomerDraft(null);
              loadCustomers();
            } catch (err) {
              setCreateError(err.response?.data?.message || 'Unable to create customer');
              console.error('Unable to create customer', err);
            }
          }}>
            <div className="modal-body form-grid">
              <div>
                <label className="field-label">Name</label>
                <input value={customerDraft?.name || ''} onChange={(e) => setCustomerDraft((p) => ({ ...(p || {}), name: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">NIF</label>
                <input value={customerDraft?.nif || ''} onChange={(e) => setCustomerDraft((p) => ({ ...(p || {}), nif: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">Email</label>
                <input value={customerDraft?.email || ''} onChange={(e) => setCustomerDraft((p) => ({ ...(p || {}), email: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">Phone</label>
                <input value={customerDraft?.phone || ''} onChange={(e) => setCustomerDraft((p) => ({ ...(p || {}), phone: e.target.value }))} />
              </div>
              {createError ? <div className="muted" style={{ color: 'red' }}>{createError}</div> : null}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" type="button" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit">Save</button>
            </div>
          </form>
        </DetailsModal>
      ) : null}
    </div>
  );
}
