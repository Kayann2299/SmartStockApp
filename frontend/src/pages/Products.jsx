import { useEffect, useMemo, useState, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createProduct, deleteProduct, restoreProduct, listProducts, updateProduct } from '../services/productService.js';
import { listSuppliers } from '../services/supplierService.js';
import { uploadProductImage, deleteProductImage } from '../services/uploadService.js';
import ProductCard from '../components/ProductCard.jsx';
import ImageUpload from '../components/ImageUpload.jsx';
import DetailsModal from '../components/DetailsModal.jsx';
import { AuthContext } from '../context/AuthContext.jsx';
import { formatCurrency } from '../utils/formatters.js';
import { SettingsContext } from '../context/SettingsContext.jsx';

const emptyForm = {
  name: '',
  category: '',
  description: '',
  photo_url: '',
  photo_filename: '',
  primary_supplier_id: '',
  price_buy: '0',
  price_sell: '0',
  unit: 'unit',
  quantity: '0',
  forecast_quant: '0',
  min_level: '1', 
};

const filters = [
  { value: 'active', label: 'Active' },
  { value: 'all', label: 'All' },
  { value: 'archived', label: 'Archived' },
];

/**
 * Página de gestão de produtos.
 * Permite pesquisar, criar, editar, arquivar e atualizar dados de estoque e imagem dos produtos.
 *
 * @returns {JSX.Element} Interface de gestão de produtos renderizada na aplicação.
 */
export default function Products() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState('active');
  const [showForm, setShowForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productDraft, setProductDraft] = useState(null);
  const [detailsForm, setDetailsForm] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { user } = useContext(AuthContext);
  const { settings } = useContext(SettingsContext);
  const isAdmin = user?.role === 'admin';
  const canManageProduct = isAdmin;
  const canManageProductDetails = ['admin', 'manager'].includes(user?.role);
  const canEditBasicFields = isAdmin;
  const canEditStock = isAdmin;
  const canEditMinStock = isAdmin;
  const canEditSupplier = isAdmin;
  const canEditImage = canManageProduct;
  const canDelete = canManageProduct;

  /**
   * Carrega os produtos e fornecedores da API e atualiza o estado da página.
   *
   * @param {string} [nextStatus=statusFilter] Status da lista a ser carregada.
   * @returns {Promise<void>} Promessa resolvida após o carregamento dos dados.
   */
  const load = async (nextStatus = statusFilter) => {
    try {
      const [productsRes, suppliersRes] = await Promise.all([
        listProducts({ status: nextStatus }),
        listSuppliers(),
      ]);
      setProducts(productsRes.data || []);
      setSuppliers(suppliersRes.data || []);
    } catch {
      setProducts([]);
      setSuppliers([]);
    }
  };

  useEffect(() => {
    load();
  
  }, [statusFilter]);

  useEffect(() => {
    const urlSearch = searchParams.get('search') || '';
    if (urlSearch !== search) {
      setSearch(urlSearch);
    }
  }, [searchParams]);

  useEffect(() => {
    if (selectedProduct) {
      setDetailsForm({});
      setProductDraft(selectedProduct);
    } else {
      setProductDraft(null);
    }
  }, [selectedProduct]);

  const submit = async (e) => {
    e.preventDefault();
    await createProduct({
      ...form,
      quantity: Number(form.quantity || 0),
      price_buy: Number(form.price_buy || 0),
      price_sell: Number(form.price_sell || 0),
      min_level: Number(form.min_level || 0),
      primary_supplier_id: form.primary_supplier_id || null,
    });
    setForm({ ...emptyForm });
    setShowForm(false);
    load();
  };

  const handleImageUpload = async (file) => {
    if (!file) {
      if (form.photo_filename) {
        await deleteProductImage(form.photo_filename);
      }
      setForm((p) => ({ ...p, photo_url: '', photo_filename: '' }));
      return;
    }


setForm((p) => ({
  ...p,
  photo_url: res.data.url,
  photo_filename: res.data.filename,
}));
    try {
      const res = await uploadProductImage(file);
      setForm((p) => ({
        ...p,
        photo_url: res.data.url,
        photo_filename: res.data.filename,
      }));
    } catch (err) {
      console.error('Upload error:', err);
    }
  };

