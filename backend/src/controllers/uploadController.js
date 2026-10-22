/**
 * Controlador para upload e remoção de imagens de produtos e fornecedores.
 * @module controllers/uploadController
 */
import { getPublicUrl, deleteUploadedFile } from '../services/uploadService.js';


/**
 * Recebe o upload de uma imagem de produto e retorna a URL pública gerada.
 *
 * @param {import('express').Request} req Requisição HTTP com o arquivo em `req.file` (via multer).
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde com filename, url pública, nome original e tamanho do arquivo.
 */
export async function uploadProductImage(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    const publicUrl = getPublicUrl('products', req.file.filename, req);

    res.json({
      filename: req.file.filename,
      url: publicUrl,
      originalName: req.file.originalname,
      size: req.file.size,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error uploading file.', error: error.message });
  }
}


/**
 * Recebe o upload de uma imagem de fornecedor e retorna a URL pública gerada.
 *
 * @param {import('express').Request} req Requisição HTTP com o arquivo em `req.file` (via multer).
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde com filename, url pública, nome original e tamanho do arquivo.
 */
export async function uploadSupplierImage(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    const publicUrl = getPublicUrl('suppliers', req.file.filename, req);

    res.json({
      filename: req.file.filename,
      url: publicUrl,
      originalName: req.file.originalname,
      size: req.file.size,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error uploading file.', error: error.message });
  }
}


/**
 * Remove uma imagem de produto previamente enviada.
 *
 * @param {import('express').Request} req Requisição HTTP. Espera `filename` no body.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde com mensagem de sucesso ou erro.
 */
export async function deleteProductImage(req, res) {
  try {
    const { filename } = req.body;



    if (!filename) {
      return res.status(400).json({ message: 'Filename is required.' });
    }

    await deleteUploadedFile('products', filename);

    res.json({ message: 'File deleted successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error deleting file.', error: error.message });
  }
}


/**
 * Remove uma imagem de fornecedor previamente enviada.
 *
 * @param {import('express').Request} req Requisição HTTP. Espera `filename` no body.
 * @param {import('express').Response} res Resposta HTTP.
 * @returns {Promise<void>} Responde com mensagem de sucesso ou erro.
 */
export async function deleteSupplierImage(req, res) {
  try {
    const { filename } = req.body;
    if (!filename) {
      return res.status(400).json({ message: 'Filename is required.' });
    }

    await deleteUploadedFile('suppliers', filename);
    res.json({ message: 'File deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting file.', error: error.message });
  }
}
