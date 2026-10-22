import { createContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'smartstock-settings';

/**
 * Configurações padrão da aplicação (dados da empresa, preferências de exibição, notificações
 * e modelos de mensagem) usadas quando nada foi salvo em localStorage ainda.
 * @type {Object}
 */
export const defaultSettings = {
  companyName: 'SmartStock',
  companyAddress: 'Rua da Conveniência I',
  companyEmail: 'albertooh2589@gmail.com',
  companyPhone: '911576629',
  company_vat: '',
  displayName: '',
  currency: 'EUR',
  timezone: 'Europe/Lisbon',
  dateFormat: 'dd/MM/yyyy',
  language: 'en-GB',
  theme: 'light',
  notifications: {
    alerts: { email: true, sms: false },
    reports: { email: true, sms: false },
  },
  messages: {
    ReservationReady: {
      subject: 'Reservation ready - {{company_name}} - {{date}}',
      body:
        "Reservation ready - {{company_name}} - {{date}}\n\nDear {{customer_name}},\n\nGreat news! Your reservation is now ready for pickup.\n\nItems available:\n{{#each items}}- {{name}}\n{{/each}}\n\nPickup location: {{store_name}} - {{store_address}}\nPickup deadline: {{pickup_deadline}}\n\nBest regards,\n{{company_name}} Team",
    },
    OrderConfirmation: {
      subject: 'Reservation confirmation - {{company_name}} - {{date}}',
      body:
        "Reservation confirmation - {{company_name}} - {{date}}\n\nDear {{customer_name}},\n\nThank you for your reservation at {{company_name}}.\n\nItems reserved:\n{{#each items}}- {{name}} (Qty: {{quantity}})\n{{/each}}\n\nBest regards,\n{{company_name}} Team",
    },
    supplier: {
      subject: 'Purchase order - {{company_name}} - {{date}}',
      body:
        "Purchase order - {{company_name}} - {{date}}\n\nDear {{supplier_name}},\n\nPlease find below our purchase order details:\n\nCompany: {{company_name}}\nAddress: {{company_address}}\nContact Email: {{contact_email}}\nContact Phone: {{contact_phone}}\nVAT Number: {{company_vat}}\nDate: {{date}}\n\nORDER DETAILS:\n\n{{#each items}}- Product: {{name}}\n  Reference: {{ref}}\n  Quantity: {{quantity}}\n  Unit Price: €{{unit_price}}\n  Subtotal: €{{subtotal}}\n\n{{/each}}Subtotal: €{{subtotal_total}}\nVAT ({{vat_rate}}%): €{{vat_amount}}\nTOTAL: €{{total_amount}}\n\nDelivery deadline: {{delivery_date}}\nPayment terms: {{payment_terms}}\nPartial delivery: {{partial_delivery}}\n\nPlease confirm receipt of this order.\n\nKind regards,\n{{company_name}}",
    },
  },
};

/**
 * Contexto React que expõe as configurações da aplicação (empresa, preferências, notificações
 * e modelos de mensagem) e as ações para atualizá-las ou restaurá-las ao padrão.
 * @module context/SettingsContext
 */
export const SettingsContext = createContext();

/**
 * Lê as configurações guardadas em localStorage, normalizando os modelos
 * de mensagem (formatos antigos em string ou {title,body}) para o formato
 * atual {subject,body} e preenchendo lacunas com os valores por omissão.
 *
 * @returns {Object} Configurações lidas (ou os valores por omissão em caso de erro/ausência).
 */
const readSettings = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;
    const parsed = { ...defaultSettings, ...JSON.parse(raw) };
    // normalize message templates: older versions stored plain strings or {title,body}
    const msgs = parsed.messages || {};
    const normalized = Object.fromEntries(
      Object.entries(msgs).map(([k, v]) => {
        if (typeof v === 'string') return [k, { subject: k.replace(/([A-Z])/g, ' $1').trim(), body: v }];
        if (v && typeof v === 'object') {
          // map older {title,body} to {subject,body}
          if (v.title && !v.subject) return [k, { subject: v.title, body: v.body || '' }];
          return [k, v];
        }
        return [k, defaultSettings.messages[k]];
      })
    );
    parsed.messages = normalized;
    return parsed;
  } catch {
    return defaultSettings;
  }
};

/**
 * Provider que gerencia as configurações da aplicação, persistindo-as em localStorage e
 * aplicando idioma/tema ao documento sempre que mudam.
 *
 * @param {Object} props Propriedades do componente.
 * @param {import('react').ReactNode} props.children Elementos filhos que terão acesso ao contexto.
 * @returns {JSX.Element} Provider do {@link SettingsContext}.
 */
export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(readSettings);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    document.documentElement.lang = settings.language || 'en-GB';
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings]);

  /**
   * Aplica um patch parcial às configurações atuais, fazendo merge
   * profundo dos grupos `notifications` e `messages` em vez de os
   * substituir por completo.
   *
   * @param {Object} patch Alterações parciais a aplicar às configurações.
   * @returns {void}
   */
  const updateSettings = (patch) => {
    setSettings((current) => ({
      ...current,
      ...patch,
      notifications: patch.notifications ? { ...current.notifications, ...patch.notifications } : current.notifications,
      messages: patch.messages ? { ...current.messages, ...patch.messages } : current.messages,
    }));
  };

  /**
   * Restaura todas as configurações (incluindo notificações e modelos de
   * mensagem) para os valores por omissão da aplicação.
   *
   * @returns {void}
   */
  const resetSettings = () => setSettings({
    ...defaultSettings,
    notifications: {
      alerts: { ...defaultSettings.notifications.alerts },
      reports: { ...defaultSettings.notifications.reports },
    },
    messages: {
      ReservationReady: { ...defaultSettings.messages.ReservationReady },
      OrderConfirmation: { ...defaultSettings.messages.OrderConfirmation },
      supplier: { ...defaultSettings.messages.supplier },
    },
  });

  const value = useMemo(() => ({ settings, updateSettings, resetSettings }), [settings]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};
