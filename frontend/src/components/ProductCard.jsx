import { useContext } from 'react';
import { SettingsContext } from '../context/SettingsContext.jsx';
import { AuthContext } from '../context/AuthContext.jsx';
import { formatCurrency } from '../utils/formatters.js';
import { useCart } from '../hooks/useCart.js';
import StockBadge from './StockBadge.jsx';

/**
 * Cartão de produto exibido na grelha da página de Products, com preço, estoque,
 * previsão de esgotamento e ações de adicionar ao carrinho, editar, remover ou ver detalhes.
 *
 * @param {Object} props Propriedades do componente.
 * @param {Object} props.product Dados do produto (inclui métricas de estoque calculadas pelo backend).
 * @param {() => void} [props.onDelete] Callback chamado ao remover/arquivar o produto.
 * @param {() => void} [props.onViewDetails] Callback chamado ao abrir os detalhes do produto.
 * @param {() => void} [props.onEdit] Callback chamado ao editar o produto.
 * @returns {JSX.Element} Cartão do produto renderizado.
 */
export default function ProductCard({ product, onDelete, onViewDetails, onEdit }) {
  const { settings } = useContext(SettingsContext);
  const { user } = useContext(AuthContext);
  const { cart, addToCart, removeFromCart } = useCart();
  const totalStock = Number(product.quantity ?? product.total_stock ?? 0);
  const reservedQuantity = Number(product.reserved_quantity || 0);
  const currentStock = Math.max(0, totalStock - reservedQuantity);
  const availableStock = currentStock;
  const minLevel = Number(product.min_level || 0);
  // days_to_stockout vem null do backend quando o produto não teve vendas nos
  // últimos 30 dias (sem velocidade de venda para projetar o esgotamento).
  // Chamar .toFixed(2) diretamente nesse caso rebentava com TypeError e
  // derrubava a página inteira de Products (não há ErrorBoundary aqui).
  const daysToStockout =
    product.days_to_stockout !== null && product.days_to_stockout !== undefined
      ? Number(Number(product.days_to_stockout).toFixed(2))
      : Number.POSITIVE_INFINITY;
  const supplierLeadTime = Number(product.supplier_lead_time ?? 0);
  const leadTime = Number(supplierLeadTime ?? 0);

  const derivedStockStatus = String(
  product.stock_status ??
  product.risk_level ??
  product.alert_type ??
  'healthy'
).toLowerCase();
  
  const estimatedProfit = Number(product.price_sell || 0) - Number(product.price_buy || 0);
  const isArchived = Boolean(product.deleted_at);
  const isInCart = cart.some((item) => item.id === product.id);
  const canEdit = ['admin', 'manager'].includes(user?.role);
  const canDelete = ['admin', 'manager'].includes(user?.role);
  return (
    <article className="product-tile">
      <div className="product-image-row">
        <div className="product-image">
          {product.photo_url ? <img src={product.photo_url} alt={product.name} /> : <span>{product.name?.[0] || 'P'}</span>}
        </div>
        <div className="product-card-copy">
          <div className="product-tile-top">
            <div>
              <h3 className="product-name">{product.name}</h3>
              <p className="muted" style={{ margin: '.2rem 0 0' }}>{product.category || 'Uncategorized'}</p>
            </div>
            <StockBadge quantity={availableStock} minLevel={minLevel} status={derivedStockStatus} daysToStockout={daysToStockout} leadTime={supplierLeadTime} />
          </div>
          <div className="chip-row">
            <span className="chip chip-neutral">{(product.primary_supplier_id || product.supplier_id) ? product.supplier_name || 'Supplier linked' : 'No supplier linked'}</span>
            <span className="chip chip-neutral">{product.unit || 'unit'}</span>
            <span className="chip chip-neutral">{(product.primary_supplier_id || product.supplier_id) ? `Days to stockout: ${Number.isFinite(daysToStockout) ? `${daysToStockout} days` : 'N/A'}` : null}</span>
            <span className="chip chip-neutral">{(product.primary_supplier_id || product.supplier_id) ? `Lead Time: ${leadTime} days` : null}</span>
            {isArchived ? <span className="chip chip-neutral">Removed</span> : null}
          </div>
        </div>
      </div>

      <div className="product-meta">
        <span>Sale price</span>
        <strong>{formatCurrency(product.price_sell, settings.currency, settings.language)}</strong>
      </div>
      <div className="product-meta">
        <span>Purchase price</span>
        <strong>{formatCurrency(product.price_buy, settings.currency, settings.language)}</strong>
      </div>
      <div className="product-meta">
        <span>Profit / unit</span>
        <strong>{formatCurrency(estimatedProfit, settings.currency, settings.language)}</strong>
      </div>
      <div className="product-meta">
        <span>Total stock</span>
        <strong>{totalStock}</strong>
      </div>
      <div className="product-meta">
        <span>Current stock</span>
        <strong>{currentStock}</strong>
      </div>
      <div className="product-meta">
        <span>Reserved</span>
        <strong>{reservedQuantity}</strong>
      </div>
      <div className="product-meta">
        <span>Supplier</span>
        <strong>{product.supplier_name || '—'}</strong>
      </div>
      <div className="card-actions">
      <button
      type="button"
      className="btn-primary"
      onClick={() => addToCart(product)}
      >
      + Add ({cart.find((item) => item.id === product.id)?.quantity || 0})
      </button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => removeFromCart(product.id)}
          disabled={!isInCart}
        >
          ✕ Remove
        </button>
        
        {onViewDetails ? <button type="button" className="btn-secondary" onClick={onViewDetails}>View details</button> : null}
      </div>
    </article>
  );
}
