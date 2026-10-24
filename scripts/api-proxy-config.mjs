export function createApiProxyConfiguration(portValue = '3000') {
  const port = Number(portValue);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('API_PORT precisa ser um número inteiro entre 1 e 65535.');
  }
  return {
    '/api/**': {
      target: `http://127.0.0.1:${port}`,
      secure: false,
    },
  };
}
