import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = dirname(currentFilePath);

const envPath = process.env.NODE_ENV === 'production'
  ? resolve(currentDirectory, '../../../../.env.production')
  : resolve(currentDirectory, '../../../../.env');

dotenv.config({ path: envPath });
