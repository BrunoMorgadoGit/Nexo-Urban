import { copyFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(projectRoot, '.env');
const examplePath = resolve(projectRoot, '.env.example');

try {
  await access(envPath, constants.F_OK);
  console.log('Arquivo .env existente preservado.');
} catch {
  await copyFile(examplePath, envPath, constants.COPYFILE_EXCL);
  console.log('Arquivo .env criado a partir de .env.example.');
}
