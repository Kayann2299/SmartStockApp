/**
 * Exibe um selo colorido indicando o estado de estoque de um produto (crítico, baixo ou saudável).
 *
 * @param {Object} props Propriedades do componente.
 * @param {number} [props.quantity=0] Quantidade disponível em estoque.
 * @param {number} [props.minLevel=0] Nível mínimo configurado para o produto.
 * @param {string|null} [props.status=null] Status de risco já calculado pelo backend (ex.: 'critical', 'low', 'out_of_stock'); se ausente, o badge deduz o estado a partir dos demais campos.
 * @param {number|null} [props.daysToStockout=null] Dias estimados até o esgotamento do estoque.
 * @param {number|null} [props.leadTime=null] Prazo de entrega (em dias) do fornecedor do produto.
 * @returns {JSX.Element} Selo "Critical stock", "Low stock" ou nenhum selo quando o estoque está saudável.
 */
export default function StockBadge({ quantity = 0, minLevel = 0, status = null, daysToStockout = null, leadTime = null }) {
  const normalizedStatus = String(status || '').toLowerCase().trim();
  const available = Number(quantity);
  const minimum = Number(minLevel);
  const days = Number(daysToStockout ?? Number.POSITIVE_INFINITY);
  const lead = Number(leadTime ?? 0);
  const isCritical = normalizedStatus === 'critical' || normalizedStatus === 'out_of_stock' || (!normalizedStatus && available <= minimum);
  const isLow = normalizedStatus === 'warning' || normalizedStatus === 'low' || (!normalizedStatus && lead > 0 && Number.isFinite(days) && days <= lead);

  if (isCritical) {
    return <span className="badge badge-danger">Critical stock</span>;
  }

  if (isLow) {
    return <span className="badge badge-warning">Low stock</span>;
  }

  return <span className="badge badge-ok">OK</span>;
}
