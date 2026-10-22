
/**
 * Formata valores monetários e datas para a interface do frontend.
 * @module utils/formatters
 */
export const formatCurrency = (value, currency = 'EUR', locale = 'en-GB') => {
  const amount = Number(value || 0);
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
};

/**
 * Formata uma data/hora para exibição, respeitando o fuso horário e o formato configurados.
 *
 * @param {string|Date|null} value Valor de data a formatar (string ISO, Date, ou nulo).
 * @param {string} [timezone='Europe/Lisbon'] Fuso horário IANA usado na formatação.
 * @param {string} [format='dd/MM/yyyy'] Máscara de data (aceita os tokens `dd`, `MM`, `yyyy`).
 * @param {boolean} [showTime=true] Se verdadeiro, acrescenta a hora (HH:mm) ao resultado.
 * @returns {string} Data formatada, ou `'—'` se o valor for vazio/inválido.
 */
export const formatDate = (value, timezone = 'Europe/Lisbon', format = 'dd/MM/yyyy', showTime = true) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  /**
   * Preenche um número com zero à esquerda até 2 dígitos.
   *
   * @param {number} n Número a formatar.
   * @returns {string} Número formatado com 2 dígitos.
   */
  const pad = (n) => String(n).padStart(2, '0');
  const parts = {
    dd: pad(Number(new Intl.DateTimeFormat('en-GB', { day: '2-digit', timeZone: timezone }).format(date))),
    MM: pad(Number(new Intl.DateTimeFormat('en-GB', { month: '2-digit', timeZone: timezone }).format(date))),
    yyyy: new Intl.DateTimeFormat('en-GB', { year: 'numeric', timeZone: timezone }).format(date),
    HH: pad(Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: timezone }).format(date))),
    mm: pad(Number(new Intl.DateTimeFormat('en-GB', { minute: '2-digit', timeZone: timezone }).format(date))),
  };

  const datePart = format.replace('dd', parts.dd).replace('MM', parts.MM).replace('yyyy', parts.yyyy);
  return showTime ? `${datePart} ${parts.HH}:${parts.mm}` : datePart;
};

/**
 * Reformata o título de um relatório (ex.: "Weekly Report • 2026-07-01 → 2026-07-07"),
 * convertendo as datas ISO no intervalo para o fuso horário e formato configurados.
 *
 * @param {string} title Título original do relatório, terminado em "prefixo• yyyy-MM-dd → yyyy-MM-dd".
 * @param {string} [timezone='Europe/Lisbon'] Fuso horário IANA usado na formatação das datas.
 * @param {string} [format='dd/MM/yyyy'] Máscara de data (aceita os tokens `dd`, `MM`, `yyyy`).
 * @returns {string} Título com as datas reformatadas, ou o título original se não seguir o padrão esperado.
 */
export const formatReportTitle = (title, timezone = 'Europe/Lisbon', format = 'dd/MM/yyyy') => {
  if (!title) return title;
  const match = title.match(/^(.*?•)\s*([0-9]{4}-[0-9]{2}-[0-9]{2})\s*→\s*([0-9]{4}-[0-9]{2}-[0-9]{2})$/);
  if (!match) return title;
  const [, prefix, start, end] = match;
  return `${prefix} ${formatDate(start, timezone, format, false)} → ${formatDate(end, timezone, format, false)}`;
};
