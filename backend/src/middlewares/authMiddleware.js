
/**
 * Middleware que valida tokens Bearer e anexa o usuário autenticado à requisição.
 * @module middlewares/authMiddleware
 */
import { verifyToken } from '../config/auth.js';

/**
 * Executa a operação auth middleware.
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde em JSON com o resultado da operação ou erro apropriado.
 */
export const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Missing or invalid token.' });
  }

  try {
    req.user = verifyToken(token);
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token expired or invalid.' });
  }
};
