export function createApiProxyConfiguration(portValue?: string | number): {
  '/api/**': { target: string; secure: false };
};
