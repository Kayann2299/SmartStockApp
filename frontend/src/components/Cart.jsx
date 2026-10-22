
import { useContext } from 'react';
import { SettingsContext } from '../context/SettingsContext.jsx';
import { CartContext } from '../context/CartContext.jsx';
import { formatCurrency } from '../utils/formatters.js';

/**
 * Painel do carrinho de vendas: lista os itens selecionados, permite ajustar quantidades,
 * remover itens e exibe o total da venda em andamento.
 *
 * @returns {JSX.Element} Painel do carrinho renderizado, consumindo {@link CartContext}.
 */
export default function Cart() {
  const { settings } = useContext(SettingsContext);
  const { cart, updateCartItem, removeFromCart, clearCart } = useContext(CartContext);
  const total = cart.reduce((sum, item) => sum + Number(item.price_sell || 0) * Number(item.quantity || 0), 0);

  const increase = (productId) => {
    const item = cart.find((i) => i.id === productId);
    if (item) updateCartItem(productId, item.quantity + 1);
  };

  const decrease = (productId) => {
    const item = cart.find((i) => i.id === productId);
    if (item) updateCartItem(productId, Math.max(1, item.quantity - 1));
  };

  return (
    <div className="card">
      <div className="page-header" style={{ marginBottom: '1rem' }}>
        <div>
          <h3 className="page-title" style={{ fontSize: '1.25rem' }}>Cart</h3>
          <p className="page-subtitle">Review items before completing the sale.</p>
        </div>
      </div>

      {cart.length === 0 ? <div className="empty-state">Cart is empty.</div> : null}

      {cart.map((item) => (
        <div key={item.id} className="list-row">
          <div>
            <strong>{item.name}</strong>
            <div className="muted">{Number(item.quantity)} × {formatCurrency(item.price_sell || 0, settings.currency, settings.language)}</div>
          </div>
          <div className="row-actions">
            <button className="btn-ghost" type="button" onClick={() => decrease(item.id)}>-</button>
            <button className="btn-ghost" type="button" onClick={() => increase(item.id)}>+</button>
            <button type="button" onClick={() => removeFromCart(item.id)}>Remove</button>
          </div>
        </div>
      ))}

      <div className="list-row" style={{ borderBottom: 0, paddingBottom: 0 }}>
        <strong>Total</strong>
        <strong>{formatCurrency(total, settings.currency, settings.language)}</strong>
      </div>
      {cart.length > 0 && <button className="btn-secondary" type="button" onClick={clearCart} style={{ marginTop: '.85rem' }}>Clear cart</button>}
    </div>
  );
}
