/**
 * Controlador para dashboard, geração e detalhamento de relatórios.
 * @module controllers/reportController
 */
import { getDashboardStatsService, createReportService, listReportsService, getReportDetailsService } from '../services/reportService.js';

/**
 * Retorna as estatísticas agregadas do dashboard (vendas, estoque e previsões) para o período informado.
 *
 * @param {import('express').Request} req Requisição HTTP. Aceita `period`, `from` e `to` como query params.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde com o objeto de estatísticas ou erro 500.
 */
export const getDashboard = async (req, res) => {

  try {
   const stats = await getDashboardStatsService({
  period: req.query.period || 'monthly',
  from: req.query.from || null,
  to: req.query.to || null,
});



res.json(stats);


  } catch (error) {
    res.status(500).json({ message: 'Unable to load dashboard.', error: error.message });
  }
};

/**
 * Gera manualmente um relatório (semanal ou mensal) com base no tipo informado no corpo da requisição.
 *
 * @param {import('express').Request} req Requisição HTTP. Aceita `type` ('weekly'|'monthly') no body.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde com o relatório criado (201), uma mensagem de "nenhum relatório novo" (200) ou erro 500.
 */
export const generateReport = async (req, res) => {
  try {
    const report = await createReportService(req.body.type || 'weekly');
    if (!report) {
      return res.status(200).json({ message: 'No new report was generated.' });
    }
    res.status(201).json(report);
  } catch (error) {
    res.status(500).json({ message: 'Unable to generate report.', error: error.message });
  }
};

/**
 * Lista os relatórios já gerados, com filtros opcionais por período e tipo.
 *
 * @param {import('express').Request} req Requisição HTTP. Aceita `from`, `to` e `type` como query params.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde com a lista de relatórios ou erro 500.
 */
export const getReports = async (req, res) => {
  try {
    const reports = await listReportsService(req.query.from || null, req.query.to || null, req.query.type || null);
    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: 'Unable to list reports.', error: error.message });
  }
};

/**
 * Retorna os detalhes completos de um relatório específico, incluindo resumo e estatísticas.
 *
 * @param {import('express').Request} req Requisição HTTP. Espera `id` do relatório em `req.params`.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde com os detalhes do relatório, 404 se não existir, ou erro 500.
 */
export const getReportDetails = async (req, res) => {
   console.log('getReportDetails', req.params.id);
  try {
    const details = await getReportDetailsService(req.params.id);
    if (!details) {
      return res.status(404).json({ message: 'Report not found.' });
    }

    res.json(details);
  } catch (error) {
    res.status(500).json({ message: 'Unable to load report details.', error: error.message });
  }
};
