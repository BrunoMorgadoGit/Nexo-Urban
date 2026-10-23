import { BadRequestException } from '@nestjs/common';
import { equipmentTypeDefinitions, validateEquipmentCharacteristics } from './equipment-characteristics.js';

describe('equipment characteristics schemas', () => {
  it('exposes all challenge equipment categories with schema descriptors', () => {
    expect(equipmentTypeDefinitions.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        'speed_radar',
        'surveillance_camera',
        'weighbridge',
        'enforcement_vehicle',
        'access_barrier',
        'transit_vehicle',
        'service_kiosk',
        'scooter',
        'motorcycle',
        'patrol_vehicle',
      ]),
    );
    expect(equipmentTypeDefinitions.every(({ characteristics }) => characteristics.length > 0)).toBe(true);
  });

  it('accepts and returns the validated radar attributes', () => {
    const input = { speedLimitKmh: 50, lanes: 3, technology: 'doppler' };
    expect(validateEquipmentCharacteristics('speed_radar', input)).toEqual(input);
  });

  it.each([
    ['speed_radar', { speedLimitKmh: 50, lanes: 3, technology: 'doppler' }],
    ['surveillance_camera', { resolution: '4k', nightVision: true, panTiltZoom: false }],
    ['weighbridge', { maxWeightKg: 80000, precisionKg: 5 }],
    ['enforcement_vehicle', { vehicleClass: 'pickup', plate: 'FGO1A26', radioCode: 'MOB-01' }],
    ['access_barrier', { laneCount: 2, maxOpeningSeconds: 8, accessMode: 'tag' }],
    ['transit_vehicle', { vehicleClass: 'bus', passengerCapacity: 48, accessible: true }],
    ['service_kiosk', { screenInches: 21, network: 'ethernet' }],
    ['scooter', { batteryCapacityWh: 480, topSpeedKmh: 25 }],
    ['motorcycle', { engineCapacityCc: 300, plate: 'FGO2B26', radioCode: 'GCM-03' }],
    ['patrol_vehicle', { vehicleClass: 'van', plate: 'FGO3C26', radioCode: 'GCM-11' }],
  ])('validates the %s characteristic contract', (typeCode, input) => {
    expect(validateEquipmentCharacteristics(typeCode, input)).toEqual(input);
  });

  it('rejects values outside the type-specific range', () => {
    expect(() => validateEquipmentCharacteristics('speed_radar', {
      speedLimitKmh: 220,
      lanes: 3,
      technology: 'doppler',
    })).toThrow(BadRequestException);
  });

  it('rejects arbitrary fields rather than persisting unvalidated JSON', () => {
    expect(() => validateEquipmentCharacteristics('surveillance_camera', {
      resolution: '4k',
      nightVision: true,
      panTiltZoom: false,
      operatorNotes: 'unvalidated',
    })).toThrow(BadRequestException);
  });

  it('rejects unknown equipment type codes', () => {
    expect(() => validateEquipmentCharacteristics('custom_without_schema', {})).toThrow(BadRequestException);
  });
});
