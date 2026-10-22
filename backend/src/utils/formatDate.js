/**
 * Formata valores de data para exibição.
 * @module utils/formatDate
 */
export const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  return new Intl.DateTimeFormat('pt-PT', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};
