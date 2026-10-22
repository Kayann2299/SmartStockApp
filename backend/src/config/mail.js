
/**
 * Fornece transportes e helpers de template para enviar mensagens transacionais por e-mail.
 * @module config/mail
 */
import { createTransport } from 'nodemailer';
import { loadEnv } from './env.js';
import { renderEmailTemplate } from '../utils/emailTemplateRenderer.js';

/**
 * Obtém a chave de API do Brevo (Sendinblue) configurada no ambiente,
 * aceitando qualquer uma das variáveis alternativas suportadas.
 *
 * @returns {string|undefined} Chave de API encontrada, ou undefined se nenhuma estiver definida.
 */
const getBrevoApiKey = () => process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY || process.env.BREVO_KEY || process.env.SENDINBLUE_KEY;

/**
 * Cria e configura o transporte SMTP (nodemailer) usado como alternativa
 * quando a API do Brevo não está disponível.
 *
 * @returns {import('nodemailer').Transporter} Transporte SMTP configurado.
 */
const createMailTransport = () => {
  loadEnv();

  const smtpHost = process.env.SMTP_HOST || process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com';
  const smtpPort = Number(process.env.SMTP_PORT || process.env.BREVO_SMTP_PORT || 587);
  const smtpSecure = process.env.SMTP_SECURE !== undefined
    ? process.env.SMTP_SECURE === 'true'
    : (process.env.BREVO_SMTP_SECURE === 'true');

  const transportOptions = {
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    requireTLS: true,
    authMethod: 'PLAIN'
  };

  const authUser = process.env.SMTP_USER
    || process.env.BREVO_SMTP_USER
    || process.env.SMTP_LOGIN
    || process.env.SMTP_USERNAME;

  const authPass = process.env.SMTP_PASS
    || process.env.BREVO_SMTP_PASS
    || process.env.SMTP_PASSWORD
    || process.env.SMTP_API_KEY
    || process.env.SMTP_KEY
    || process.env.BREVO_SMTP_KEY;

  if (authUser) {
    transportOptions.auth = {
      user: authUser,
      pass: authPass || ''
    };
  }

  console.log('[mail] transport config:', {
    host: transportOptions.host,
    port: transportOptions.port,
    secure: transportOptions.secure,
    requireTLS: transportOptions.requireTLS,
    authUser: transportOptions.auth?.user ? true : false,
    from: process.env.SMTP_FROM || process.env.BREVO_SMTP_FROM || 'no-reply@example.com'
  });

  return createTransport(transportOptions);
};

/**
 * Envia um email através da API HTTP do Brevo (usado em preferência ao SMTP
 * quando existe uma chave de API configurada).
 *
 * @param {Object} params Dados do email.
 * @param {string} params.to Endereço do destinatário.
 * @param {string} params.subject Assunto do email.
 * @param {string} [params.html] Corpo em HTML.
 * @param {string} [params.text] Corpo em texto simples.
 * @param {string} [params.from] Endereço do remetente (opcional).
 * @returns {Promise<Object>} Resposta JSON da API do Brevo.
 */
