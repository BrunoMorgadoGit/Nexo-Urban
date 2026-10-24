const databaseMarker = /(?:^|[_-])(?:e2e|test)(?:$|[_-])/i;

function normalizeHost(host) {
  return host.toLowerCase().replace(/^\[|\]$/g, '');
}

function parseDatabaseUrl(value, variableName, loopbackOnly = true) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${variableName} precisa ser uma URL PostgreSQL válida.`);
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error(`${variableName} precisa usar o protocolo PostgreSQL.`);
  }
  if (url.search || url.hash) {
    throw new Error(`${variableName} não pode conter parâmetros que alterem o destino da conexão.`);
  }
  const host = normalizeHost(url.hostname);
  if (loopbackOnly && !['127.0.0.1', '::1'].includes(host)) {
    throw new Error(`${variableName} deve apontar para PostgreSQL local (loopback).`);
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!database) throw new Error(`${variableName} precisa indicar o nome do banco.`);
  const username = decodeURIComponent(url.username);
  if (!username) throw new Error(`${variableName} precisa indicar o usuário do banco.`);
  return { host, port: url.port || '5432', database, username };
}

export function validateE2eConfiguration(environment) {
  if (!environment.E2E_DATABASE_URL) {
    throw new Error('Defina E2E_DATABASE_URL para um banco exclusivo de testes E2E.');
  }
  if (!environment.E2E_DATABASE_NAME) {
    throw new Error('Defina E2E_DATABASE_NAME com o nome exato do banco E2E.');
  }
  const expectedName = environment.E2E_DATABASE_NAME.trim();
  if (!databaseMarker.test(expectedName)) {
    throw new Error('E2E_DATABASE_NAME deve conter um marcador _e2e ou _test.');
  }
  const e2e = parseDatabaseUrl(environment.E2E_DATABASE_URL, 'E2E_DATABASE_URL');
  if (e2e.database !== expectedName) {
    throw new Error('O banco na E2E_DATABASE_URL precisa corresponder a E2E_DATABASE_NAME.');
  }

  if (environment.DATABASE_URL) {
    const normal = parseDatabaseUrl(environment.DATABASE_URL, 'DATABASE_URL', false);
    if (normal.database === e2e.database) {
      throw new Error('E2E_DATABASE_URL aponta para o mesmo banco configurado em DATABASE_URL.');
    }
  }
  return e2e;
}
