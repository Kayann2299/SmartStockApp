import { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DetailsModal from '../components/DetailsModal.jsx';
import ImageUpload from '../components/ImageUpload.jsx';
import { AuthContext } from '../context/AuthContext.jsx';
import { createSupplier, listSuppliers, updateSupplier } from '../services/supplierService.js';
import { uploadSupplierImage, deleteSupplierImage } from '../services/uploadService.js';

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  lead_time: '',
  photo_url: '',
  photo_filename: '',
};

/**
 * Página de gestão de fornecedores.
 * Permite listar, editar, criar e associar fornecedores à aplicação.
 *
 * @returns {JSX.Element} Interface de gestão de fornecedores.
 */
export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierDraft, setSupplierDraft] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [searchField, setSearchField] = useState('all');
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const canEditImage = user?.role === 'admin';
  const canManageSupplierDetails = user?.role === 'admin';
  const canManageOrders = ['admin', 'manager'].includes(user?.role);

  /**
   * Carrega a lista de fornecedores do backend.
   *
   * @returns {Promise<void>} Promessa resolvida após o carregamento.
   */
  const load = () => listSuppliers().then((res) => setSuppliers(res.data || [])).catch(() => setSuppliers([]));

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const urlSearch = searchParams.get('search') || '';
    if (urlSearch !== search) {
      setSearch(urlSearch);
    }
  }, [searchParams]);

  useEffect(() => {
    if (selectedSupplier) {
      setSupplierDraft(selectedSupplier);
    } else {
      setSupplierDraft(null);
    }
  }, [selectedSupplier]);

  const submit = async (e) => {
    e.preventDefault();
    await createSupplier({
      ...form,
      lead_time: form.lead_time === '' ? null : Number(form.lead_time),
    });
    setForm(emptyForm);
    setShowForm(false);
    load();
  };

  const handleImageUpload = async (file) => {
    if (!file) {
      // User removed the image
      if (form.photo_filename) {
        await deleteSupplierImage(form.photo_filename);
      }
      setForm((p) => ({ ...p, photo_url: '', photo_filename: '' }));
      return;
    }

    try {
      const res = await uploadSupplierImage(file);
      setForm((p) => ({
        ...p,
        photo_url: res.data.url,
        photo_filename: res.data.filename,
      }));
    } catch (err) {
      console.error('Upload error:', err);
    }
  };

  const handleSupplierSave = async () => {
    if (!selectedSupplier || !supplierDraft) return;

    const payload = {};
    if (supplierDraft.name !== selectedSupplier.name) payload.name = supplierDraft.name;
    if (supplierDraft.email !== selectedSupplier.email) payload.email = supplierDraft.email;
    if (supplierDraft.phone !== selectedSupplier.phone) payload.phone = supplierDraft.phone;
    if (String(supplierDraft.lead_time ?? '') !== String(selectedSupplier.lead_time ?? '')) {
      payload.lead_time = supplierDraft.lead_time === '' ? null : Number(supplierDraft.lead_time);
    }

    if (Object.keys(payload).length === 0) return;

    try {
      const res = await updateSupplier(selectedSupplier.id, payload);
      setSelectedSupplier((prev) => prev ? { ...prev, ...res.data } : prev);
      load();
    } catch (err) {
      console.error('Unable to update supplier.', err);
    }
  };

  const handleSupplierImageUpdate = async (file) => {
    if (!selectedSupplier) {
      return;
    }

    if (!file) {
      if (selectedSupplier.photo_filename) {
        await deleteSupplierImage(selectedSupplier.photo_filename);
      }

      await updateSupplier(selectedSupplier.id, {
        photo_url: '',
        photo_filename: '',
      });

      setSelectedSupplier((prev) => prev ? { ...prev, photo_url: '', photo_filename: '' } : prev);
      load();
      return;
    }

    try {
      const res = await uploadSupplierImage(file);
      await updateSupplier(selectedSupplier.id, {
        photo_url: res.data.url,
        photo_filename: res.data.filename,
      });

      setSelectedSupplier((prev) => prev ? { ...prev, photo_url: res.data.url, photo_filename: res.data.filename } : prev);
      load();
    } catch (err) {
      console.error('Upload error:', err);
      throw err;
    }
  };

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

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return suppliers;

    return suppliers.filter((supplier) => {
      const values = {
        all: [supplier.name, supplier.email, supplier.phone],
        name: [supplier.name],
        email: [supplier.email],
        phone: [supplier.phone],
      };

      return (values[searchField] || values.all).some((value) =>
        String(value || '').toLowerCase().includes(term)
      );
    });
  }, [suppliers, search, searchField]);

  return (
    <div className="page-shell">
       


      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <h1 className="page-title" style={{ margin: 0 , fontSize: '2rem' }}>Suppliers</h1>
          <div className="page-actions" style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="nav-pill">{filtered.length} suppliers</span>
            <button type="button" onClick={() => setShowForm(true)} disabled={!canManageSupplierDetails}>+ Add supplier</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={searchField === 'all' ? 'Search by name, email or phone...' : `Search by ${searchField}...`}
            style={{ flex: '3 1 240px', minWidth: '220px' }}
          />
          <select
            value={searchField}
            onChange={(e) => setSearchField(e.target.value)}
            style={{ flex: '1 1 140px', minWidth: '140px', minHeight: '3rem', padding: '.45rem .6rem', borderRadius: '8px', border: '1px solid #d6dbe2' }}
          >
            <option value="all">All</option>
            <option value="name">Name</option>
            <option value="email">Email</option>
            <option value="phone">Phone</option>
          </select>
        </div>
      </div>

      <div className="data-grid suppliers-grid">
        {filtered.length === 0 ? (
          <div className="empty-state" style={{ gridColumn: '1 / -1' }}>No suppliers registered.</div>
        ) : filtered.map((supplier) => (
          <article key={supplier.id} className="supplier-card">
            <div className="supplier-card-header">
              <div className="supplier-photo">
                {supplier.photo_url ? <img src={supplier.photo_url} alt={supplier.name} /> : <span>{supplier.name?.[0] || 'S'}</span>}
              </div>
              <div className="supplier-card-main">
                <h3>{supplier.name}</h3>
                <div className="muted">{supplier.email || 'No email'}</div>
                <div className="chip-row">
                  <span className="chip chip-neutral">Lead time: {supplier.lead_time ?? '—'} days</span>
                  <span className="chip chip-neutral">{supplier.orders_count ?? 0} orders</span>
                  {supplier.low_stock_items > 0 && (
                    <span className="chip chip-warning">{supplier.low_stock_items ?? 0} low stock</span>
                  )}
                  {supplier.critical_stock_items > 0 && (
                    <span className="chip chip-danger">{supplier.critical_stock_items ?? 0} critical stock</span>
                  )}
                </div>
              </div>
            </div>

            <div className="supplier-card-meta">
              <div><span>Email</span><strong>{supplier.email || '—'}</strong></div>
              <br />
              <div><span>Phone</span><strong>{supplier.phone || '—'}</strong></div>
              
            </div>

            <div className="card-actions">
              <button type="button" className="btn-secondary" onClick={() => setSelectedSupplier(supplier)}>Details</button>
              <button type="button" onClick={() => navigate(`/supplier-orders?supplier=${supplier.id}`)} disabled={!canManageOrders}>Order</button>
            </div>
          </article>
        ))}
      </div>

      {showForm ? (
        <DetailsModal title="New supplier" subtitle="Add a supplier to the catalog." onClose={() => setShowForm(false)}>
          <form onSubmit={submit}>
            <div className="modal-body form-grid">
              <div className="form-columns-2">
                <div>
                  <label className="field-label">Name</label>
                  <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Supplier name" />
                </div>
                <div>
                  <label className="field-label">Email</label>
                  <input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="Email" />
                </div>
              </div>

              <div className="form-columns-2">
                <div>
                  <label className="field-label">Phone</label>
                  <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="Phone" />
                </div>
                <div>
                  <label className="field-label">Lead time (days)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={form.lead_time}
                    onChange={(e) => setForm((p) => ({ ...p, lead_time: e.target.value }))}
                    placeholder="10"
                  />
                </div>
              </div>

              <div>
                <label className="field-label">Supplier Photo</label>
                <ImageUpload 
                  onImageSelected={handleImageUpload}
                  currentImage={form.photo_url}
                  label="Select supplier image"
                  folder="suppliers"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit">Save</button>
            </div>
          </form>
        </DetailsModal>
      ) : null}

      {selectedSupplier ? (
        <DetailsModal title={selectedSupplier.name} subtitle="Supplier profile" onClose={() => setSelectedSupplier(null)}>
          <div className="detail-stack">
            <div className="detail-photo">
              {selectedSupplier.photo_url ? <img src={selectedSupplier.photo_url} alt={selectedSupplier.name} /> : <span>{selectedSupplier.name?.[0] || 'S'}</span>}
            </div>
            {canEditImage ? (
              <div>
                <label className="field-label">Change supplier image</label>
                <ImageUpload
                  onImageSelected={handleSupplierImageUpdate}
                  currentImage={selectedSupplier.photo_url}
                  label="Change supplier image"
                  folder="suppliers"
                />
              </div>
            ) : null}
            {canManageSupplierDetails ? (
              <>
                <div>
                  <label className="field-label">Name</label>
                  <input
                    value={supplierDraft?.name || ''}
                    onChange={(e) => setSupplierDraft((prev) => prev ? { ...prev, name: e.target.value } : prev)}
                  />
                </div>
                <div>
                  <label className="field-label">Email</label>
                  <input
                    value={supplierDraft?.email || ''}
                    onChange={(e) => setSupplierDraft((prev) => prev ? { ...prev, email: e.target.value } : prev)}
                  />
                </div>
                <div>
                  <label className="field-label">Phone</label>
                  <input
                    value={supplierDraft?.phone || ''}
                    onChange={(e) => setSupplierDraft((prev) => prev ? { ...prev, phone: e.target.value } : prev)}
                  />
                </div>
                <div>
                  <label className="field-label">Lead time (days)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={supplierDraft?.lead_time ?? ''}
                    onChange={(e) => setSupplierDraft((prev) => prev ? { ...prev, lead_time: e.target.value } : prev)}
                  />
                </div>
                <div className="modal-footer" style={{ padding: 0, borderTop: 0 }}>
                  <button type="button" className="btn-secondary" onClick={() => setSelectedSupplier(null)}>Cancel</button>
                  <button type="button" onClick={handleSupplierSave}>Save</button>
                </div>
              </>
            ) : (
              <>
                <div className="product-meta"><span>Name</span><strong>{selectedSupplier.name || '—'}</strong></div>
                <div className="product-meta"><span>Email</span><strong>{selectedSupplier.email || '—'}</strong></div>
                <div className="product-meta"><span>Phone</span><strong>{selectedSupplier.phone || '—'}</strong></div>
                <div className="product-meta"><span>Lead time</span><strong>{selectedSupplier.lead_time ?? '—'} days</strong></div>
              </>
            )}
            <div className="product-meta"><span>Critical stock items</span><strong>{selectedSupplier.critical_stock_items ?? 0}</strong></div>
            <div className="product-meta"><span>Orders</span><strong>{selectedSupplier.orders_count ?? 0}</strong></div>
            <div className="page-actions">
              <button type="button" onClick={() => {
                setSelectedSupplier(null);
                navigate(`/supplier-orders?supplier=${selectedSupplier.id}`);
              }} disabled={!canManageOrders}>Create order</button>
            </div>
          </div>
        </DetailsModal>
      ) : null}
    </div>
  );
}
