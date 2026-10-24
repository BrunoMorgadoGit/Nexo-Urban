import { isDemoScenarioEnabled } from './demo-scenario-gate.js';

describe('demonstration endpoint gate', () => {
  it('requires both development mode and explicit opt-in', () => {
    expect(isDemoScenarioEnabled({ NODE_ENV: 'development' })).toBe(false);
    expect(isDemoScenarioEnabled({ NODE_ENV: 'production', DEMO_SCENARIO_ENABLED: 'true' })).toBe(false);
    expect(isDemoScenarioEnabled({ NODE_ENV: 'development', DEMO_SCENARIO_ENABLED: 'false' })).toBe(false);
    expect(isDemoScenarioEnabled({ NODE_ENV: 'development', DEMO_SCENARIO_ENABLED: 'true' })).toBe(true);
  });
});
