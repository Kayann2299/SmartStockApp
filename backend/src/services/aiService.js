import Groq from 'groq-sdk';

let groqClient = null;
let modelName = null;

/**
 * Obtém a chave de API configurada para o provedor de IA.
 *
 * @returns {string} Chave de API configurada no ambiente.
 */
const getApiKey = () => process.env.GROQ_API_KEY || '';

/**
 * Obtém o nome do modelo de IA configurado para a aplicação.
 *
 * @returns {string} Nome do modelo a ser utilizado.
 */
const getModelName = () => process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

/**
 * Inicializa o cliente de IA e o modelo configurado.
 *
 * @returns {{client: object, model: string}} Instância do cliente e nome do modelo.
 */
function initializeAI() {
  if (!groqClient) {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error('GROQ_API_KEY environment variable is not set');
    }

    groqClient = new Groq({ apiKey });
    modelName = getModelName();
  }

  return { client: groqClient, model: modelName || getModelName() };
}


/**
 * Normaliza texto para comparação tolerante (minúsculas, sem acentos, sem
 * pontuação). Usado para casar o nome de um produto com o texto da pergunta
 * mesmo quando o usuário escreve sem acentos, no plural, ou com pequenas
 * diferenças de pontuação.
 *
 * @param {string} value Texto a ser normalizado.
 * @returns {string} Texto normalizado.
 */
function normalizeForMatch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'a', 'o', 'as', 'os', 'e', 'em', 'com',
  'para', 'the', 'and', 'of', 'for', 'with',
]);

/**
 * Verifica se um produto é mencionado na pergunta do usuário, de forma
 * tolerante a acentos, maiúsculas/minúsculas e pequenas variações (plural,
 * frases parciais). Primeiro tenta um match exato do nome normalizado; se
 * falhar, cai para um match por palavras-chave significativas do nome.
 *
 * @param {string} productName Nome do produto.
 * @param {string} normalizedQuestion Pergunta já normalizada.
 * @returns {boolean} Verdadeiro se o produto parece ser mencionado na pergunta.
 */
function isProductMentioned(productName, normalizedQuestion) {
  const name = normalizeForMatch(productName);
  if (!name || !normalizedQuestion) return false;

  if (normalizedQuestion.includes(name)) return true;

  // Remove um 's' final simples para tolerar plurais básicos (ex.:
  // "borracha" vs "borrachas", "pen" vs "pens"), sem tentar um stemmer completo.
  /**
   * Remove um 's' final simples de uma palavra, para tolerar plurais
   * básicos ao comparar palavras do nome do produto com a pergunta.
   *
   * @param {string} w Palavra normalizada.
   * @returns {string} Palavra no singular aproximado.
   */
  const singularize = (w) => (w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w);

  const nameWords = name
    .split(' ')
    .filter(w => w.length >= 3 && !STOPWORDS.has(w))
    .map(singularize);

  if (!nameWords.length) return false;

  const questionWords = new Set(normalizedQuestion.split(' ').map(singularize));
  const matchedWords = nameWords.filter(w => questionWords.has(w));

  // Exige que a maioria das palavras significativas do nome apareça na
  // pergunta, para evitar falsos positivos com nomes curtos/genéricos.
  return matchedWords.length >= Math.max(1, Math.ceil(nameWords.length * 0.6));
}

/**
 * Monta o prompt com base no contexto da aplicação para orientar o modelo de IA.
 *
 * @param {Object} context Dados transacionais e de estoque fornecidos para o prompt.
 * @param {string} [question=''] Pergunta do usuário para adaptar o contexto.
 * @returns {string} Prompt completo preparado para o modelo.
 */
