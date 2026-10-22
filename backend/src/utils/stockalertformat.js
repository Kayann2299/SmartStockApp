  /**
 * Calcula métricas e riscos de estoque para alertas de disponibilidade.
 * @module utils/stockalertformat
 */
/**
 * Converte um valor qualquer para número, tratando null/undefined/NaN como 0.
 *
 * @param {*} value Valor a converter.
 * @returns {number} Valor numérico (0 se inválido).
 */
const toNumber = (value) => Number(value || 0);

  /**
   * Calcula as métricas de previsão de stock de um produto (stock
   * disponível, projeção a N dias, média de vendas diárias, dias até
   * rutura, quantidade recomendada de reposição) e classifica o nível de
   * risco correspondente.
   *
   * @param {Object} [params={}] Dados base do produto.
   * @param {number} [params.quantity=0] Quantidade em stock.
   * @param {number} [params.reservedQuantity=0] Quantidade reservada.
   * @param {number} [params.minLevel=0] Nível mínimo configurado para o produto.
   * @param {number} [params.supplierLeadTime=0] Prazo de entrega do fornecedor, em dias.
   * @param {number} [params.sold_Period_30=0] Unidades vendidas nos últimos 30 dias.
   * @param {number} [params.purchased_Period_30=0] Unidades já encomendadas nos últimos 30 dias.
   * @param {number} [params.stockForecastDays=30] Horizonte, em dias, usado para projetar o stock.
   * @returns {Object} Métricas calculadas, incluindo `riskLevel` ('healthy'|'low'|'critical'|'out_of_stock').
   */
  export const calculateStockAlertMetrics = ({
    quantity = 0,
    reservedQuantity = 0,
    minLevel = 0,
    supplierLeadTime = 0,
    sold_Period_30 = 0,
    purchased_Period_30 = 0,
    stockForecastDays = 30,
  } = {}) => {
    const normalizedQuantity = toNumber(quantity);
    const normalizedReserved = toNumber(reservedQuantity);
    const normalizedMinLevel = toNumber(minLevel);
    const normalizedLeadTime = toNumber(supplierLeadTime);
    const normalizedSoldPeriod30 = toNumber(sold_Period_30);
    const normalizedPurchasedPeriod30 = toNumber(purchased_Period_30);
    const normalizedTotalDays = Math.max(1, toNumber(stockForecastDays));
    const availableStock = Math.max(0, normalizedQuantity - normalizedReserved);
   

const averageDailySales =
  normalizedSoldPeriod30 > 0 ? normalizedSoldPeriod30 / 30 : 0;

  const projectedStock = Math.max( 0, availableStock - averageDailySales * 7);

  const daysToStockout =
  averageDailySales > 0 ? availableStock / averageDailySales : null;

const safetyDays = 14;

const demandUntilDelivery =
  averageDailySales * normalizedLeadTime;

const safetyStock =
  averageDailySales * safetyDays;

const requiredStock =
  Math.ceil(demandUntilDelivery + safetyStock);

const recommended_reorder = Math.max(
  0,
  requiredStock - availableStock 
);

    let riskLevel = 'healthy';
    let leadTimeAlert = false;


 const classification = classifyStockAlertRisk({
  availableStock,
  minLevel: normalizedMinLevel,
  supplierLeadTime: normalizedLeadTime,
  daysToStockout,
});
      riskLevel = classification.riskLevel;
      leadTimeAlert = classification.leadTimeAlert;
    

    return {
      quantity: normalizedQuantity,
      reservedQuantity: normalizedReserved,
      minLevel: normalizedMinLevel,
      supplierLeadTime: normalizedLeadTime,
      sold_Period_30: normalizedSoldPeriod30,
      purchased_Period_30: normalizedPurchasedPeriod30,
      availableStock: availableStock,
      projectedStock: projectedStock,
      averageDailySales: averageDailySales,
      daysToStockout: daysToStockout,
      recommended_reorder: recommended_reorder,
      riskLevel: riskLevel,
      leadTimeAlert: leadTimeAlert,
    }; 
  };

/**
 * Classifica stock alert risk.
 */
export const classifyStockAlertRisk = ({
  availableStock,
  minLevel = 0,
  supplierLeadTime = 0,
  daysToStockout = null
} = {}) => {

  const stock = toNumber(availableStock);
  const min = toNumber(minLevel);
  const lead = toNumber(supplierLeadTime);

  const hasForecast =
    daysToStockout !== null &&
    Number.isFinite(daysToStockout);

  if (stock <= 0) {
    return {
      riskLevel: 'out_of_stock',
      leadTimeAlert: false
    };
  }

  if (stock <= min) {
    return {
      riskLevel: 'critical',
      leadTimeAlert: false
    };
  }

  if (hasForecast && lead > 0 && daysToStockout < lead) {
    return {
      riskLevel: 'low',
      leadTimeAlert: true
    };
  }

  return {
    riskLevel: 'healthy',
    leadTimeAlert: false
  };
};
  /**
   * Verifica se um item de forecast de stock é "acionável", ou seja, está
   * em risco 'low' (não crítico nem sem stock) e o prazo de entrega do
   * fornecedor é maior ou igual aos dias restantes até à rutura —
   * indicando que vale a pena repor agora.
   *
   * @param {Object} [item={}] Item de forecast já classificado (com `risk_level`, `available_stock`, `min_level`, `supplier_lead_time`, `days_to_stockout`).
   * @returns {boolean} Verdadeiro se o item requer ação de reposição.
   */
  export const isActionableStockAlertItem = (item = {}) => {
    
    const risk = String(item?.risk_level || 'healthy').toLowerCase();

    if (risk === 'healthy' || risk === 'critical' || risk === 'out_of_stock') {
      return false;
    }

    const availableStock = Number(item?.available_stock ?? item?.quantity ?? 0);
    const minLevel = Number(item?.min_level ?? 0);
    const leadTime = Number(item?.supplier_lead_time ?? 0);
    const daysToStockout = Number(item?.days_to_stockout ?? Number.POSITIVE_INFINITY);

    if (availableStock <= minLevel) {
      return false;
    }

    if (!Number.isFinite(daysToStockout)) {
      return false;
    }

    return leadTime > 0 ? daysToStockout <= leadTime : false;
  }
