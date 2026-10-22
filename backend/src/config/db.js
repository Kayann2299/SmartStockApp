/**
 * Configura o pool de conexão PostgreSQL e os helpers de banco usados no backend.
 * @module config/db
 */
import pkg from 'pg';
import { loadEnv } from './env.js';

loadEnv();

const { Pool } = pkg;

/**
 * Pool de conexões PostgreSQL compartilhado pela aplicação, configurado via variáveis de ambiente.
 * @type {import('pg').Pool}
 */
export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'smartstock',
  port: Number(process.env.DB_PORT || 5432),
  max: Number(process.env.DB_POOL_MAX || 10)
});

/**
 * Executa a operação db query.
 */
export const dbQuery = (text, params) => pool.query(text, params);

/**
 * Garante que a tabela `settings` tem as colunas de dados da empresa e de
 * preferências de notificação, criando-as se ainda não existirem
 * (migração idempotente executada no arranque).
 *
 * @returns {Promise<void>} Resolve quando todas as colunas tiverem sido garantidas.
 */
const ensureSettingsColumns = async () => {
  const columns = [
    { name: 'company_address', type: 'VARCHAR(255)' },
    { name: 'company_email', type: 'VARCHAR(255)' },
    { name: 'company_phone', type: 'VARCHAR(50)' },
    { name: 'company_vat', type: 'VARCHAR(100)' },
    {
      name: 'notification_preferences',
      type: `JSONB DEFAULT '{"alerts":{"email":true,"sms":false},"reports":{"email":true,"sms":false}}'::jsonb`
    },
    { name: 'last_stock_alert_at', type: 'TIMESTAMP' }
  ];

  for (const column of columns) {
    await dbQuery(`ALTER TABLE settings ADD COLUMN IF NOT EXISTS ${column.name} ${column.type}`);
  }
};

/**
 * Garante que a tabela `message_templates` existe, criando-a se necessário
 * (migração idempotente executada no arranque).
 *
 * @returns {Promise<void>} Resolve quando a tabela tiver sido garantida.
 */
const ensureMessageTemplatesTable = async () => {
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS message_templates (
      id SERIAL PRIMARY KEY,
      type VARCHAR(50),
      subject VARCHAR(150),
      content TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

/**
 * Garante que a tabela `users` tem as colunas de verificação de email e
 * redefinição de password, criando-as se ainda não existirem (migração
 * idempotente executada no arranque). Falhas por coluna são apenas
 * registadas (warning), sem interromper as restantes.
 *
 * @returns {Promise<void>} Resolve quando todas as colunas tiverem sido processadas.
 */
const ensureUserColumns = async () => {
  const columns = [
    { name: 'is_active', type: 'BOOLEAN DEFAULT TRUE' },
    { name: 'email_verified', type: 'BOOLEAN DEFAULT FALSE' },
    { name: 'email_verification_token', type: 'TEXT' },
    { name: 'email_verification_expires', type: 'TIMESTAMP' },
    { name: 'reset_token', type: 'TEXT' },
    { name: 'reset_token_expires', type: 'TIMESTAMP' }
  ];

  for (const column of columns) {
    try {
      await dbQuery(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${column.name} ${column.type}`);
    } catch (error) {
      console.warn('Unable to ensure users column', column.name, ':', error?.message || error);
    }
  }
};


ensureSettingsColumns().catch((error) => {
  console.warn('Unable to ensure company settings columns:', error?.message || error);
});

ensureMessageTemplatesTable().catch((error) => {
  console.warn('Unable to ensure message templates table:', error?.message || error);
});

ensureUserColumns().catch((error) => {
  console.warn('Unable to ensure users columns:', error?.message || error);
});
