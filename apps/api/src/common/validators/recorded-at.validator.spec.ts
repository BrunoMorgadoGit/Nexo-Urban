import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAgentDto } from '../../agents/dto/create-agent.dto.js';
import { LastPositionDto } from '../../equipment/dto/last-position.dto.js';
import { GPS_CLOCK_SKEW_TOLERANCE_MS } from './recorded-at.validator.js';

describe('GPS recordedAt validation', () => {
  const validPosition = (recordedAt: string) => Object.assign(new LastPositionDto(), {
    latitude: -22.9,
    longitude: -47.0,
    recordedAt,
  });

  it('accepts a recent and an old valid timestamp', async () => {
    const results = await Promise.all([
      validate(validPosition(new Date().toISOString())),
      validate(validPosition(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())),
    ]);
    expect(results.map((errors) => errors.length)).toEqual([0, 0]);
  });

  it('allows only the documented small clock skew', async () => {
    const withinTolerance = await validate(validPosition(new Date(Date.now() + GPS_CLOCK_SKEW_TOLERANCE_MS - 1000).toISOString()));
    const beyondTolerance = await validate(validPosition(new Date(Date.now() + GPS_CLOCK_SKEW_TOLERANCE_MS + 1000).toISOString()));
    expect(withinTolerance).toHaveLength(0);
    expect(beyondTolerance.some((error) => error.property === 'recordedAt')).toBe(true);
  });

  it('rejects invalid timestamp values', async () => {
    const errors = await validate(validPosition('invalid-date'));
    expect(errors.some((error) => error.property === 'recordedAt')).toBe(true);
  });

  it('applies the same future-date rule to nested agent GPS positions', async () => {
    const input = (recordedAt: string) => plainToInstance(CreateAgentDto, {
      name: 'Agente de teste',
      identifier: 'E2E-GPS-1',
      category: 'traffic_agent',
      organizationId: '00000000-0000-4000-8000-000000000001',
      availability: 'available',
      position: { latitude: -22.9, longitude: -47, recordedAt },
    });
    const accepted = await validate(input(new Date(Date.now() - 60_000).toISOString()));
    const rejected = await validate(input(new Date(Date.now() + GPS_CLOCK_SKEW_TOLERANCE_MS + 1000).toISOString()));
    expect(accepted).toHaveLength(0);
    expect(rejected.find((error) => error.property === 'position')?.children?.some((error) => error.property === 'recordedAt')).toBe(true);
  });
});
