
/**
 * Helpers de API para fluxos de autenticação, como login, cadastro e recuperação de senha.
 * @module services/authService
 */
import api from './api.js';

/**
 * Executa a operação login request.
 */
export const loginRequest = (payload) => api.post('/auth/login', payload);
/**
 * Executa a operação register request.
 */
export const registerRequest = (payload) => api.post('/auth/register', payload);
/**
 * Executa a operação me request.
 */
export const meRequest = () => api.get('/auth/me');
/**
 * Executa a operação forgot password request.
 */
export const forgotPasswordRequest = (payload) => api.post('/auth/forgot-password', payload);
/**
 * Executa a operação reset password request.
 */
export const resetPasswordRequest = (payload) => api.post('/auth/reset-password', payload);
/**
 * Executa a operação verify email request.
 */
export const verifyEmailRequest = (token) => api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`);
