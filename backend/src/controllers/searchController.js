/**
 * Controlador para busca global de dados do negócio.
 * @module controllers/searchController
 */
import { searchBusinessService } from '../services/searchService.js';

/**
 * Pesquisa business.
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde em JSON com o resultado da operação ou erro apropriado.
 */
export const searchBusiness = async (req, res) => {
  try {
    const results = await searchBusinessService({
      q: req.query.q || '',
      type: req.query.type || 'all',
    });
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: 'Unable to search data.', error: error.message });
  }
};
