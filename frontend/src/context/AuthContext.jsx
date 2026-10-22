import { createContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api.js';
import { loginRequest, meRequest } from '../services/authService.js';

/**
 * Contexto React que expõe o usuário autenticado e as ações de login/logout.
 * @module context/AuthContext
 */
export const AuthContext = createContext();

/**
 * Provider que gerencia a sessão autenticada: restaura o usuário a partir do token salvo em
 * localStorage ao carregar a aplicação, e expõe as ações de login e logout.
 *
 * @param {Object} props Propriedades do componente.
 * @param {import('react').ReactNode} props.children Elementos filhos que terão acesso ao contexto.
 * @returns {JSX.Element} Provider do {@link AuthContext}.
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    api.defaults.headers.common.Authorization = `Bearer ${token}`;

    meRequest()
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem('token');
        delete api.defaults.headers.common.Authorization;
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  /**
   * Autentica o usuário com email e password, guarda o token de sessão e
   * atualiza o usuário atual do contexto.
   *
   * @param {string} email Email do usuário.
   * @param {string} password Password do usuário.
   * @returns {Promise<Object>} Dados retornados pela API de login.
   */
  const login = async (email, password) => {
    const res = await loginRequest({ email, password });
    const token = res.data.token;

    localStorage.setItem('token', token);
    api.defaults.headers.common.Authorization = `Bearer ${token}`;

    if (res.data.user) {
      setUser(res.data.user);
    } else {
      const me = await meRequest();
      setUser(me.data);
    }

    return res.data;
  };

  /**
   * Termina a sessão do usuário atual, removendo o token guardado e
   * limpando o estado de usuário do contexto.
   *
   * @returns {void}
   */
  const logout = () => {
    localStorage.removeItem('token');
    delete api.defaults.headers.common.Authorization;
    setUser(null);
  };

  const value = useMemo(() => ({ user, loading, login, logout, setUser }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
