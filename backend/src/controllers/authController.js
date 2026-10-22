import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { dbQuery } from '../config/db.js';
import { signToken } from '../config/auth.js';
import { sendEmail } from '../config/mail.js';

/**
 * Controlador responsável por autenticação, cadastro, verificação de e-mail e recuperação de senha.
 * @module controllers/authController
 */
/**
 * Obtém a URL base do backend, usada para montar links absolutos (ex.: em
 * emails de verificação).
 *
 * @returns {string} URL base do backend.
 */
const getBackendUrl = () => process.env.BACKEND_URL || process.env.API_URL || 'http://localhost:5000';

/**
 * Obtém a URL base do frontend, usada para montar links absolutos (ex.: em
 * emails de recuperação de senha).
 *
 * @returns {string} URL base do frontend.
 */
const getFrontendUrl = () => process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * Monta o conteúdo (HTML e texto) de um email simples a partir de um
 * assunto e corpo em texto, convertendo quebras de linha em parágrafos HTML.
 *
 * @param {Object} params Dados do email.
 * @param {string} params.subject Assunto do email.
 * @param {string} params.body Corpo do email em texto simples.
 * @returns {{subject: string, html: string, text: string}} Conteúdo pronto para envio.
 */
const buildEmailContent = ({ subject, body }) => {
  const html = `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #24292f;">${body.replace(/\n/g, '<br /><br />')}</div>`;
  return {
    subject,
    html,
    text: body,
  };
};

/**
 * Executa a operação login.
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde em JSON com o resultado da operação ou erro apropriado.
 */
export const login = async (req, res) => {
  const { email, password } = req.body;

  const result = await dbQuery('SELECT * FROM users WHERE email = $1', [email]);
  const user = result.rows[0];

  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  if (!user.email_verified) {
    return res.status(403).json({ message: 'Please verify your email before logging in.' });
  }

  const match = await bcrypt.compare(password, user.password);

  if (!match) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = signToken({ id: user.id, role: user.role });

  return res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
};

/**
 * Executa a operação register.
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde em JSON com o resultado da operação ou erro apropriado.
 */
export const register = async (req, res) => {
  const { name, email, password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationExpires = new Date(Date.now() + 1000 * 60 * 60 * 24);

  try {
    const result = await dbQuery(
      `INSERT INTO users (name, email, password, email_verification_token, email_verification_expires)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, email_verified`,
      [name, email, hash, verificationToken, verificationExpires]
    );

    const user = result.rows[0];
    const verificationUrl = `${getFrontendUrl()}/verify-email?token=${verificationToken}`;
    const emailContent = buildEmailContent({
      subject: 'Confirm your SmartStock account',
      body: `Hello ${name || 'there'},\n\nThank you for registering with SmartStock. Please confirm your email address by clicking the link below:\n\n${verificationUrl}\n\nThis link will expire in 24 hours. If you did not sign up, please ignore this message.\n\nThanks,\nSmartStock`,
    });

    await sendEmail({
      to: email,
      ...emailContent,
    });

    return res.json({
      ...user,
      message: 'Registration successful. Please check your email to confirm your account.',
    });
  } catch (err) {
    console.error('[auth] register failed:', err?.message || err);
    const isDuplicateEmail = err?.code === '23505';
    if (isDuplicateEmail) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    return res.status(500).json({ message: 'Unable to complete registration.' });
  }
};

/**
 * Executa a operação verify email.
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde em JSON com o resultado da operação ou erro apropriado.
 */
export const verifyEmail = async (req, res) => {
  const token = req.query.token || req.body.token;

  if (!token) {
    return res.status(400).json({ message: 'Verification token is required.' });
  }

  const result = await dbQuery(
    `SELECT id FROM users
     WHERE email_verification_token = $1
       AND email_verification_expires > NOW()
     LIMIT 1`,
    [token]
  );

  const user = result.rows[0];

  if (!user) {
    return res.status(400).json({ message: 'Invalid or expired verification token.' });
  }

  await dbQuery(
    `UPDATE users
     SET email_verified = TRUE,
         email_verification_token = NULL,
         email_verification_expires = NULL
     WHERE id = $1`,
    [user.id]
  );

  return res.json({ message: 'Email confirmed successfully. You can now log in.' });
};

/**
 * Executa a operação me.
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde em JSON com o resultado da operação ou erro apropriado.
 */
export const me = async (req, res) => {
  const result = await dbQuery(
    'SELECT id, name, email, role FROM users WHERE id = $1',
    [req.user.id]
  );

  return res.json(result.rows[0] || null);
};

/**
 * Executa a operação forgot password.
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde em JSON com o resultado da operação ou erro apropriado.
 */
export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  const userResult = await dbQuery('SELECT * FROM users WHERE email = $1', [email]);
  const user = userResult.rows[0];

  if (!user) {
    return res.json({ message: 'If the email exists, a reset link was sent' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expire = new Date(Date.now() + 1000 * 60 * 30);

  await dbQuery(
    `UPDATE users
     SET reset_token = $1,
         reset_token_expires = $2
     WHERE id = $3`,
    [token, expire, user.id]
  );

  const resetUrl = `${getFrontendUrl()}/reset-password?token=${token}`;
  const emailContent = buildEmailContent({
    subject: 'Reset your SmartStock password',
    body: `Hello ${user.name || 'there'},\n\nWe received a request to reset your password. Click the link below to choose a new password:\n\n${resetUrl}\n\nThis link will expire in 30 minutes. If you did not request a password reset, please ignore this email.\n\nThanks,\nSmartStock`,
  });

  try {
    await sendEmail({
      to: email,
      ...emailContent,
    });
  } catch (err) {
    console.error('[auth] forgotPassword send failed:', err?.message || err);
  }

  return res.json({ message: 'If the email exists, a reset link was sent' });
};

/**
 * Executa a operação reset password.
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde em JSON com o resultado da operação ou erro apropriado.
 */
export const resetPassword = async (req, res) => {
  const { token, password } = req.body;

  const result = await dbQuery(
    `SELECT * FROM users
     WHERE reset_token = $1
       AND reset_token_expires > NOW()`,
    [token]
  );

  const user = result.rows[0];

  if (!user) {
    return res.status(400).json({ message: 'Invalid or expired token' });
  }

  const hash = await bcrypt.hash(password, 10);

  await dbQuery(
    `UPDATE users
     SET password = $1,
         reset_token = NULL,
         reset_token_expires = NULL
     WHERE id = $2`,
    [hash, user.id]
  );

  return res.json({ message: 'Password updated successfully' });
};
