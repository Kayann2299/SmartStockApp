import { createContext, useState, useEffect } from 'react';

/**
 * Contexto React que expõe o carrinho de vendas (itens, quantidades) e as ações para manipulá-lo.
 * @module context/CartContext
 */
export const CartContext = createContext();

/**
 * Provider que gerencia o estado do carrinho de vendas, persistindo os itens em localStorage
 * entre sessões e expondo ações para adicionar, remover, atualizar e limpar itens.
 *
 * @param {Object} props Propriedades do componente.
 * @param {import('react').ReactNode} props.children Elementos filhos que terão acesso ao contexto.
 * @returns {JSX.Element} Provider do {@link CartContext}.
 */
export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem('smartstock_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('smartstock_cart', JSON.stringify(cart));
  }, [cart]);

  /**
   * Adiciona um produto ao carrinho, incrementando a quantidade em 1 se já
   * estiver presente.
   *
   * @param {Object} product Produto a adicionar (deve conter `id`).
   * @returns {void}
   */
  const addToCart = (product) => {
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.id === product.id);
      if (existing) {
        return prevCart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: (item.quantity) + 1 }
            : item
        );
      }
      return [...prevCart, { ...product, quantity: 1 }];
    });
  };

 /**
  * Remove uma unidade de um produto do carrinho, decrementando a
  * quantidade em 1 e removendo o item por completo quando chega a 0.
  *
  * @param {number|string} productId Id do produto a remover.
  * @returns {void}
  */
 const removeFromCart = (productId) => {
  setCart((prevCart) => {
    return prevCart
      .map((item) => {
        if (item.id === productId) {
          return {
            ...item,
            quantity: item.quantity - 1
          };
        }

        return item;
      })
      .filter((item) => item.quantity > 0);
  });
};

  /**
   * Define diretamente a quantidade de um item do carrinho. Remove o item
   * quando a quantidade indicada for zero ou negativa.
   *
   * @param {number|string} productId Id do produto a atualizar.
   * @param {number} quantity Nova quantidade desejada.
   * @returns {void}
   */
  const updateCartItem = (productId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.id === productId ? { ...item, quantity } : item
      )
    );
  };

  /**
   * Esvazia completamente o carrinho.
   *
   * @returns {void}
   */
  const clearCart = () => {
    setCart([]);
  };

  return (
    <CartContext.Provider value={{ cart, setCart, addToCart, removeFromCart, updateCartItem, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}
