/**
 * Controlador para insights do dashboard e perguntas assistidas por IA.
 * @module controllers/insightController
 */
import { askAI } from '../services/aiService.js';
import {
  answerBusinessQuestion,
  getAnalyticsStats,
  getRecentInsights,
  persistInsight,
  generateSummaryText,
  generateDetailedText,
} from '../services/analyticsService.js';

/**
 * Retorna insights.
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde em JSON com o resultado da operação ou erro apropriado.
 */
export const getInsights = async (req, res) => {
  try {
    const stats = await getAnalyticsStats({
      period: req.query.period || 'weekly',
      from: req.query.from || null,
      to: req.query.to || null,
      historicalStock: false
    });

    const recentInsights = await getRecentInsights(5, req.user?.id);

    res.json({
      ...stats,
      summary: generateSummaryText(stats),
      detailedSummary: await generateDetailedText(stats),
      recentInsights,
    });
  } catch (error) {
    res.status(500).json({ message: 'Unable to load insights.', error: error.message });
  }
};

/**
 * Executa a operação ask insight.
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde em JSON com o resultado da operação ou erro apropriado.
 */
export const askInsight = async (req, res) => {
  try {
    const question = String(req.body.question || '').trim();
    if (!question) {
      return res.status(400).json({ message: 'Question is required.' });
    }

    // Get business context data from database
    const stats = await getAnalyticsStats({
      period: req.body.period || 'weekly',
      from: req.body.from || null,
      to: req.body.to || null,
      historicalStock: false
    });

    // Merge provided context from frontend with database stats
    const context = {
      ...stats,
      ...(req.body.context || {}),
    };

    // Ask Groq with business context, but fallback to local heuristics when not available
    let result;
    try {
      result = await askAI(question, context);
    } catch (err) {
      console.warn('Groq failed, falling back to local analyzer:', err.message);
      const heuristic = await answerBusinessQuestion(question, context);
      const saved = await persistInsight({
        type: 'ai_chat_fallback',
        question,
        answer: heuristic.answer,
        relatedEntity: heuristic.relatedEntity,
        relatedEntityId: heuristic.relatedEntityId,
        userId: req.user?.id,
      });
      return res.json({ answer: heuristic.answer, savedInsight: saved, fallback: true });
    }

    // Save the AI conversation to database for history
    if (result.success && result.answer) {
      const saved = await persistInsight({
        type: 'ai_chat',
        question,
        answer: result.answer,
        model: result.model,
        tokensUsed: result.tokensUsed,
        userId: req.user?.id,
      });

      return res.json({
        answer: result.answer,
        savedInsight: saved,
      });
    }

    // If AI client returned non-success, fallback to heuristics
    const heuristic = await answerBusinessQuestion(question, context);
    const saved = await persistInsight({
      type: 'ai_chat_fallback',
      question,
      answer: heuristic.answer,
      relatedEntity: heuristic.relatedEntity,
      relatedEntityId: heuristic.relatedEntityId,
      userId: req.user?.id,
    });
    return res.json({ answer: heuristic.answer, savedInsight: saved, fallback: true });
  } catch (error) {
    res.status(500).json({ message: 'Unable to answer question.', error: error.message });
  }
};
