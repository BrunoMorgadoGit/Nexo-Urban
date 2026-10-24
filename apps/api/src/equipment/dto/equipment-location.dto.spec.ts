import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { EquipmentLocationDto } from './equipment-location.dto.js';

describe('EquipmentLocationDto', () => {
  it('normalizes string fields and numeric coordinates before validation', () => {
    const dto = plainToInstance(EquipmentLocationDto, {
      postalCode: ' 13000-000 ', street: ' Rua Central ', reference: ' 100 ',
      regionId: 'd912675e-2fe9-469a-986b-451859a30bac', city: ' Campinas ', state: ' sp ',
      latitude: '-22.9', longitude: '-47.06', role: 'fixed',
    });

    expect(dto.postalCode).toBe('13000-000');
    expect(dto.street).toBe('Rua Central');
    expect(dto.reference).toBe('100');
    expect(dto.city).toBe('Campinas');
    expect(dto.state).toBe('SP');
    expect(dto.latitude).toBe(-22.9);
    expect(dto.longitude).toBe(-47.06);
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('leaves non-string values for class validation and rejects invalid coordinates and role', () => {
    const dto = plainToInstance(EquipmentLocationDto, {
      postalCode: 13000000, street: 12, reference: false,
      regionId: 'invalid', city: null, state: 'São Paulo',
      latitude: 91, longitude: 181, role: 'unknown',
    });

    expect(validateSync(dto).map(({ property }) => property)).toEqual(expect.arrayContaining([
      'postalCode', 'street', 'reference', 'regionId', 'city', 'state', 'latitude', 'longitude', 'role',
    ]));
  });
});
