/**
 * Carrega as variáveis de ambiente a partir do arquivo .env mais adequado ao contexto de execução.
 * @module config/env
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Lista os caminhos candidatos, por ordem de prioridade, onde o ficheiro
 * `.env` pode estar localizado (variável de ambiente explícita, raiz do
 * backend, raiz do projeto, diretório de execução atual).
 *
 * @returns {string[]} Caminhos absolutos candidatos, sem valores nulos.
 */
const resolveCandidatePaths = () => [
  process.env.ENV_FILE_PATH ? path.resolve(process.env.ENV_FILE_PATH) : null,
  path.resolve(__dirname, '..', '..', '.env'),
  path.resolve(__dirname, '..', '.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'backend', '.env')
].filter(Boolean);

/**
 * Executa a operação load env.
 */
export const loadEnv = () => {
  const existingPath = resolveCandidatePaths().find((candidate) => fs.existsSync(candidate));

  if (existingPath) {
    dotenv.config({ path: existingPath });
    return existingPath;
  }

  dotenv.config();
  return null;
};

loadEnv();
