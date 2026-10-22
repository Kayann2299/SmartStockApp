
/**
 * Helpers de API para administração de usuários e configurações da conta.
 * @module services/userService
 */
import api from './api.js';

/**
 * Lista users.
 */
export const listUsers = () => api.get('/users');
/**
 * Executa a operação promote user.
 */
export const promoteUser = (id, role) => api.patch(`/users/${id}/role`, { role });
/**
 * Atualiza my profile.
 */
export const updateMyProfile = (payload) => api.patch('/users/me', payload);
/**
 * Salva company settings.
 */
export const saveCompanySettings = (payload) => api.post('/users/settings/company', payload);
/**
 * Salva as preferências de notificação (alerts/reports, email/sms).
 * Restrito a admin/manager no backend — employees recebem 403.
 */
export const saveNotificationPreferences = (payload) => api.post('/users/settings/notifications', payload);
/**
 * Salva message templates.
 */
export const saveMessageTemplates = (payload) => api.post('/users/settings/messages', payload);
