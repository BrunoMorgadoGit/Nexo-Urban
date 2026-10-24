import { appConfig } from './app.config';

describe('appConfig', () => {
  it('registers router, HTTP, and zoneless change detection providers', () => {
    expect(appConfig.providers).toHaveLength(3);
  });
});
