import express from 'express';
import {
  login,
  register,
  verifyEmail,
  me,
  forgotPassword,
  resetPassword
} from '../controllers/authController.js';

import { authMiddleware } from '../middlewares/authMiddleware.js';

/**
 * Rotas de autenticação da aplicação.
 * Expõe endpoints de login, registro, verificação de e-mail e recuperação de senha.
 */
const router = express.Router();

router.post('/login', login);
router.post('/register', register);
router.get('/verify-email', verifyEmail);
router.get('/me', authMiddleware, me);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router;