import { useEffect, useMemo, useState, useContext, useRef } from 'react';
import { askInsight, getInsights } from '../services/insightService.js';
import { formatCurrency } from '../utils/formatters.js';
import { ThemeContext } from '../context/ThemeContext.jsx';
import "../styles/global.css";
// Instead of one sessionStorage array that just keeps growing forever, chats are
// stored as separate "conversations" (id + title + date + messages) in localStorage.
// This is what backs the history tab in the corner of the chat header.
const CONVERSATIONS_STORAGE_KEY = 'smartstock_insights_conversations';
const MAX_STORED_CONVERSATIONS = 30;

/**
 * Deriva um título curto para a conversa a partir da primeira pergunta do usuário.
 *
 * @param {string} text Texto da primeira pergunta.
 * @returns {string} Título truncado para exibir na lista de histórico.
 */
const deriveConversationTitle = (text) => {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return 'New conversation';
  return clean.length > 48 ? `${clean.slice(0, 48)}…` : clean;
};

const createEmptyConversation = () => ({
  id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title: 'New conversation',
  createdAt: new Date().toISOString(),
  messages: [],
});

/**
 * Lê as conversas guardadas em localStorage, devolvendo pelo menos uma
 * conversa vazia caso ainda não exista nenhuma.
 *
 * @returns {Object[]} Lista de conversas guardadas.
 */
const readStoredConversations = () => {
  if (typeof window === 'undefined') return [createEmptyConversation()];

  try {
    const raw = localStorage.getItem(CONVERSATIONS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch (error) {
    console.warn('Unable to restore insights conversations:', error);
  }
  return [createEmptyConversation()];
};

/**
 * Página de insights com assistente de IA.
 * Permite consultar dados de vendas e estoque por meio de mensagens conversacionais.
 *
 * @returns {JSX.Element} Interface do chat de insights.
 */
export default function Insights() {
  const [period, setPeriod] = useState('weekly');
  const [overview, setOverview] = useState({
    salesCount: 0,
    totalSales: 0,
    averageTicket: 0,
    topProducts: [],
    topProfitProducts: [],
    lowAvailabilityItems: [],
    stockForecast: [],
    summary: '',
    detailedSummary: '',
    recentInsights: [],
  });
  const [question, setQuestion] = useState('');
  const [conversations, setConversations] = useState(readStoredConversations);
  const [activeConversationId, setActiveConversationId] = useState(() => conversations[0]?.id);
  const [showHistory, setShowHistory] = useState(false);
  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) || conversations[0],
    [conversations, activeConversationId]
  );
  const messages = activeConversation?.messages || [];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copiedMessageIndex, setCopiedMessageIndex] = useState(null);
  const { theme } = useContext(ThemeContext);
  const isDarkMode = theme === 'dark';
  const chatEndRef = useRef(null);

  /**
   * Carrega os dados iniciais do painel de insights na abertura da página.
   */
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        console.log('Loading insights...');
        const res = await getInsights({ period });
        console.log('Insights loaded:', res);
        setOverview(res.data || {});
      } catch (err) {
        console.error('Error loading insights:', err);
        setError('Unable to load initial insights.');
      }
    };
    loadInitialData();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      // Keep only the most recent MAX_STORED_CONVERSATIONS so history can't grow forever.
      const toStore = conversations.slice(0, MAX_STORED_CONVERSATIONS);
      localStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(toStore));
    } catch (error) {
      console.warn('Unable to save insights conversations:', error);
    }
  }, [conversations]);

  /**
   * Adiciona mensagens à conversa ativa, definindo o título automaticamente
   * a partir da primeira pergunta do usuário.
   *
   * @param {Object[]} newMessages Mensagens a acrescentar à conversa ativa.
   * @returns {void}
   */
  const appendToActiveConversation = (newMessages) => {
    setConversations((prev) => prev.map((conv) => {
      if (conv.id !== activeConversationId) return conv;
      const updatedMessages = [...conv.messages, ...newMessages];
      const firstUserMessage = updatedMessages.find((m) => m.role === 'user');
      return {
        ...conv,
        messages: updatedMessages,
        title: conv.title === 'New conversation' && firstUserMessage
          ? deriveConversationTitle(firstUserMessage.text)
          : conv.title,
      };
    }));
  };

  /**
   * Começa uma conversa nova em branco e mostra-a no painel principal.
   * A conversa anterior fica guardada no histórico (se tiver mensagens).
   *
   * @returns {void}
   */
  const startNewConversation = () => {
    const fresh = createEmptyConversation();
    setConversations((prev) => [fresh, ...prev.filter((c) => c.messages.length > 0 || c.id !== activeConversationId)]);
    setActiveConversationId(fresh.id);
    setShowHistory(false);
  };

  /**
   * Abre uma conversa guardada no histórico.
   *
   * @param {string} id Id da conversa a abrir.
   * @returns {void}
   */
  const openConversation = (id) => {
    setActiveConversationId(id);
    setShowHistory(false);
  };

