import { createContext, useEffect, useMemo, useState } from 'react';

/**
 * Contexto React que expõe o tema atual da aplicação (claro/escuro) e as ações para alterá-lo.
 * @module context/ThemeContext
 */
export const ThemeContext = createContext();

/**
 * Provider que gerencia o estado do tema (claro/escuro), persistindo a escolha em localStorage
 * e aplicando o atributo `data-theme` no elemento raiz do documento.
 *
 * @param {Object} props Propriedades do componente.
 * @param {import('react').ReactNode} props.children Elementos filhos que terão acesso ao contexto.
 * @returns {JSX.Element} Provider do {@link ThemeContext}.
 */
export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme, toggleTheme: () => setTheme((current) => (current === 'light' ? 'dark' : 'light')) }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
