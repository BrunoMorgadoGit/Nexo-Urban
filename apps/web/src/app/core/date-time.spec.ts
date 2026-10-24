import { dateTimeToLocalInputValue, localDateInputValue, localDateTimeInputValue } from './date-time';

describe('date-time helpers', () => {
  const instant = new Date('2026-10-24T12:34:56.000Z');

  it('formats dates and local datetimes for native input controls', () => {
    expect(localDateInputValue(instant)).toMatch(/^2026-10-2[34]$/);
    expect(localDateTimeInputValue(instant)).toMatch(/^2026-10-2[34]T\d{2}:34$/);
    expect(dateTimeToLocalInputValue(instant.toISOString())).toBe(localDateTimeInputValue(instant));
  });

  it('uses the current instant when no date is provided', () => {
    const before = Date.now();
    expect(localDateInputValue()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(localDateTimeInputValue()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(Date.now()).toBeGreaterThanOrEqual(before);
  });
});
