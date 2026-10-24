import { isPositionStale, stalePositionAfterMs } from './monitoring-policies.js';

describe('GPS position freshness', () => {
  const now = Date.parse('2026-10-23T15:00:00.000Z');

  it('treats future timestamps as stale even inside the accepted clock-skew tolerance', () => {
    expect(isPositionStale(new Date(now + 60_000), now)).toBe(true);
  });

  it('treats recent timestamps as fresh and old timestamps as stale', () => {
    expect(isPositionStale(new Date(now - stalePositionAfterMs + 1), now)).toBe(false);
    expect(isPositionStale(new Date(now - stalePositionAfterMs - 1), now)).toBe(true);
  });
});