function buildContextPrompt(context, question = '') {
  const lines = [
    'You are a smart business assistant for an inventory management system.',
    'Help the user make informed decisions about sales, stock levels, and profit optimization.',
    'Be concise, actionable, and data-driven.',
    'Do not provide generic advice; focus on the provided context.',
    'Do not use filler phrases like "As an AI language model" or "I am unable to".',
    'Do not use bold text.',
    'When putting products in a list, use bullet points, and start a new line.',
    'IMPORTANT: Use plain text formatting.',
    'Insert a blank line before every list.',
    'Each bullet point MUST be on its own line.',
    'Never place list items in the same paragraph.',
    'Use "-" for bullets, not "*".',
    'Use only data relevant to the user question.',
    'Never mix unrelated products.',
    'A product can belong to multiple categories at the same time.',
    'A top seller can also be low stock and may require restocking.',
    'Do not remove a product just because it appears in another category.',
    'Prioritize the category requested by the user question.'
  ];


  if (context?.salesCount !== undefined) {
    lines.push(`Sales Transactions: ${context.salesCount}`);
  }

  if (context?.totalSales !== undefined) {
    lines.push(`Total Revenue: ${context.totalSales}`);
  }

  if (context?.averageTicket !== undefined) {
    lines.push(`Average Sale: ${context.averageTicket}`);
  }


  if (context?.topProducts?.length) {

    lines.push('');
    lines.push('=== SALES PRODUCTS DATA ===');
    lines.push('The following values are factual. NEVER change them.');

    context.topProducts
      .slice(0, 10)
      .forEach(item => {

        lines.push(
          `Product: ${item.name}`,
          `- Units Sold: ${item.sold_quantity || 0}`,
          `- Revenue: ${item.revenue || 0}`,
          ''
        );

      });


    lines.push(
      `Suggested Bundle Candidates: ${
        context.topProducts
          .slice(0,3)
          .map(p => p.name)
          .join(', ')
      }`
    );
  }


  if (
    context?.stockForecast?.length &&
    (context?.topProducts?.length || question)
  ) {

    const topProductNames = (context.topProducts || [])
      .slice(0,10)
      .map(p => p.name.toLowerCase());

    const topSellerStock = context.stockForecast.filter(
      item =>
        topProductNames.includes(
          item.name.toLowerCase()
        )
    );

    // Além dos top sellers, inclui qualquer produto citado explicitamente na
    // pergunta do usuário (ex.: "reorder quantity de Economia A 10.º ano"),
    // mesmo que ele não esteja entre os mais vendidos do período. Sem isto,
    // a IA nunca recebia dados de produtos fora do top 10 e respondia
    // "no data" mesmo quando o produto existe na base.
    const normalizedQuestion = normalizeForMatch(question);
    const mentionedStock = normalizedQuestion
      ? context.stockForecast.filter(item =>
          isProductMentioned(item?.name, normalizedQuestion)
        )
      : [];

    const relevantStockMap = new Map();
    [...topSellerStock, ...mentionedStock].forEach(item => {
      relevantStockMap.set(String(item.name || '').toLowerCase(), item);
    });
    const relevantStock = Array.from(relevantStockMap.values());

    if (relevantStock.length) {

      lines.push('');
      lines.push('=== RELEVANT STOCK DATA (top sellers and/or products mentioned in the question) ===');
      lines.push('The following values are factual. NEVER change them.');


      relevantStock.forEach(item => {

        lines.push(
          `Product: ${item.name}`,
          `- Available Stock: ${item.available_stock}`,
          `- Average Daily Sales: ${Number(item.average_daily_sales || 0).toFixed(2)}`,
          `- Days To Stockout: ${
            item.days_to_stockout !== null
              ? Number(item.days_to_stockout).toFixed(2)
              : 'N/A'
          }`,
          `- Recommended Reorder: ${item.recommended_reorder || 0}`,
          ''
        );

      });

    }
  }



  const lowStockQuestion =
    /low stock|baixo estoque|estoque baixo/i.test(question);


  if (
    lowStockQuestion &&
    context?.lowAvailabilityItems?.length
  ) {

    lines.push('');
    lines.push('=== LOW STOCK DATA ===');


    context.lowAvailabilityItems
      .slice(0,10)
      .forEach(item => {

        lines.push(
          `Product: ${item.name}`,
          `- Available Stock: ${item.available_stock}`,
          `- Days To Stockout: ${item.days_to_stockout?.toFixed(2) || 'N/A'}`,
          `- Recommended Reorder: ${item.recommended_reorder}`,
          ''
        );

      });
  }




  const criticalQuestion =
    /critical|urgent|out of stock|sem estoque|crítico/i.test(question);


  if (
    criticalQuestion &&
    context?.criticalAvailabilityItems?.length
  ) {

    lines.push('');
    lines.push('=== CRITICAL STOCK DATA ===');


    context.criticalAvailabilityItems
      .slice(0,10)
      .forEach(item => {

        lines.push(
          `Product: ${item.name}`,
          `- Available Stock: ${item.available_stock}`,
          `- Days To Stockout: ${item.days_to_stockout?.toFixed(2) || 'N/A'}`,
          `- Recommended Reorder: ${item.recommended_reorder}`,
          ''
        );

      });
  }



  if (context?.topProfitProducts?.length) {

    lines.push(
      `Highest Profit: ${
        context.topProfitProducts[0]?.name || 'N/A'
      }`
    );

  }


  return lines.join('\n');
}


