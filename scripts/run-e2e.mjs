import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';import { fileURLToPath } from 'node:url';
import { config as loadEnvironment } from 'dotenv';
import { validateE2eConfiguration } from './e2e-database-guard.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const apiRoot = resolve(root, 'apps/api');
loadEnvironment({ path: resolve(root, '.env') });

try {
  validateE2eConfiguration(process.env);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Configuração E2E inválida.');
  process.exit(1);
}

if (process.argv.includes('--check-config')) {
  console.log('Configuração E2E aceita; a conectividade do banco não foi verificada.');
  process.exit(0);
}

const requireFromApi = createRequire(resolve(apiRoot, 'package.json'));
const vitestPackage = requireFromApi('vitest/package.json');

const vitestCli = resolve(
  dirname(requireFromApi.resolve('vitest/package.json')),
  vitestPackage.bin.vitest,
);
const child = spawn(process.execPath, [vitestCli, 'run', '--config', './vitest.config.e2e.ts'], {
  cwd: apiRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    DATABASE_URL: process.env.E2E_DATABASE_URL,
    NODE_ENV: 'development',
    DEMO_SCENARIO_ENABLED: 'true',
  },
});

child.on('error', () => {
  console.error('Não foi possível iniciar a suíte E2E.');
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
