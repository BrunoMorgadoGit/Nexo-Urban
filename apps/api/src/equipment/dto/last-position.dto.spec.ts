import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { LastPositionDto } from './last-position.dto.js';

describe('LastPositionDto', () => {
  it('transforms coordinates and accepts a recent timestamp', () => {
    const dto = plainToInstance(LastPositionDto, {
      latitude: '-22.9',
      longitude: '-47.06',
      recordedAt: new Date(Date.now() - 1_000).toISOString(),
    });

    expect(dto.latitude).toBe(-22.9);
    expect(dto.longitude).toBe(-47.06);
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('rejects invalid coordinates, invalid dates, and timestamps beyond clock tolerance', () => {
    const invalidCoordinates = plainToInstance(LastPositionDto, {
      latitude: '91', longitude: '181', recordedAt: 'not-a-date',
    });
    const futureTimestamp = plainToInstance(LastPositionDto, {
      latitude: '-22.9', longitude: '-47.06',
      recordedAt: new Date(Date.now() + 5 * 60 * 1_000).toISOString(),
    });

    expect(validateSync(invalidCoordinates).map(({ property }) => property)).toEqual(
      expect.arrayContaining(['latitude', 'longitude', 'recordedAt']),
    );
    expect(validateSync(futureTimestamp).map(({ property }) => property)).toContain('recordedAt');
  });
});