/**
 * Envia uma pergunta ao assistente de IA com contexto de negócio.
 *
 * @param {string} question Pergunta feita pelo usuário.
 * @param {Object} [context={}] Dados relevantes de vendas, estoque e produtos.
 * @returns {Promise<string>} Resposta gerada pelo modelo.
 */
export async function askAI(question, context = {}) {

  try {
    const { client, model } = initializeAI();

    const contextPrompt = buildContextPrompt(context, question);
    const fullPrompt = `${contextPrompt}\n\nUser Question: "${question}"\n\nProvide a focused, actionable response that addresses the question directly.`;
    //console.log(fullPrompt)
    console.log(`Sending request to Groq model ${model}...`);
    
    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `
You are SmartStock AI.

Rules:

- Only use the data section relevant to the user's question.
- Do not combine different categories of products.
- If the user asks about low stock, only discuss low stock products.
- If the user asks about high-demand products, only discuss high-demand products.
- Never invent stock quantities.
- Never invent reorder quantities.
- Use recommended_reorder whenever available.
- Use days_to_stockout whenever available.
- Explain the reasoning behind every recommendation.
- Prioritize products with risk_level critical or warning.
- Recommendations must be based only on supplied analytics.
- when asked about only restocking high-demand items dont metion critical stock or low stock items, only mention the high demand stock items.
- when asked about only bundle offers, dont metion critical stock or low stock items, only mention the high demand stock items.
- Dont mention risk levels directly, for low risk say low stock(dont say low stock level), for critical or out_of_stock say critical stock(nor critical level).
- never say directly "recommended reorder is 0", instead say "no reorder is currently required" or "already sufficiently stocked".
- when asked about low stock only dont metion products with critical stock, and vice versa.
- days_to_stockout is the number of days until stock runs out (talk about it as days to stock out), based on current sales and stock levels.
- Be concise but specific.
- Answer in the language of the user's question.
- When discussing more than one product, format the answer as a short list with ONE product per line (use "- " bullets or a numbered list). Never merge multiple products into a single run-on paragraph.

CRITICAL RULES:

If stock forecast data is provided:
- Copy values exactly.
- Never estimate or recalculate days_to_stockout.
- Never estimate or recalculate recommended_reorder.
- Never mix data from different products.
- If recommended_reorder is 0, always say "no reorder is currently required" — never say there isn't enough data, since the value 0 is itself a valid, already-computed result.

  === DATA INTERPRETATION RULES ===,
  - Top seller means high sales performance.
  - Low stock means inventory requires attention.
  - A product can appear in both groups.
  - Restock decisions should consider both sales velocity and available stock.
`
        },
        {
          role: 'user',
          content: fullPrompt,
        },
      ],
      temperature: 0.4,
      max_tokens: 500,
    });

    const answer = completion.choices?.[0]?.message?.content?.trim() || '';

    return {
      success: Boolean(answer),
      answer: answer || 'No answer was returned.',
      model,
      tokensUsed: completion.usage?.total_tokens || 0,
    };
  } catch (error) {
    console.error('AI API Error:', error.message);
    return {
      success: false,
      answer: 'I was unable to process your question. Please try again or contact support.',
      error: error.message,
      model: getModelName(),
    };
  }
}

