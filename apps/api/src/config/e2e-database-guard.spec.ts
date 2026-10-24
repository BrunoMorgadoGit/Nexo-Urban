import { validateE2eConfiguration } from '../../../../scripts/e2e-database-guard.mjs';
const safeDatabaseUrl = 'postgresql://fixture-user@127.0.0.1:55432/fogo_e2e';
const normalDatabaseUrl = 'postgresql://normal-user@127.0.0.1:5437/fogo';

function configuration(overrides: Record<string, string | undefined> = {}) {
  const env: Record<string, string | undefined> = {
    DATABASE_URL: normalDatabaseUrl,
    E2E_DATABASE_URL: safeDatabaseUrl,
    E2E_DATABASE_NAME: 'fogo_e2e',
  };
  return { ...env, ...overrides };
}

describe('E2E database safety guard', () => {
  it('accepts a loopback database explicitly marked for E2E', () => {
    expect(validateE2eConfiguration(configuration())).toMatchObject({
      host: '127.0.0.1', port: '55432', database: 'fogo_e2e', username: 'fixture-user',
    });
  });

  it('requires the dedicated E2E URL and database name', () => {
    expect(() => validateE2eConfiguration(configuration({ E2E_DATABASE_URL: undefined }))).toThrow('E2E_DATABASE_URL');
    expect(() => validateE2eConfiguration(configuration({ E2E_DATABASE_NAME: undefined }))).toThrow('E2E_DATABASE_NAME');
  });

  it('rejects the normal project database even when the test marker is present', () => {
    expect(() => validateE2eConfiguration(configuration({ DATABASE_URL: safeDatabaseUrl }))).toThrow('mesmo banco');
    expect(() => validateE2eConfiguration(configuration({
      DATABASE_URL: 'postgresql://normal-user@db.example.test:5432/fogo_e2e',
    }))).toThrow('mesmo banco');
  });

  it('rejects unsafe names, mismatched URL names, and non-loopback hosts', () => {
    expect(() => validateE2eConfiguration(configuration({ E2E_DATABASE_NAME: 'fogo' }))).toThrow('marcador');
    expect(() => validateE2eConfiguration(configuration({ E2E_DATABASE_NAME: 'other_e2e' }))).toThrow('corresponder');
    expect(() => validateE2eConfiguration(configuration({ E2E_DATABASE_URL: 'postgres://fixture-user@example.com/fogo_e2e' }))).toThrow('loopback');
    expect(() => validateE2eConfiguration(configuration({ E2E_DATABASE_URL: 'postgres://fixture-user@localhost/fogo_e2e' }))).toThrow('loopback');
    expect(() => validateE2eConfiguration(configuration({ E2E_DATABASE_URL: `${safeDatabaseUrl}?host=example.com` }))).toThrow('parâmetros');
  });

  it('never prints connection credentials in guard errors', () => {
    let message = '';
    try {
      validateE2eConfiguration(configuration({ DATABASE_URL: safeDatabaseUrl }));
    } catch (error) {
      message = error instanceof Error ? error.message : '';
    }
    expect(message).not.toContain('fixture-user');
    expect(message).not.toContain('normal-user');
  });
});
