/**
 * Utilitários para normalizar e resolver configurações da empresa.
 * @module utils/companySettings
 */
/**
 * Normaliza o payload de configurações da empresa recebido do frontend (aceita chaves
 * em snake_case ou camelCase) e aplica valores padrão para os campos ausentes.
 *
 * @param {Object} [payload={}] Payload bruto recebido do cliente.
 * @returns {Object} Configurações normalizadas prontas para persistir na tabela `settings`.
 */
export function normalizeCompanySettingsPayload(payload = {}) {
  return {
    company_name: payload.company_name || payload.companyName || '',
    company_address: payload.company_address || payload.companyAddress || '',
    company_email: payload.company_email || payload.companyEmail || '',
    company_phone: payload.company_phone || payload.companyPhone || '',
    company_vat: payload.company_vat || payload.companyVat || '',
    currency: payload.currency || 'EUR',
    timezone: payload.timezone || 'Europe/Lisbon',
    date_format: payload.date_format || payload.dateFormat || 'dd/MM/yyyy',
    reservation_enabled: payload.reservation_enabled ?? true,
    theme: payload.theme || 'light'
  };
}

/**
 * Resolve os dados da empresa (nome, endereço, contactos, NIF) usados no cabeçalho de
 * pedidos de compra a fornecedores, com fallback para variáveis de ambiente.
 *
 * @param {Object} [settings={}] Configurações da empresa vindas da tabela `settings`.
 * @param {NodeJS.ProcessEnv} [env=process.env] Fonte de variáveis de ambiente para fallback.
 * @returns {{companyName: string, deliveryAddress: string, contactEmail: string, contactPhone: string, companyVat: string, contactLabel: string}} Dados resolvidos da empresa.
 */
export function resolvePurchaseOrderCompanyDetails(settings = {}, env = process.env) {
  const companyName = settings.company_name || settings.companyName || env.COMPANY_NAME || 'SmartStock';
  const deliveryAddress = settings.company_address || settings.companyAddress || env.COMPANY_ADDRESS || 'Main Street, 123';
  const contactEmail = settings.company_email || settings.companyEmail || env.COMPANY_EMAIL || '';
  const contactPhone = settings.company_phone || settings.companyPhone || env.COMPANY_PHONE || '';
  const companyVat = settings.company_vat || settings.companyVat || env.COMPANY_VAT || '';

  return {
    companyName,
    deliveryAddress,
    contactEmail,
    contactPhone,
    companyVat,
    contactLabel: [contactEmail, contactPhone].filter(Boolean).join(' / ')
  };
}
