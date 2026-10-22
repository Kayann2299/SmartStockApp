import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

/**
 * Serviço de upload de arquivos.
 * Gerencia armazenamento local de imagens para produtos e fornecedores.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


/**
 * Cria uma configuração de armazenamento em disco (Multer) para uma pasta
 * de upload específica, garantindo que o diretório existe e gerando um
 * nome de ficheiro único para cada upload.
 *
 * @param {string} folder Nome da subpasta de destino (ex.: 'products', 'suppliers').
 * @returns {import('multer').StorageEngine} Motor de armazenamento configurado.
 */
const createStorage = (folder) => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(__dirname, `../../uploads/${folder}`);
      try {
        fs.mkdirSync(uploadDir, { recursive: true });
      } catch (err) {
        return cb(err);
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      const name = path.basename(file.originalname, ext);
      cb(null, `${folder}_${uniqueSuffix}${ext}`);
    }
  });
};


/**
 * Filtro Multer que só aceita ficheiros de imagem com mimetype permitido
 * (JPEG, PNG, WEBP, GIF).
 *
 * @param {import('express').Request} req Requisição HTTP.
 * @param {Express.Multer.File} file Ficheiro recebido no upload.
 * @param {Function} cb Callback do Multer (erro, aceite).
 * @returns {void}
 */
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed: ${allowedMimes.join(', ')}`));
  }
};


/**
 * Middleware Multer para upload de imagens de produtos (armazenamento local em disco, até 5MB).
 * @type {import('multer').Multer}
 */
export const uploadProducts = multer({
  storage: createStorage('products'),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});


/**
 * Middleware Multer para upload de imagens de fornecedores (armazenamento local em disco, até 5MB).
 * @type {import('multer').Multer}
 */
export const uploadSuppliers = multer({
  storage: createStorage('suppliers'),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});


/**
 * Gera a URL pública de um arquivo enviado.
 *
 * @param {string} folder Pasta de armazenamento.
 * @param {string} filename Nome do arquivo.
 * @param {Object|null} [req=null] Requisição opcional.
 * @returns {string|null} URL pública do arquivo.
 */
export const getPublicUrl = (folder, filename, req = null) => {
  if (!filename) return null;

  const configuredBaseUrl = process.env.APP_URL || process.env.BACKEND_URL || null;
  if (configuredBaseUrl) {
    return `${configuredBaseUrl.replace(/\/$/, '')}/uploads/${folder}/${filename}`;
  }

  return `/uploads/${folder}/${filename}`;
};


/**
 * Remove um arquivo enviado do diretório local de uploads.
 *
 * @param {string} folder Pasta de armazenamento.
 * @param {string} filename Nome do arquivo a ser removido.
 * @returns {Promise<void>} Promessa resolvida após exclusão do arquivo.
 */
export async function deleteUploadedFile(folder, filename) {
  if (!filename) return;

  try {
    const fs = await import('fs/promises');

    const filePath = path.join(
      __dirname,
      `../../uploads/${folder}/${filename}`
    );
   
    await fs.unlink(filePath);

  } catch (err) {
    console.error(`Error deleting file: ${filename}`, err);
    throw err;
  }
}

