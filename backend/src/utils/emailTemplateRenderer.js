/**
 * Renderiza templates de e-mail com substituição de placeholders baseados em dados.
 * @module utils/emailTemplateRenderer
 */
const normalizeTemplate = (template = '') => String(template ?? '').replace(/\r\n/g, '\n');

/**
 * Renderiza email template.
 */
export const renderEmailTemplate = (template = '', data = {}) => {
  if (!template) return '';

  let out = normalizeTemplate(template);

  out = out.replace(/{{#each\s+([a-zA-Z0-9_]+)}}([\s\S]*?){{\/each}}/g, (_, arrName, inner) => {
    const arr = Array.isArray(data?.[arrName]) ? data[arrName] : [];
    return arr.map((item) => {
      return inner.replace(/{{\s*([a-zA-Z0-9_\.]+)\s*}}/g, (m, key) => {
        if (item && item[key] !== undefined) return String(item[key]);
        if (data && data[key] !== undefined) return String(data[key]);
        return '';
      });
    }).join('');
  });

  out = out.replace(/{{\s*([a-zA-Z0-9_\.]+)\s*}}/g, (m, key) => {
    if (data && data[key] !== undefined) return String(data[key]);
    return '';
  });

  return out;
};
