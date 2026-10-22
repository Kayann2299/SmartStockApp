import { useEffect, useMemo, useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { SettingsContext } from '../context/SettingsContext.jsx';
import { formatDate } from '../utils/formatters.js';
import { useSearchParams } from 'react-router-dom';
import DetailsModal from '../components/DetailsModal.jsx';
import { listSuppliers } from '../services/supplierService.js';
import { createSupplierOrder, listLowStockBySupplier, listSupplierOrders, updateSupplierOrderStatus } from '../services/supplierService.js';
import { listProducts } from '../services/productService.js';
import { getDashboard } from '../services/reportService.js';


const emptyDraft = {
  supplier_id: '',
  channel: 'email',
  notes: '',
  items: [],
};
/**
 * Converte produtos sugeridos em itens compatíveis
 * com o formulário de criação de ordens.
 *
 * @param {Array<Object>} items Lista de produtos sugeridos.
 * @returns {Array<Object>} Itens formatados.
 */
const mapSuggestedItems = (items = []) => items.map((item) => ({
  product_id: item.product_id,
  product_name: item.product_name,
  product_category: item.product_category,
  quantity: String(item.recommended_reorder || 1),
  price: String(item.price_buy ?? item.price ?? 0),
  price_buy: String(item.price_buy ?? item.price ?? 0),
  product_photo_url: item.product_photo_url || '',
}));

/**
 * Página de pedidos a fornecedores.
 * Gerencia ordens de compra, alertas de estoque e agrupamento por fornecedor.
 *
 * @returns {JSX.Element} Interface de pedidos a fornecedores.
 */
export default function SupplierOrders() {
  const { user } = useContext(AuthContext);
  const { settings } = useContext(SettingsContext) ?? {};
  const canManageOrders = user?.role === 'admin' || user?.role === 'manager';
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [showModal, setShowModal] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [selectedOrderToComplete, setSelectedOrderToComplete] = useState(null);
  const [completeLoading, setCompleteLoading] = useState(false);
  const [completeError, setCompleteError] = useState('');

  const load = async () => {
    const results = await Promise.allSettled([
      listSupplierOrders(),
      listSuppliers(),
      listProducts(),
      listLowStockBySupplier(),
    ]);

    results.forEach((r, idx) => {
  if (r.status === 'rejected') {
    console.error('SupplierOrders load error', idx, r.reason);
  }
});
    const [ordersRes, suppliersRes, productsRes, suggestionsRes, dashboardRes] = results;

    setOrders(ordersRes.status === 'fulfilled' ? (ordersRes.value.data || []) : []);
    setSuppliers(suppliersRes.status === 'fulfilled' ? (suppliersRes.value.data || []) : []);
    setProducts(productsRes.status === 'fulfilled' ? (productsRes.value.data || []) : []);
    setGroups(suggestionsRes.status === 'fulfilled' ? (suggestionsRes.value.data || []) : []);
    console.table(
  suggestionsRes.value.data.flatMap(group =>
    group.items.map(item => ({
      product: item.product_name,
      minLevel: item.min_level,
      quantity: item.quantity,
      days: item.days_to_stockout,
      lead: item.supplier_lead_time,
      risk: item.alert_type,
    }))
  )
);



    try {
      // eslint-disable-next-line no-console
      console.debug('SupplierOrders loaded', {
        orders: ordersRes.status === 'fulfilled' ? (ordersRes.value.data || []) : null,
        suppliers: suppliersRes.status === 'fulfilled' ? (suppliersRes.value.data || []) : null,
        products: productsRes.status === 'fulfilled' ? (productsRes.value.data || []) : null,
        lowStockGroups: suggestionsRes.status === 'fulfilled' ? (suggestionsRes.value.data || []) : null,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to log SupplierOrders payload', err);
    }

    results.forEach((r, idx) => {
      if (r.status === 'rejected') {
        // eslint-disable-next-line no-console
        console.error('SupplierOrders load error', idx, r.reason);
      }
    });
  };

  useEffect(() => {
    load().catch(() => {
      setOrders([]);
      setSuppliers([]);
      setProducts([]);
      setGroups([]);
    });
  }, []);

  useEffect(() => {
    const supplierId = searchParams.get('supplier');
    if (!supplierId || suppliers.length === 0 || showModal) return;
    const supplier = suppliers.find((item) => item.id === supplierId);
    if (!supplier) return;
    openOrderModal(supplier, groups.find((item) => item.supplier_id === supplierId)?.items || []);
    setSearchParams({}, { replace: true });
  }, [searchParams, suppliers, groups, showModal, setSearchParams]);

  const openOrderModal = (supplier, items = []) => {
    const supplierId = supplier?.id || supplier?.supplier_id || '';
    setDraft({
      supplier_id: supplierId,
      channel: supplier?.email ? 'email' : supplier?.phone ? 'sms' : 'email',
      notes: '',
      items: mapSuggestedItems(items),
    });
    setShowModal(true);
  };

  const openManualOrder = () => {
    const supplier = suppliers[0];
    setDraft({
      supplier_id: supplier?.id || '',
      channel: supplier?.email ? 'email' : supplier?.phone ? 'sms' : 'email',
      notes: '',
      items: supplier ? [{ product_id: '', product_name: '', product_category: '', quantity: '1', price: '0', price_buy: '0', product_photo_url: '' }] : [],
    });
    setShowModal(true);
  };

  const submitOrder = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createSupplierOrder(draft.supplier_id, {
        channel: draft.channel,
        notes: draft.notes,
        items: draft.items,
      });
      setShowModal(false);
      await load();
    } finally {
      setLoading(false);
    }
  };
  /**
   * Atualiza um item da ordem em edição.
   *
   * @param {number} index Índice do item.
   * @param {Object} patch Campos a atualizar.
   */
  const updateItem = (index, patch) => {
    setDraft((current) => {
      const next = current.items.slice();
      next[index] = { ...next[index], ...patch };
      return { ...current, items: next };
    });
  };
  /**
  * Adiciona um produto ao grupo do fornecedor,
  * calculando quantidades pendentes e de reposição.
  *
  * @param {Object} item Produto.
  * @param {string} type Tipo de alerta.
  */
  const addItem = () => {
    setDraft((current) => ({
      ...current,
      items: [...current.items, { product_id: '', product_name: '', product_category: '', quantity: '1', price: '0', price_buy: '0', product_photo_url: '' }],
    }));
  };

  const removeItem = (index) => {
    setDraft((current) => ({ ...current, items: current.items.filter((_, i) => i !== index) }));
  };

  const selectedSupplier = useMemo(
    () => suppliers.find((item) => item.id === draft.supplier_id) || null,
    [suppliers, draft.supplier_id]
  );

  const productById = useMemo(() => new Map(products.map((item) => [item.id, item])), [products]);

  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || 'pending'); // all, pending, completed

  const supplierOrders = orders || [];
  const pendingOrders = supplierOrders.filter((order) => order.status === 'pending');
  const pendingCount = pendingOrders.length;

  const pendingOrderQuantitiesByProduct = useMemo(() => {
    const map = new Map();
    supplierOrders.forEach((order) => {
      if (String(order?.status || '').toLowerCase() !== 'pending') return;
      (order?.items || []).forEach((item) => {
        const productId = String(item?.product_id || item?.id || '');
        if (!productId) return;
        const quantity = Number(item?.quantity || 0);
        map.set(productId, (map.get(productId) || 0) + quantity);
      });
    });
    return map;
  }, [supplierOrders]);

const supplierAlertGroups = useMemo(() => {
  const groupsMap = new Map();

  const fallbackLowItems = (groups || []).flatMap((group) =>
    (group.items || []).map((item) => ({
      ...item,
      supplier_id: group.supplier_id,
      supplier_name: group.supplier_name,
    }))
  );

    const resolveSupplier = (productId) => {
      const product = (products || []).find((entry) => String(entry.id) === String(productId));
      const supplier = (suppliers || []).find((entry) => String(entry.id) === String(product?.supplier_id));
      return {
        supplier_id: product?.supplier_id || supplier?.id || '',
        supplier_name: product?.supplier_name || supplier?.name || 'Unassigned supplier',
        supplier_email: supplier?.email || null,
        supplier_phone: supplier?.phone || null,
        supplier_lead_time: Number(supplier?.lead_time || product?.supplier_lead_time || 0),
      };
    };

    const addItem = (item, type) => {
      const productId = item?.id || item?.product_id || item?.productId;
      if (!productId) return;
      const product = (products || []).find((entry) => String(entry.id) === String(productId));
      const supplierMeta = resolveSupplier(productId);
      const supplierKey = supplierMeta.supplier_id || 'unassigned';
      const rawAvailable = Number(item?.available_stock ?? item?.quantity - item?.reserved_quantity ?? 0);
      const reserved = Number(item?.reserved_quantity ?? 0);
      const availableStock = item?.available_stock != null ? rawAvailable : Math.max(0, rawAvailable - reserved);
      const minLevel = Number(item?.min_level ?? 0);
      const leadTime = Number(item?.supplier_lead_time ?? 0);
      const daysToStockout = Number(item?.days_to_stockout ?? Number.POSITIVE_INFINITY);

      if (!groupsMap.has(supplierKey)) {
        groupsMap.set(supplierKey, {
          supplier_id: supplierMeta.supplier_id,
          supplier_name: supplierMeta.supplier_name,
          supplier_email: supplierMeta.supplier_email,
          supplier_phone: supplierMeta.supplier_phone,
          items: [],
        });
      }
  

      const group = groupsMap.get(supplierKey);
      if (group.items.some((entry) => String(entry.product_id) === String(productId) && entry.alert_type === type)) {
        return;
      }

      const priceBuy = Number(item?.price_buy ?? item?.price ?? product?.price_buy ?? product?.price_sell ?? 0);
      const orderQuantity = pendingOrderQuantitiesByProduct.get(String(productId)) || 0;
      const reorderQuantity = Math.max(0,Number(item?.recommended_reorder || 0) - orderQuantity);

      group.items.push({
      ...item,
      id: productId,
      product_id: productId,
      product_name: item?.product_name || item?.name || 'Product',
      product_category: item?.product_category || '',
      supplier_lead_time: leadTime,
      available_stock: availableStock,
      alert_type: type,
      chip_label: type === 'critical' || type === 'out_of_stock' ? 'Critical Stock' : 'Low stock',
      chip_variant: type === 'critical' || type === 'out_of_stock' ? 'chip-danger' : 'chip-warning',
      order_quantity: orderQuantity,
      already_ordered: orderQuantity > 0,
      reorder_quantity: reorderQuantity,
      price_buy: priceBuy,
      price: priceBuy,
}); 
    };

fallbackLowItems.forEach((item) => {
  addItem(item, item.alert_type);
});
console.log(
  "Total items before render:",
  Array.from(groupsMap.values()).reduce(
    (sum, g) => sum + g.items.length,
    0
  )
);

console.log(Array.from(groupsMap.values()));
    return Array.from(groupsMap.values())
      .map((group) => ({
        ...group,
        items: [...group.items].sort((a, b) => {
          if (a.already_ordered !== b.already_ordered) return a.already_ordered ? 1 : -1;
          if (a.alert_type !== b.alert_type) return a.alert_type === 'critical' ? -1 : 1;
          return (a.days_to_stockout ?? Number.POSITIVE_INFINITY) - (b.days_to_stockout ?? Number.POSITIVE_INFINITY);
        }),
      }))
      .sort((a, b) => a.supplier_name.localeCompare(b.supplier_name));
  }, [groups,
  pendingOrderQuantitiesByProduct,
  products,
  suppliers,]);

  const displayedOrders = supplierOrders.filter((order) => {
    if (statusFilter === 'pending' && order.status !== 'pending') return false;
    if (statusFilter === 'completed' && order.status !== 'completed' && order.status !== 'received') return false;
    const q = String(searchQuery || '').trim().toLowerCase();
    if (!q) return true;
    if (String(order.supplier_name || '').toLowerCase().includes(q)) return true;
    if (String(order.message || order.notes || '').toLowerCase().includes(q)) return true;
    if ((order.items || []).some((it) => String(it.product_name || it.name || '').toLowerCase().includes(q))) return true;
    return false;
  });

  return (
    <div className="page-shell">



      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
        <div className="card" style={{ minHeight: 520 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '.75rem', marginBottom: '.5rem' }}>
            <h1 className="chart-title" style={{ margin: 0 ,fontSize: '2rem'}}>Supplier orders</h1>
            <div className="page-actions" style={{ display: 'flex', gap: '.5rem', alignItems: 'center', marginLeft: 'auto' }}>
              <span className="nav-pill">{pendingCount} pending</span>
              <button type="button" onClick={openManualOrder} disabled={suppliers.length === 0 || !canManageOrders}>+ New order</button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', marginTop: '.5rem' }}>
            <input
              placeholder="Search orders or products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ padding: '.35rem .5rem', borderRadius: '6px', border: '1px solid #ddd', color: 'var(--text)', flex: 1, minWidth: 0 }}
            />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '.35rem .5rem', width: '150px', minWidth: '120px', borderRadius: '6px' }}>
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="page-stack" style={{ marginTop: '1rem' }}>
            {displayedOrders.length === 0 ? (
              <div className="empty-state">No supplier orders.</div>
            ) : displayedOrders.map((order) => (
              <div key={order.id} className="supplier-order-card">
                <div className="list-item" style={{ paddingTop: 0 }}>
                  <div>
                    <strong>{order.supplier_name || 'Supplier'}</strong>
       
                       <div className="muted" style={{ fontSize: '.88rem' }}>
                      {order.message || order.notes || 'No message recorded.'}
                       <div className="muted" style={{ fontSize: '.82rem' }}>
                       Created: {formatDate(order.created_at)}
                      {(order.status === 'completed' || order.status === 'received')
                     ? <> · Completed: {formatDate(order.completed_at || order.received_at)}</>
                     : null}
                       </div>
                    </div>
                  </div>
                  <span className={`chip ${order.status === 'pending' ? 'chip-warning' : 'chip-neutral'}`}>{order.status}</span>
                </div>
                <div className="page-stack">
                  {(order.items || []).map((item) => {
                    const unitPrice = Number(item.price ?? item.price_buy ?? 0);
                    const lineTotal = unitPrice * Number(item.quantity || 0);
                    return (
                      <div key={item.id || item.product_id} className="list-row">
                        <div>
                          <strong>{item.product_name || item.name || 'Item'}</strong>
                          <div className="muted" style={{ fontSize: '.88rem' }}>Qty: {item.quantity}</div>
                          <div className="muted" style={{ fontSize: '.88rem' }}>Price per unit: €{unitPrice.toFixed(2)}</div>
                        </div>
                        <span className="muted">Price: €{lineTotal.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="card-actions">
                  {order.status !== 'received' && order.status !== 'completed' ? (
                    <button type="button" onClick={() => { setSelectedOrderToComplete(order); setShowCompleteConfirm(true); }}>Complete Order</button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="page-stack" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-start' }}>
          <div className="card" style={{ flex: '1 1 320px', minWidth: 280, minHeight: 250 }}>
            <h3 className="chart-title">Low Stock Products</h3>
            <div className="page-stack" style={{ marginTop: '1rem' }}>
              {supplierAlertGroups.length === 0 ? (
                <div className="empty-state">No critical or forecast alerts for suppliers.</div>
              ) : supplierAlertGroups.map((group) => (
                <div key={group.supplier_id || group.supplier_name} className="supplier-order-group">
                  <div className="list-item" style={{ paddingTop: 0 }}>
                    <div>
                      <strong>{group.supplier_name}</strong>
                      <div className="muted" style={{ fontSize: '.88rem' }}>{group.supplier_email || group.supplier_phone || 'No contact available'}</div>
                    </div>
                    <button type="button" className="btn-secondary" disabled={!group.supplier_id || !canManageOrders} onClick={() => canManageOrders && openOrderModal(group, group.items)}>Order</button>
                  </div>
                  <div className="page-stack">
                    {group.items.length === 0 ? (
                      <div className="muted">No items</div>
                    ) : group.items.map((item) => (
                      <div key={`${item.product_id}-${item.alert_type}`} className="list-row">
                        <div>
                          <strong>{item.product_name}</strong>
                          <div className="muted" style={{ fontSize: '.88rem' }}>
                        {item.alert_type === 'critical' || item.alert_type === 'out_of_stock' ? (  
                          <>Available: {item.available_stock} <br /> Min level: {item.min_level}  <br /> Reorder: {item.recommended_reorder}</>) 
                          : (<>Stockout(days): {Number(item.days_to_stockout ?? 0).toFixed(2)} days<br />Lead time: {item.supplier_lead_time || '—'} days  <br /> Reorder: {item.recommended_reorder} </>)}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '.4rem', flexDirection: 'column', alignItems: 'center', flexWrap: 'wrap' ,marginLeft: 'auto'}}>
                        <span className={`chip ${item.chip_variant}`}>{item.chip_label}</span>
                        {item.already_ordered ? ( <span className="chip chip-neutral"> Already ordered: {item.order_quantity} </span>) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showModal ? (
        <DetailsModal
          title="Create supplier order"
          subtitle={selectedSupplier ? `${selectedSupplier.name} · ${selectedSupplier.email || selectedSupplier.phone || 'No contact'}` : 'Select a supplier and build the order'}
          onClose={() => setShowModal(false)}
        >
          <form onSubmit={submitOrder}>
            <div className="modal-body form-grid">
              <div className="form-columns-2">
                <div>
                  <label className="field-label">Supplier</label>
                  <select value={draft.supplier_id} onChange={(e) => {
                    const nextSupplier = suppliers.find((item) => item.id === e.target.value);
                    setDraft((current) => ({
                      ...current,
                      supplier_id: e.target.value,
                      channel: nextSupplier?.email ? 'email' : nextSupplier?.phone ? 'sms' : 'email',
                    }));
                  }}>
                    <option value="">Select supplier</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label">Delivery channel</label>
                  <select value={draft.channel} onChange={(e) => setDraft((current) => ({ ...current, channel: e.target.value }))}>
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="field-label">Notes</label>
                <textarea value={draft.notes} onChange={(e) => setDraft((current) => ({ ...current, notes: e.target.value }))} placeholder="Optional supplier notes..." />
              </div>

              <div>
                <div className="list-item" style={{ paddingTop: 0 }}>
                  <strong>Items</strong>
                  <button type="button" className="btn-secondary" onClick={addItem}>+ Add item</button>
                </div>
                <div className="page-stack">
                  {draft.items.map((item, index) => (
                    <div key={`${item.product_id || 'item'}-${index}`} className="card" style={{ padding: '1rem' }}>
                      <div className="form-columns-2">
                        <div>
                          <label className="field-label">Product</label>
                          <select
                            value={item.product_id}
                            onChange={(e) => {
                              const product = productById.get(e.target.value);
                              updateItem(index, {
                                product_id: e.target.value,
                                product_name: product?.name || '',
                                product_category: product?.category || '',
                                price: String(product?.price_buy ?? product?.price_sell ?? 0),
                                price_buy: String(product?.price_buy ?? product?.price_sell ?? 0),
                                product_photo_url: product?.photo_url || '',
                              });
                            }}
                          >
                            <option value="">Select a product</option>
                            {products.filter((p) => String(p.supplier_id) === String(draft.supplier_id)).map((product) => (
                              <option key={product.id} value={product.id}>{product.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="field-label">Quantity</label>
                          <input value={item.quantity} onChange={(e) => updateItem(index, { quantity: e.target.value })} placeholder="1" />
                        </div>
                      </div>
                      <div className="form-columns-2">
                        <div>
                          <label className="field-label">Category</label>
                          <input value={item.product_category} onChange={(e) => updateItem(index, { product_category: e.target.value })} placeholder="Category" />
                        </div>
                        <div>
                          <label className="field-label">Price</label>
                          <input value={item.price ?? item.price_buy ?? '0'} onChange={(e) => updateItem(index, { price: e.target.value, price_buy: e.target.value })} placeholder="0.00" />
                        </div>
                      </div>
                      <div className="modal-footer" style={{ padding: '0', borderTop: '0', justifyContent: 'space-between', marginTop: '.5rem' }}>
                        <button type="button" className="btn-secondary" onClick={() => removeItem(index)}>Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" type="button" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Create order'}</button>
            </div>
          </form>
        </DetailsModal>
      ) : null}

      {showCompleteConfirm && selectedOrderToComplete ? (
        <DetailsModal
          title="Complete supplier order"
          subtitle={`Order #${selectedOrderToComplete.id} · ${selectedOrderToComplete.supplier_name || 'Supplier'}`}
          onClose={() => { setShowCompleteConfirm(false); setSelectedOrderToComplete(null); setCompleteError(''); }}
        >
          <div>
            <div style={{ marginBottom: '.5rem' }}>
              <strong>Confirm receiving</strong>
              <div className="muted">The following items will be added to your stock.</div>
            </div>

            <div style={{ marginTop: '.5rem' }}>
              <strong>Items</strong>
              <div style={{ marginTop: '.5rem' }}>
                {(selectedOrderToComplete.items || []).length === 0 ? (
                  <div className="empty-state">No items listed.</div>
                ) : (
                  (() => {
                    const items = selectedOrderToComplete.items || [];
                    const parsed = items.map((it) => {
                      const price = Number(it.price ?? it.price_buy ?? 0);
                      const qty = Number(it.quantity || 0);
                      return { ...it, _price: price, _qty: qty, _total: price * qty };
                    });
                    const orderTotal = parsed.reduce((s, x) => s + x._total, 0);

                    return (
                      <div>
                        {parsed.map((item) => (
                          <div key={item.id || item.product_id} className="list-row">
                            <div>
                              <strong>{item.product_name || item.name}</strong>
                              <div className="muted">Qty: {item._qty}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div className="muted">€{item._price.toFixed(2)} each</div>
                              <div><strong>€{item._total.toFixed(2)}</strong></div>
                            </div>
                          </div>
                        ))}
                        <div style={{ borderTop: '1px solid #eee', marginTop: '.5rem', paddingTop: '.5rem', textAlign: 'right' }}>
                          <strong>Total: €{orderTotal.toFixed(2)}</strong>
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            </div>

            {completeError ? <div className="error-text" style={{ marginTop: '.5rem' }}>{completeError}</div> : null}

            <div style={{ display: 'flex', gap: '.6rem', justifyContent: 'flex-end', marginTop: '.75rem' }}>
              <button className="btn-secondary" type="button" onClick={() => { setShowCompleteConfirm(false); setSelectedOrderToComplete(null); setCompleteError(''); }}>Cancel</button>
              <button type="button" onClick={async () => {
                setCompleteLoading(true);
                setCompleteError('');
                try {
                  await updateSupplierOrderStatus(selectedOrderToComplete.id, 'completed');
                  setShowCompleteConfirm(false);
                  setSelectedOrderToComplete(null);
                  await load();
                } catch (err) {
                  // eslint-disable-next-line no-console
                  console.error('Complete supplier order failed', err.response || err.message || err);
                  const statusMsg = err.response?.data?.message || err.message || 'Unable to complete order.';
                  if (err.response?.status === 403) {
                    setCompleteError('Access denied. Please re-login with an account that has permission (admin/manager).');
                  } else {
                    setCompleteError(statusMsg);
                  }
                } finally {
                  setCompleteLoading(false);
                }
              }} disabled={completeLoading}>{completeLoading ? 'Processing...' : 'Confirm and receive'}</button>
            </div>
          </div>
        </DetailsModal>
      ) : null}
    </div>
  );
}
