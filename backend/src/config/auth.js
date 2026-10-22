/**
 * Gera e valida tokens JWT para autenticação do backend.
 * @module config/auth
 */
import jwt from 'jsonwebtoken';

const secret = process.env.JWT_SECRET || 'smartstock_dev_secret';

/**
 * Executa a operação sign token.
 */
export const signToken = (payload) => jwt.sign(payload, secret, { expiresIn: '7d' });
/**
 * Executa a operação verify token.
 */
export const verifyToken = (token) => jwt.verify(token, secret);
