import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(repositoryRoot, 'node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs');
const destination = resolve(repositoryRoot, 'apps/web/public/maplibre-gl-worker.mjs');

await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);
