
/**
 * Define rotas de contas de usuário e configurações para atualização de perfil, configurações da empresa e gestão de papéis.
 * @module routes/userRoutes
 */
import express from 'express';
import { getUsers, updateUserRole, updateUserActive, updateCurrentUserProfile, saveCompanySettings, getCompanySettings, saveNotificationPreferences, saveMessageTemplates } from '../controllers/userController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { roleMiddleware } from '../middlewares/roleMiddleware.js';

const router = express.Router();

router.patch('/me', authMiddleware, updateCurrentUserProfile);
router.get('/settings/company', authMiddleware, getCompanySettings);
// só admin pode alterar os dados da empresa
router.post('/settings/company', authMiddleware, roleMiddleware(['admin']), saveCompanySettings);
// employees podem ver as preferências (GET /settings/company), mas só admin/manager podem alterá-las
router.post('/settings/notifications', authMiddleware, roleMiddleware(['admin', 'manager']), saveNotificationPreferences);
// só admin pode editar os templates de mensagens
router.post('/settings/messages', authMiddleware, roleMiddleware(['admin']), saveMessageTemplates);
router.get('/', authMiddleware, roleMiddleware(['admin', 'manager']), getUsers);
router.patch('/:id/role', authMiddleware, roleMiddleware(['admin']), updateUserRole);
router.patch('/:id/active', authMiddleware, roleMiddleware(['admin']), updateUserActive);

export default router;