const sendEmailViaBrevoApi = async ({ to, subject, html, text, from }) => {
  const apiKey = getBrevoApiKey();
  if (!apiKey) {
    throw new Error('Brevo API key not configured. Set BREVO_API_KEY or SENDINBLUE_API_KEY.');
  }

  const senderEmail = from || process.env.SMTP_FROM || process.env.BREVO_SMTP_FROM || 'no-reply@example.com';
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey
    },
    body: JSON.stringify({
      sender: {
        name: process.env.SMTP_FROM_NAME || 'SmartStock',
        email: senderEmail
      },
      to: [{ email: to }],
      subject,
      htmlContent: html || '',
      textContent: text || ''
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Brevo API error ${response.status}: ${errorText}`);
  }

  return response.json();
};

/**
 * Converte HTML simples num texto plano equivalente, para usar como
 * versão `text` alternativa de emails renderizados em HTML.
 *
 * @param {string} [value=''] Conteúdo HTML de origem.
 * @returns {string} Texto plano correspondente.
 */
const htmlToText = (value = '') => {
  if (!value) return '';

  return String(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|ul|ol|li|h[1-6]|blockquote|pre|tr|table)>/gi, '\n')
    .replace(/<li>/gi, '\n- ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .trim();
};

/**
 * Escapa caracteres HTML especiais (&, <, >) para inserção segura de texto
 * plano dentro de um corpo de email em HTML.
 *
 * @param {string} [value=''] Texto a escapar.
 * @returns {string} Texto com os caracteres especiais escapados.
 */
const htmlEscape = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

/**
 * Renderiza email template body.
 */
export const renderEmailTemplateBody = ({ subject, body, data = {}, fallbackSubject, fallbackBody }) => {
  const resolvedSubject = renderEmailTemplate(subject || fallbackSubject || '', data);
  const resolvedBody = renderEmailTemplate(body || fallbackBody || '', data);
  const normalizedBody = String(resolvedBody || '');
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(normalizedBody);
  const textBody = looksLikeHtml ? htmlToText(normalizedBody) : normalizedBody;
  const htmlBody = looksLikeHtml
    ? normalizedBody.replace(/\r\n/g, '\n').replace(/\n/g, '<br />')
    : `<div style="white-space: pre-wrap; font-family: Arial, sans-serif; line-height: 1.6;">${htmlEscape(normalizedBody).replace(/\n/g, '<br />')}</div>`;

  return {
    subject: resolvedSubject,
    html: htmlBody,
    text: textBody
  };
};

/**
 * Resolve o conteúdo final (assunto, HTML e texto) de um template de email,
 * substituindo os placeholders pelos dados fornecidos.
 *
 * @param {Object} params Parâmetros do template.
 * @param {string} params.subject Assunto do template (com placeholders).
 * @param {string} params.body Corpo do template (com placeholders).
 * @param {Object} [params.data={}] Dados para substituição dos placeholders.
 * @param {string} [params.fallbackSubject] Assunto alternativo caso `subject` esteja vazio.
 * @param {string} [params.fallbackBody] Corpo alternativo caso `body` esteja vazio.
 * @returns {{subject: string, html: string, text: string}} Conteúdo final do email.
 */
const resolveTemplateContent = ({ subject, body, data = {}, fallbackSubject, fallbackBody }) => {
  return renderEmailTemplateBody({ subject, body, data, fallbackSubject, fallbackBody });
};

/**
 * Envia email.
 */
export const sendEmail = async ({ to, subject, html, text, from, template, templateData, fallbackSubject, fallbackBody }) => {
  if (!to) {
    throw new Error('Recipient email is required.');
  }
  // A template-driven send is any call that supplied a saved template OR fallback
  // content to render it with (reservation/supplier flows). Plain transactional
  // emails (password reset, reports, stock alerts, etc.) pass subject/html/text
  // directly and never set fallbackSubject/fallbackBody, so they keep using the
  // raw content untouched.
  const isTemplateDriven = Boolean(template || fallbackSubject || fallbackBody);

  const apiKey = getBrevoApiKey();
  if (apiKey) {
    try {
      const resolved = isTemplateDriven
        ? resolveTemplateContent({ subject: template?.subject, body: template?.body, data: templateData, fallbackSubject, fallbackBody })
        : { subject, html: html || '', text: text || '' };
      const result = await sendEmailViaBrevoApi({ to, subject: resolved.subject, html: resolved.html, text: resolved.text, from });
      console.log('[mail] sent via Brevo API:', result?.messageId || result?.id || 'ok');
      return result;
    } catch (err) {
      console.error('[mail] Brevo API send failed:', err?.message || err);
      throw err;
    }
  }

  const resolved = isTemplateDriven
    ? resolveTemplateContent({ subject: template?.subject, body: template?.body, data: templateData, fallbackSubject, fallbackBody })
    : { subject, html: html || '', text: text || '' };

  const mailTransport = createMailTransport();
  const message = {
    from: from || process.env.SMTP_FROM || process.env.BREVO_SMTP_FROM || 'no-reply@example.com',
    to,
    subject: resolved.subject,
    html: resolved.html,
    text: resolved.text
  };

  try {
    const info = await mailTransport.sendMail(message);
    console.log('[mail] sent via SMTP:', info.messageId || info.messageId);
    return info;
  } catch (err) {
    console.error('[mail] send failed:', err);
    throw err;
  }
};
