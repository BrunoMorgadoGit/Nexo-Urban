import type { MonitoringOverview } from '@fogo/contracts';
import { equipmentDistribution } from './equipment-distribution';

const overview: MonitoringOverview = {
  demoMode: true,
  totalEquipment: 10,
  equipmentStatusCounts: {
    operational: 4,
    malfunctioning: 2,
    maintenance: 1,
    stolen: 1,
    deactivated: 1,
    not_installed: 1,
  },
  unclassifiedEquipment: 0,
  eligibleEquipment: 8,
  operationalEquipment: 4,
  unavailableEquipment: 4,
  availabilityPercent: 50,
  agentsOnDuty: 3,
  activeCriticalAlerts: 1,
  overdueMaintenance: 0,
  calculatedAt: '2026-10-24T12:00:00.000Z',
};

describe('equipmentDistribution', () => {
  it('accounts for each inventory status exactly once and uses total inventory as the chart denominator', () => {
    const distribution = equipmentDistribution(overview);
    expect(distribution.reduce((sum, segment) => sum + segment.count, 0)).toBe(overview.totalEquipment);
    expect(distribution.reduce((sum, segment) => sum + segment.percent, 0)).toBeCloseTo(100);
    expect(distribution.map(({ status }) => status)).toEqual([
      'operational', 'malfunctioning', 'maintenance', 'stolen', 'deactivated', 'not_installed', 'unclassified',
    ]);
  });

  it('returns zero-width segments for an empty inventory', () => {
    const empty = equipmentDistribution({
      ...overview,
      totalEquipment: 0,
      equipmentStatusCounts: {
        operational: 0, malfunctioning: 0, maintenance: 0, stolen: 0, deactivated: 0, not_installed: 0,
      },
      unclassifiedEquipment: 0,
    });
    expect(empty.every((segment) => segment.count === 0 && segment.percent === 0)).toBe(true);
  });

  it('preserves inventory records whose stored status does not match a known category', () => {
    const distribution = equipmentDistribution({ ...overview, totalEquipment: 11, unclassifiedEquipment: 1 });
    expect(distribution.at(-1)?.count).toBe(1);
    expect(distribution.reduce((sum, segment) => sum + segment.count, 0)).toBe(11);
    expect(distribution.reduce((sum, segment) => sum + segment.percent, 0)).toBeCloseTo(100);
  });
});
