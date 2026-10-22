import { useContext } from 'react';
import { CartContext } from '../context/CartContext.jsx';

/**
 * Hook de acesso ao contexto do carrinho de vendas (itens, totais e ações de adicionar/remover).
 *
 * @returns {Object} Valor atual de {@link CartContext} (estado e ações do carrinho).
 */
export function useCart() {
  return useContext(CartContext);
}