const suggestions = useMemo(() => {
  const items = [];

  if (overview.topProducts?.length) {
    const highDemandProducts = overview.topProducts
      .slice(0, 2)
      .map(p => p.name)
      .join(' and ');

    items.push({
      text: `Restock high-demand items like ${highDemandProducts} to maintain sales momentum.`,
      button: 'View restock plan',
      prompt: `Provide detailed restock recommendations for these high-demand products:
${highDemandProducts}`
    });
  }

  if (overview.criticalAvailabilityItems?.length) {
    items.push({
      text: `Monitor ${overview.criticalAvailabilityItems.length} critical stock products closely and consider increasing order quantities.`,
      button: 'Analyze critical stock',
      prompt: `Analyze all critical stock products and provide urgent reorder actions.`
    });
  }

  if (overview.lowAvailabilityItems?.length) {
    items.push({
      text: `Monitor ${overview.lowAvailabilityItems.length} low stock products closely and consider increasing order quantities.`,
      button: 'Review low stock',
      prompt: `Analyze low stock products and recommend next steps with reorder quantities.`
    });
  }

  if (overview.topProfitProducts?.length) {
    items.push({
      text: `Explore bundle offers with top performers like ${overview.topProfitProducts[0]?.name}.`,
      button: 'Create bundle ideas',
      prompt: `Suggest bundle strategies using the highest profit products.`
    });
  }

  return items;
}, [overview]);

  /**
   * Copia uma resposta do chat para a área de transferência.
   *
   * @param {string} text Conteúdo da resposta a ser copiado.
   * @param {number} index Índice da mensagem no array.
   * @returns {Promise<void>} Promessa resolvida após a cópia.
   */
  const handleCopyMessage = async (text, index) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopiedMessageIndex(index);
        window.setTimeout(() => {
          setCopiedMessageIndex((current) => (current === index ? null : current));
        }, 1500);
      }
    } catch (err) {
      console.warn('Unable to copy insights message:', err);
    }
  };

  /**
   * Envia uma pergunta ao assistente de IA e adiciona a resposta ao chat.
   *
   * @param {string} [preset] Texto opcional para usar como pergunta pré-definida.
   * @returns {Promise<void>} Promessa resolvida após o processamento da solicitação.
   */
  const handleAsk = async (preset) => {
    const q = preset || question;
    if (!q.trim()) return;
    setBusy(true);
    setError('');
    appendToActiveConversation([{ role: 'user', text: q }]);
    try {
      const contextData = {
        topProducts: overview.topProducts || [],
        topProfitProducts: overview.topProfitProducts || [],
        lowAvailabilityItems: overview.lowAvailabilityItems || [],
        stockForecast: overview.stockForecast || [],
        salesCount: overview.salesCount,
        totalSales: overview.totalSales,
        averageTicket: overview.averageTicket,
      };

      const res = await askInsight({ 
        question: q, 
        period,
        context: contextData
      });
      const answer = res.data?.answer || 'No answer was returned.';
      appendToActiveConversation([{ role: 'assistant', text: answer }]);
      setQuestion('');
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to answer the question.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`page-shell ${isDarkMode ? 'insights-theme-dark' : ''}`} data-theme={theme}>
      <div className="insights-main-container">
        <div className="insights-sidebar"> 
          <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <h3 className="chart-title" style={{ marginTop: 0 }}>Suggested actions</h3>
            <div className="insights-suggestions-list">
            {suggestions.map((item, index) => (<button key={index} type="button" className="suggestion-item" onClick={() => handleAsk(item.prompt)} disabled={busy}>
    <span style={{ flex: 1 }}>{item.text}</span>
  </button>
))}

              <div style={{ marginTop: '1rem', textAlign: 'center' }}>
              </div>
            </div>
          </div>
        </div>

        {/* Right Main Area - Chat */}
        <div className="insights-chat-container">
          <div className="chat-header">
            <div className="chat-header-row">
              <h2 className="chart-title">AI Insights - Chat with AI about your sales, stock, and business insights.</h2>
              <div className="chat-header-actions">
                <button type="button" className="chat-icon-btn" onClick={startNewConversation} title="Start a new conversation">
                  + New
                </button>
                <button
                  type="button"
                  className="chat-icon-btn"
                  onClick={() => setShowHistory((v) => !v)}
                  title="Conversation history"
                  aria-expanded={showHistory}
                >
                  🕘 History
                </button>
              </div>
            </div>

            {showHistory && (
              <div className="chat-history-panel">
                {conversations.length === 0 ? (
                  <div className="chat-history-empty">No saved conversations yet.</div>
                ) : (
                  conversations.map((conv) => (
                    <button
                      type="button"
                      key={conv.id}
                      className={`chat-history-item ${conv.id === activeConversationId ? 'active' : ''}`}
                      onClick={() => openConversation(conv.id)}
                    >
                      <span className="chat-history-date">{new Date(conv.createdAt).toLocaleDateString()}</span>
                      <span className="chat-history-title">{conv.title}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="chat-empty-state">
                <p>Ask a question to start the conversation.</p>
              </div>
            ) : (
              messages.map((message, index) => (
                <div 
                  key={`${message.role}-${index}`} 
                  className={`chat-message ${message.role}`}
                >
                  <div className="chat-avatar">
                    {message.role === 'user' ? 'ACC' : 'AI'}
                  </div>
                  <div className="chat-message-content">
                    <div className="chat-bubble">
                      <div style={{ whiteSpace: 'pre-wrap' }}>
                        {message.text}
                      </div>
                    </div>
                    {message.role === 'assistant' && (
                      <button tooltip="Copy response"
                        type="button"
                        className="chat-copy-btn"
                        onClick={() => handleCopyMessage(message.text, index)}
                        aria-label="Copy AI response"
                      >
                        {copiedMessageIndex === index ? '✓' : '▢'}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

   
          <div className="chat-input-area">
            
            <div className="chat-input-wrapper">
              <textarea 
                value={question} 
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!busy) handleAsk();
                  }
                }}
                placeholder="Ask a question..."
                rows="3"
              />
              <button 
                type="button" 
                className="btn-primary chat-send-btn"
                onClick={() => handleAsk()} 
                disabled={busy}
              >
                {busy ? '⟳' : '↑'}
              </button>
            </div>
            {error && <div className="chat-error">{error}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
