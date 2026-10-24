import { createApiProxyConfiguration } from '../../../../scripts/api-proxy-config.mjs';

describe('Angular development API proxy', () => {
  it('uses the local default and supports an alternate API_PORT', () => {
    expect(createApiProxyConfiguration()).toMatchObject({ '/api/**': { target: 'http://127.0.0.1:3000' } });
    expect(createApiProxyConfiguration('3456')).toMatchObject({ '/api/**': { target: 'http://127.0.0.1:3456' } });
  });

  it('rejects invalid ports instead of constructing an unsafe proxy target', () => {
    expect(() => createApiProxyConfiguration('127.0.0.1:3000')).toThrow('API_PORT');
    expect(() => createApiProxyConfiguration('70000')).toThrow('API_PORT');
  });
});
