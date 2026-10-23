import { calculateAvailability } from './monitoring-policies.js';

describe('calculateAvailability', () => {
  it('excludes not-installed and deactivated equipment while retaining stolen resources as unavailable', () => {
    expect(calculateAvailability({
      operational: 4,
      malfunctioning: 2,
      maintenance: 1,
      stolen: 1,
      not_installed: 2,
      deactivated: 3,
    })).toEqual({
      totalEquipment: 13,
      eligibleEquipment: 8,
      operationalEquipment: 4,
      unavailableEquipment: 4,
      availabilityPercent: 50,
    });
  });

  it('returns zero availability when the denominator is empty', () => {
    expect(calculateAvailability({ not_installed: 3, deactivated: 2 })).toEqual({
      totalEquipment: 5,
      eligibleEquipment: 0,
      operationalEquipment: 0,
      unavailableEquipment: 0,
      availabilityPercent: 0,
    });
  });

  it('rounds the percentage to one decimal place', () => {
    expect(calculateAvailability({ operational: 2, malfunctioning: 1 }).availabilityPercent).toBe(66.7);
  });
});
