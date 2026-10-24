import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnvironment } from 'dotenv';
import { createApiProxyConfiguration } from './api-proxy-config.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const webRoot = resolve(root, 'apps/web');
loadEnvironment({ path: resolve(root, '.env') });

let proxy;
try {
  proxy = createApiProxyConfiguration(process.env.API_PORT ?? '3000');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'API_PORT inválida.');
  process.exit(1);
}

if (process.argv.includes('--print-config')) {
  console.log(JSON.stringify(proxy));
} else {
  const angularDirectory = resolve(webRoot, '.angular');
  await mkdir(angularDirectory, { recursive: true });
  await writeFile(resolve(angularDirectory, 'fogo-proxy.json'), `${JSON.stringify(proxy, null, 2)}\n`, { mode: 0o600 });
}
