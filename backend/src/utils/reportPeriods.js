/**
 * Auxilia na construção e normalização de janelas de relatórios por semana ou mês.
 * @module utils/reportPeriods
 */
/**
 * Normaliza um valor para uma data UTC à meia-noite (sem componente de
 * hora), retornando 1970-01-01 como fallback quando o valor for inválido.
 *
 * @param {Date|string} value Data a normalizar.
 * @returns {Date} Data normalizada em UTC.
 */
const normalizeDate = (value) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date(Date.UTC(1970, 0, 1));
  }

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

/**
 * Calcula a segunda-feira (início) da semana ISO que contém a data indicada.
 *
 * @param {Date|string} date Data de referência.
 * @returns {Date} Data de início da semana (UTC).
 */
const startOfWeek = (date) => {
  const normalized = normalizeDate(date);
  const day = normalized.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  normalized.setUTCDate(normalized.getUTCDate() + diff);
  return normalized;
};

/**
 * Calcula o domingo (fim) da semana ISO que contém a data indicada.
 *
 * @param {Date|string} date Data de referência.
 * @returns {Date} Data de fim da semana (UTC).
 */
const endOfWeek = (date) => {
  const normalized = startOfWeek(date);
  normalized.setUTCDate(normalized.getUTCDate() + 6);
  return normalized;
};

/**
 * Calcula o primeiro dia do mês que contém a data indicada.
 *
 * @param {Date|string} date Data de referência.
 * @returns {Date} Primeiro dia do mês (UTC).
 */
const startOfMonth = (date) => {
  const normalized = normalizeDate(date);
  return new Date(Date.UTC(normalized.getUTCFullYear(), normalized.getUTCMonth(), 1));
};

/**
 * Calcula o último dia do mês que contém a data indicada.
 *
 * @param {Date|string} date Data de referência.
 * @returns {Date} Último dia do mês (UTC).
 */
const endOfMonth = (date) => {
  const normalized = normalizeDate(date);
  return new Date(Date.UTC(normalized.getUTCFullYear(), normalized.getUTCMonth() + 1, 0));
};

/**
 * Calcula o fim (domingo) da última semana já totalmente concluída em
 * relação à data indicada.
 *
 * @param {Date|string} date Data de referência.
 * @returns {Date} Data de fim da última semana concluída (UTC).
 */
const getLastCompletedWeekEnd = (date) => {
  const normalized = normalizeDate(date);
  const daysBack = normalized.getUTCDay() === 0 ? 0 : normalized.getUTCDay();
  const lastSunday = new Date(normalized);
  lastSunday.setUTCDate(normalized.getUTCDate() - daysBack);
  return lastSunday;
};

/**
 * Calcula o fim (último dia) do último mês já totalmente concluído em
 * relação à data indicada.
 *
 * @param {Date|string} date Data de referência.
 * @returns {Date} Data de fim do último mês concluído (UTC).
 */
const getLastCompletedMonthEnd = (date) => {
  const normalized = normalizeDate(date);
  return new Date(Date.UTC(normalized.getUTCFullYear(), normalized.getUTCMonth(), 0));
};

/**
 * Formata uma data no formato ISO curto (YYYY-MM-DD).
 *
 * @param {Date|string} date Data a formatar.
 * @returns {string} Data formatada.
 */
const formatDateValue = (date) => {
  const normalized = normalizeDate(date);
  const year = normalized.getUTCFullYear();
  const month = String(normalized.getUTCMonth() + 1).padStart(2, '0');
  const day = String(normalized.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Constrói report window.
 */
export const buildReportWindow = (type = 'weekly', referenceDate = new Date()) => {
  const normalized = normalizeDate(referenceDate);

  if (String(type).toLowerCase() === 'monthly') {
    const since = new Date(Date.UTC(normalized.getUTCFullYear(), normalized.getUTCMonth() - 1, 1));
    const until = new Date(Date.UTC(normalized.getUTCFullYear(), normalized.getUTCMonth(), 0));
    return {
      type: 'monthly',
      since,
      until,
    };
  }

  const lastSunday = new Date(normalized);
  lastSunday.setUTCDate(normalized.getUTCDate() - (normalized.getUTCDay() === 0 ? 0 : normalized.getUTCDay()));

  const since = new Date(lastSunday);
  since.setUTCDate(lastSunday.getUTCDate() - 6);

  const until = new Date(lastSunday);

  return {
    type: 'weekly',
    since,
    until,
  };
};

/**
 * Retorna historical report periods.
 */
export const getHistoricalReportPeriods = (fromDate = null, toDate = null, referenceDate = null) => {
  const startDate = normalizeDate(fromDate || new Date('1970-01-01T00:00:00.000Z'));
  const endDate = normalizeDate(toDate || new Date());
  const effectiveReferenceDate = referenceDate ? normalizeDate(referenceDate) : null;

  const weeklyPeriods = [];
  let weeklyCursor = startOfWeek(startDate);
  const weeklyEnd = effectiveReferenceDate
    ? startOfWeek(getLastCompletedWeekEnd(effectiveReferenceDate))
    : startOfWeek(endDate);

  while (weeklyCursor <= weeklyEnd) {
    weeklyPeriods.push({
      type: 'weekly',
      since: new Date(weeklyCursor),
      until: endOfWeek(weeklyCursor),
    });
    weeklyCursor.setUTCDate(weeklyCursor.getUTCDate() + 7);
  }

  const monthlyPeriods = [];
  let monthlyCursor = startOfMonth(startDate);
  const monthlyEnd = effectiveReferenceDate
    ? startOfMonth(getLastCompletedMonthEnd(effectiveReferenceDate))
    : startOfMonth(endDate);

  while (monthlyCursor <= monthlyEnd) {
    monthlyPeriods.push({
      type: 'monthly',
      since: new Date(monthlyCursor),
      until: endOfMonth(monthlyCursor),
    });
    monthlyCursor = new Date(Date.UTC(monthlyCursor.getUTCFullYear(), monthlyCursor.getUTCMonth() + 1, 1));
  }

  return [...weeklyPeriods, ...monthlyPeriods].sort((a, b) => a.since - b.since);
};

/**
 * Retorna range label.
 */
export const getRangeLabel = (type, since, until) => {
  const start = formatDateValue(since);
  const end = formatDateValue(until);
  return `${type.toUpperCase()} ${start} → ${end}`;
};
