import { addCalendarDays, operationalDateKey, OPERATIONAL_TIME_ZONE } from './operational-date.js';

describe('operational civil dates', () => {
  it('uses the configured Campinas civil date around UTC midnight boundaries', () => {
    expect(OPERATIONAL_TIME_ZONE).toBe('America/Sao_Paulo');
    expect(operationalDateKey(new Date('2026-10-24T02:59:59.999Z'))).toBe('2026-10-23');
    expect(operationalDateKey(new Date('2026-10-24T03:00:00.000Z'))).toBe('2026-10-24');
  });

  it('adds calendar days without applying a UTC date to local operational rules', () => {
    expect(addCalendarDays('2026-10-23', 14)).toBe('2026-11-06');
    expect(addCalendarDays('2026-10-24', -1)).toBe('2026-10-23');
  });
});
