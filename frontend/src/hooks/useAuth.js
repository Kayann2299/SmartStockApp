import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';

/**
 * Hook de acesso ao contexto de autenticação (usuário logado, token e ações de login/logout).
 *
 * @returns {Object} Valor atual de {@link AuthContext} (usuário atual e ações de autenticação).
 */
export const useAuth = () => useContext(AuthContext);
