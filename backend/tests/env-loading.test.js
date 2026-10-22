import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, resolve } from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { loadEnv } from '../src/config/env.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..', '..');
const backendEnvPath = resolve(projectRoot, 'backend', '.env');

const readEnvValue = (key) => {
  const lines = fs.readFileSync(backendEnvPath, 'utf8').split(/\r?\n/);
  const match = lines.find((line) => line.startsWith(`${key}=`));
  return match ? match.split('=').slice(1).join('=').trim() : undefined;
};

test('loadEnv reads backend/.env when executed from workspace root', () => {
  process.chdir(projectRoot);
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_USER;
  loadEnv();

  assert.equal(process.env.SMTP_HOST, readEnvValue('SMTP_HOST'));
  assert.equal(process.env.SMTP_USER, readEnvValue('SMTP_USER'));
});