const handleProductImageUpdate = async (file) => {
  if (!selectedProduct) {
    return;
  }

  if (!file) {
    if (selectedProduct.photo_filename) {
      await deleteProductImage(selectedProduct.photo_filename);
    }

    await updateProduct(selectedProduct.id, {
      photo_url: '',
      photo_filename: '',
    });

    setSelectedProduct((prev) =>
      prev ? { ...prev, photo_url: '', photo_filename: '' } : prev
    );

    load(statusFilter);
    return;
  }

  try {
    const oldFilename = selectedProduct.photo_filename;

    // Faz upload da nova imagem
    const res = await uploadProductImage(file);

    // Atualiza o produto com a nova imagem
    await updateProduct(selectedProduct.id, {
      photo_url: res.data.url,
      photo_filename: res.data.filename,
    });

    // Só depois apaga a imagem antiga
    if (oldFilename) {
      await deleteProductImage(oldFilename);
    }

    setSelectedProduct((prev) =>
      prev
        ? {
            ...prev,
            photo_url: res.data.url,
            photo_filename: res.data.filename,
          }
        : prev
    );

    load(statusFilter);

  } catch (err) {
    console.error('Upload error:', err);
    throw err;
  }
};

  const handleProductSave = async () => {
    if (!selectedProduct || !productDraft) return;

    const payload = {};
    if (isAdmin && String(productDraft.name || '').trim() !== String(selectedProduct.name || '').trim()) {
      payload.name = String(productDraft.name || '').trim();
    }
    if (isAdmin && String(productDraft.primary_supplier_id || '') !== String(selectedProduct.primary_supplier_id || selectedProduct.supplier_id || '')) {
      payload.primary_supplier_id = productDraft.primary_supplier_id || null;
    }
    if (isAdmin && Number(productDraft.min_level || 0) !== Number(selectedProduct.min_level || 0)) {
      payload.min_level = Number(productDraft.min_level || 0);
    }
    if (isAdmin && Number(productDraft.quantity || 0) !== Number(selectedProduct.quantity || 0)) {
      payload.quantity = Number(productDraft.quantity || 0);
    }

    if (Object.keys(payload).length === 0) return;

    try {
      const res = await updateProduct(selectedProduct.id, payload);
      setSelectedProduct((prev) => prev ? { ...prev, ...res.data } : prev);
      load(statusFilter);
    } catch (err) {
      console.error('Unable to update product.', err);
    }
  };

  const handleSearchChange = (value) => {
    const nextValue = value;
    setSearch(nextValue);
    const nextSearchParams = new URLSearchParams(searchParams);
    if (nextValue.trim()) {
      nextSearchParams.set('search', nextValue.trim());
    } else {
      nextSearchParams.delete('search');
    }
    setSearchParams(nextSearchParams, { replace: true });
  };

  const filtered = useMemo(() => products.filter((product) => {
    const term = search.toLowerCase();
    return !term || [product.name, product.category, product.unit, product.supplier_name].filter(Boolean).some((value) => String(value).toLowerCase().includes(term));
  }), [products, search]);

  const supplierName = (supplierId) => suppliers.find((item) => String(item.id) === String(supplierId))?.name || '';

  return (
    <div className="page-shell">
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="page-header">
          <div>
            <h1 className="page-title">Products</h1>
            <p className="page-subtitle">Manage product data, photos, purchase price, sale price and stock.</p>
          </div>
          <div className="page-actions">
            <span className="nav-pill">{filtered.length} items</span>
            <button type="button" onClick={() => setShowForm(true)} disabled={!canManageProduct}>+ Add product</button>
          </div>
        </div>

        <div className="toolbar" style={{ marginTop: '1rem', marginBottom: 0, display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '0.75rem', alignItems: 'center' }}>
          <input className="toolbar-search" value={search} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Search products..." />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ minWidth: '140px' }}
          >
            {filters.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="data-grid">
        {filtered.length === 0 ? (
          <div className="empty-state" style={{ gridColumn: '1 / -1' }}>No products found.</div>
        ) : (
          filtered.map((product) => {
            const productWithSupplier = {
              ...product,
              supplier_name: product.supplier_name || supplierName(product.primary_supplier_id),
            };
            return (
              <ProductCard
                key={product.id}
                product={productWithSupplier}
                onViewDetails={() => setSelectedProduct(productWithSupplier)}
              />
            );
          })
        )}
      </div>

      {showForm ? (
        <DetailsModal title="New product" subtitle="Add a product to the catalog." onClose={() => setShowForm(false)}>
          <form onSubmit={submit}>
            <div className="modal-body form-grid">
              <div className="form-columns-2">
                <div>
                  <label className="field-label">Name</label>
                  <input autoComplete="off" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Product name" />
                </div>
                <div>
                  <label className="field-label">Category</label>
                  <input autoComplete="off" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} placeholder="Category" />
                </div>
              </div>

              <div>
                <label className="field-label">Description</label>
                <textarea autoComplete="off" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Product description" />
              </div>

              <div>
                <label className="field-label">Product Photo</label>
                <ImageUpload 
                  onImageSelected={handleImageUpload}
                  currentImage={form.photo_url}
                  label="Select product image"
                  folder="products"
                />
              </div>

              <div>
                <label className="field-label">Supplier</label>
                <select value={form.primary_supplier_id} onChange={(e) => setForm((p) => ({ ...p, primary_supplier_id: e.target.value }))}>
                  <option value="">Select a supplier</option>
                  {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                </select>
              </div>

              <div className="form-columns-2">
                <div>
                  <label className="field-label">Purchase price</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*[.,]?[0-9]*"
                    value={form.price_buy}
                    onChange={(e) => setForm((p) => ({ ...p, price_buy: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="field-label">Sale price</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*[.,]?[0-9]*"
                    value={form.price_sell}
                    onChange={(e) => setForm((p) => ({ ...p, price_sell: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </div>
             
              <div className="form-columns-2">
                <div>
                  <label className="field-label">Unit</label>
                  <input value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))} placeholder="unit" />
                </div>
                <div>
                  <label className="field-label">Current stock</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={form.quantity}
                    onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
                    placeholder="0"
                  />
                </div>

              </div>

              {canEditMinStock ? (
                <div>
                  <label className="field-label">Minimum level</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={form.min_level}
                    onChange={(e) => setForm((p) => ({ ...p, min_level: e.target.value }))}
                    placeholder="1"
                  />
                </div>
              ) : null}

              <div className="form-columns-2">
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit">Save</button>
            </div>
          </form>
        </DetailsModal>
      ) : null}

      {selectedProduct ? (
        <DetailsModal
          title={selectedProduct.name}
          subtitle={selectedProduct.category || 'Uncategorized'}
          onClose={() => setSelectedProduct(null)}
        >
          <div className="detail-stack">
            <div className="detail-photo detail-photo--wide">
              {selectedProduct.photo_url ? <img src={selectedProduct.photo_url} alt={selectedProduct.name} /> : <span>{selectedProduct.name?.[0] || 'P'}</span>}
            </div>
            {canEditImage ? (
              <div>
                <label className="field-label">Change product image</label>
                <ImageUpload
                  onImageSelected={handleProductImageUpdate}
                  currentImage={selectedProduct.photo_url}
                  label="Change product image"
                  folder="products"
                />
              </div>
            ) : null}
            {selectedProduct.deleted_at ? <span className="chip chip-neutral" style={{ width: 'fit-content' }}>Archived product</span> : null}
            {canEditBasicFields ? (
              <div>
                <label className="field-label">Name</label>
                <input
                  value={productDraft?.name || ''}
                  onChange={(e) => setProductDraft((prev) => prev ? { ...prev, name: e.target.value } : prev)}
                  placeholder="Product name"
                />
              </div>
            ) : (
              <div className="product-meta"><span>Name</span><strong>{selectedProduct.name || '—'}</strong></div>
            )}
            {canEditSupplier ? (
              <div>
                <label className="field-label">Supplier</label>
                <select
                  value={productDraft?.primary_supplier_id || productDraft?.supplier_id || ''}
                  onChange={(e) => setProductDraft((prev) => prev ? { ...prev, primary_supplier_id: e.target.value || null, supplier_id: e.target.value || null } : prev)}
                >
                  <option value="">No supplier</option>
                  {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                </select>
              </div>
            ) : (
              <div className="product-meta"><span>Supplier</span><strong>{selectedProduct.supplier_name || '—'}</strong></div>
            )}
            <div className="product-meta"><span>Description</span><strong>{selectedProduct.description || '—'}</strong></div>
            <div className="product-meta"><span>Purchase price</span><strong>{formatCurrency(selectedProduct.price_buy || 0, settings.currency, settings.language)}</strong></div>
            <div className="product-meta"><span>Sale price</span><strong>{formatCurrency(selectedProduct.price_sell, settings.currency, settings.language)}</strong></div>
            <div className="product-meta"><span>Estimated profit per unit</span><strong>{formatCurrency(Number(selectedProduct.price_sell || 0) - Number(selectedProduct.price_buy || 0), settings.currency, settings.language)}</strong></div>
            {canEditStock ? (
              <div>
                <label className="field-label">Stock quantity</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={Number(productDraft?.quantity || 0)}
                  onChange={(e) => setProductDraft((prev) => prev ? { ...prev, quantity: Number(e.target.value || 0) } : prev)}
                  style={{ width: '100%' }}
                />
              </div>
            ) : (
              <div className="product-meta"><span>Total stock</span><strong>{Number(selectedProduct.quantity || 0)}</strong></div>
            )}
            <div className="product-meta"><span>Current stock</span><strong>{Math.max(0, Number(selectedProduct.quantity || 0) - Number(selectedProduct.reserved_quantity || 0))}</strong></div>
            <div className="product-meta"><span>Unit</span><strong>{selectedProduct.unit || '—'}</strong></div>
            <div className="product-meta"><span>Reserved</span><strong>{Number(selectedProduct.reserved_quantity || 0)}</strong></div>
            {canEditMinStock ? (
              <div>
                <label className="field-label">Minimum level</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={Number(productDraft?.min_level || 0)}
                  onChange={(e) => setProductDraft((prev) => prev ? { ...prev, min_level: Number(e.target.value || 0) } : prev)}
                  style={{ width: '100%' }}
                />
              </div>
            ) : (
              <div className="product-meta"><span>Minimum level</span><strong>{Number(selectedProduct.min_level || 0)}</strong></div>
            )}
              {canManageProductDetails ? (
              <div className="modal-footer" style={{ padding: 0, borderTop: 0, marginTop: '1rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setSelectedProduct(null)}>Cancel</button>
                <button type="button" onClick={handleProductSave}>Save</button>
              </div>
            ) : null}
           {canDelete && !selectedProduct.deleted_at ? (
  <div style={{ marginTop: '1rem' }}>
    <button
      type="button"
      className="btn btn-danger"
      onClick={() => {
        setDeleteTarget(selectedProduct);
        setSelectedProduct(null);
      }}
    >
      Delete product
    </button>
  </div>
) : null}

{canDelete && selectedProduct.deleted_at ? (
  <div style={{ marginTop: '1rem' }}>
    <button
      type="button"
      onClick={async () => {
        await restoreProduct(selectedProduct.id);
        setSelectedProduct(null);
        load(statusFilter);
      }}
    >
      Recover product
    </button>
  </div>
) : null}
          </div>
          
        </DetailsModal>
      ) : null}

      {deleteTarget ? (
        <DetailsModal
          title="Delete product?"
          subtitle="The product will be archived, but its sales history and revenue remain in the system."
          onClose={() => setDeleteTarget(null)}
        >
          <div className="detail-stack">
            <p className="muted">Are you sure you want to delete <strong>{deleteTarget.name}</strong>?</p>
            <div className="modal-footer" style={{ padding: 0, borderTop: 0 }}>
              <button type="button" className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button type="button" onClick={async () => {
                await deleteProduct(deleteTarget.id);
                setDeleteTarget(null);
                load(statusFilter);
              }}>Yes, delete</button>
            </div>
          </div>
        </DetailsModal>
      ) : null}
    </div>
  );
}
