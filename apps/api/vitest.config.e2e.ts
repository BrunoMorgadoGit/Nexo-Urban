import { fileURLToPath } from 'node:url';
import { config as loadEnvironment } from 'dotenv';
import { defineConfig } from 'vitest/config';
import { validateE2eConfiguration } from '../../scripts/e2e-database-guard.mjs';

loadEnvironment({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });
validateE2eConfiguration(process.env);
process.env.DATABASE_URL = process.env.E2E_DATABASE_URL;
process.env.NODE_ENV = 'development';
process.env.DEMO_SCENARIO_ENABLED = 'true';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    fileParallelism: false,
    include: ['**/*.e2e-spec.ts'],
    globalSetup: ['./test/e2e-database-guard.setup.ts'],
  },
});
