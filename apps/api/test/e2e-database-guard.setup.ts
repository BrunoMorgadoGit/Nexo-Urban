import { config as loadEnvironment } from 'dotenv';
import { Client } from 'pg';
import { fileURLToPath } from 'node:url';
import { validateE2eConfiguration } from '../../../scripts/e2e-database-guard.mjs';

export default async function verifyDedicatedE2eDatabase(): Promise<void> {
  loadEnvironment({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });
  const target = validateE2eConfiguration(process.env);
  const client = new Client({
    connectionString: process.env.E2E_DATABASE_URL,
    connectionTimeoutMillis: 3000,
    application_name: 'fogo-e2e-identity-check',
  });

  try {
    await client.connect();
    const { rows } = await client.query('SELECT current_database() AS database_name, current_user AS user_name');
    if (rows[0]?.database_name !== target.database || rows[0]?.user_name !== target.username) {
      throw new Error('A identidade efetiva do PostgreSQL não corresponde à configuração E2E.');
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('A identidade efetiva')) throw error;
    throw new Error('Não foi possível verificar a identidade do banco E2E; a suíte foi bloqueada.');
  } finally {
    await client.end().catch(() => undefined);
  }
}
