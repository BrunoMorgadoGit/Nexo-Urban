import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { randomUUID } from 'node:crypto';
import { CreateAgentDto } from './create-agent.dto.js';

describe('CreateAgentDto', () => {
  it('trims strings, transforms coordinates and validates the operational contract', async () => {
    const dto = plainToInstance(CreateAgentDto, {
      name: '  Ana Operadora  ',
      identifier: '  POL-10  ',
      category: 'civil_police_officer',
      organizationId: randomUUID(),
      availability: 'on_duty',
      position: {
        latitude: '-22.9', longitude: '-47.06', recordedAt: new Date().toISOString(), regionId: randomUUID(),
      },
      newOperationalBase: {
        name: '  Base Central  ', regionId: randomUUID(), latitude: '-22.91', longitude: '-47.05',
      },
      equipmentId: randomUUID(),
      operationalNotes: '  Turno diurno  ',
    });

    expect(await validate(dto)).toEqual([]);
    expect(dto.name).toBe('Ana Operadora');
    expect(dto.identifier).toBe('POL-10');
    expect(dto.position?.latitude).toBe(-22.9);
    expect(dto.position?.longitude).toBe(-47.06);
    expect(dto.newOperationalBase?.name).toBe('Base Central');
    expect(dto.newOperationalBase?.latitude).toBe(-22.91);
    expect(dto.operationalNotes).toBe('Turno diurno');
  });

  it('rejects invalid categories, ids, nested coordinates and oversized notes', async () => {
    const dto = plainToInstance(CreateAgentDto, {
      name: 'A', identifier: 'X', category: 'unauthorized', organizationId: 'not-a-uuid', availability: 'moving',
      position: { latitude: '91', longitude: '-181', recordedAt: new Date(Date.now() + 600_000).toISOString() },
      newOperationalBase: { name: 'B', latitude: '91', longitude: '-181' },
      operationalNotes: 'x'.repeat(501),
    });

    const errors = await validate(dto);
    expect(errors.map(({ property }) => property)).toEqual(expect.arrayContaining([
      'name', 'identifier', 'category', 'organizationId', 'availability', 'position', 'newOperationalBase', 'operationalNotes',
    ]));
    expect(errors.find(({ property }) => property === 'position')?.children?.length).toBeGreaterThan(0);
    expect(errors.find(({ property }) => property === 'newOperationalBase')?.children?.length).toBeGreaterThan(0);
  });
});