/**
 * Gera uma recomendação curta e restrita, com base apenas nos produtos já
 * classificados como em risco (a mesma lista mostrada na secção "LOW STOCK
 * FORECAST" do relatório). Ao contrário de askAI, esta função não recebe
 * dados de produtos fora dessa lista, para garantir que a recomendação
 * nunca menciona um produto que o relatório não apresenta como em risco.
 *
 * @param {Array<Object>} forecastItems Itens já filtrados como acionáveis.
 * @returns {Promise<{success: boolean, answer: string}>} Recomendação gerada.
 */
export async function generateReportRecommendation(forecastItems = []) {
  if (!forecastItems.length) {
    return { success: true, answer: 'Inventory levels are healthy. No immediate restocking is required.' };
  }

  try {
    const { client, model } = initializeAI();

    const productLines = forecastItems.map((item) => (
      `Product: ${item.name}\n` +
      `- Available Stock: ${item.available_stock}\n` +
      `- Days To Stockout: ${item.days_to_stockout != null ? Number(item.days_to_stockout).toFixed(1) : 'N/A'}\n` +
      `- Recommended Reorder: ${item.recommended_reorder}`
    )).join('\n\n');

    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You are SmartStock AI, writing the recommendation section of an inventory report.

Rules:
- You may ONLY mention products listed below. Never mention any other product, even if you know it from elsewhere.
- Never invent or recalculate numbers; copy them exactly as given.
- Focus on the 1-3 most urgent products (lowest days to stockout first).
- Max 3 sentences, plain text, no bullet points, no bold.
- If unsure, be conservative and only state what the data supports.`,
        },
        {
          role: 'user',
          content: `Products currently at risk of stockout:\n\n${productLines}\n\nWrite the recommendation.`,
        },
      ],
      temperature: 0.3,
      max_tokens: 200,
    });

    const answer = completion.choices?.[0]?.message?.content?.trim() || '';
    return { success: Boolean(answer), answer: answer || 'Replenishment is recommended for products at risk.' };
  } catch (error) {
    console.error('AI recommendation error:', error.message);
    return { success: false, answer: 'Replenishment is recommended for products at risk.' };
  }
}

/**
 * Inicia uma resposta em streaming do assistente de IA.
 *
 * @param {string} question Pergunta feita pelo usuário.
 * @param {Object} [context={}] Dados relevantes para o contexto da resposta.
 * @returns {Promise<object>} Stream de resposta do cliente de IA.
 */
export async function askAIStream(question, context = {}) {
  const { client, model } = initializeAI();
  const contextPrompt = buildContextPrompt(context, question);
  const fullPrompt = `${contextPrompt}\n\nUser Question: "${question}"\n\nProvide a focused, actionable response.`;

  console.log(`Starting Groq stream with model ${model}...`);
  return client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: 'You are SmartStock AI. Answer in the language of the user.',
      },
      {
        role: 'user',
        content: fullPrompt,
      },
    ],
    temperature: 0.4,
    max_tokens: 500,
    stream: true,
  });
}


/**
 * Valida se a conexão com o serviço de IA está disponível.
 *
 * @returns {Promise<boolean>} Verdadeiro quando a conexão estiver operacional.
 */
export async function validateAIConnection() {
  try {
    if (!getApiKey()) {
      return false;
    }

    const { client, model } = initializeAI();
    const testResult = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'Test connection - reply with OK' }],
      temperature: 0,
      max_tokens: 10,
    });

    return Boolean(testResult.choices?.[0]?.message?.content);
  } catch (error) {
    console.error('AI connection validation failed:', error.message);
    return false;
  }
}
