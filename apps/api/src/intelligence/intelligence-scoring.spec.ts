import { calculateRegionalRisk, prioritizeMaintenance, type HistoricalIntelligenceEvent } from './intelligence-scoring.js';

const referenceAt = new Date('2026-10-23T12:00:00.000Z');
const region = { id: 'region-1', code: 'centro', name: 'Centro', zone: 'Central', city: 'Campinas', state: 'SP' };
const sourceComposition = { syntheticObservations: 28, syntheticIncidents: 5, manualIncidents: 0 };

function event(
  daysAgo: number,
  eventType: HistoricalIntelligenceEvent['eventType'],
  equipmentId: string,
  details: Record<string, unknown> = {},
  severity: HistoricalIntelligenceEvent['severity'] = null,
): HistoricalIntelligenceEvent {
  return {
    occurredAt: new Date(referenceAt.getTime() - daysAgo * 24 * 60 * 60 * 1000),
    equipmentId,
    regionId: region.id,
    eventType,
    severity,
    details,
  };
}

describe('intelligence scoring', () => {
  it('normalizes recent event rates by the eligible equipment count', () => {
    const inputs = [
      event(0, 'failure', 'asset-1', {}, 'high'),
      ...Array.from({ length: 10 }, (_, index) => event(index * 7, 'status_observation', `asset-${index + 1}`, { status: 'operational' })),
    ];
    const assessment = calculateRegionalRisk({ region, referenceAt, sourceScope: 'demo', events: inputs, eligibleEquipmentCount: 10, sourceComposition });
    const failureFactor = assessment.factors.find((factor) => factor.code === 'failure_pressure');
    expect(failureFactor?.explanation).toContain('1.00 por 10 equipamentos por mês');
    expect(assessment.eligibleEquipmentCount).toBe(10);
  });

  it('is deterministic and does not count events after the reference instant', () => {
    const observations = Array.from({ length: 14 }, (_, index) => event(index * 6, 'status_observation', 'asset-1', { status: 'operational' }));
    const history = [...observations, event(5, 'failure', 'asset-1', {}, 'medium'), event(-2, 'failure', 'asset-1', {}, 'critical')];
    const input = { region, referenceAt, sourceScope: 'demo' as const, events: history, eligibleEquipmentCount: 1, sourceComposition };
    const first = calculateRegionalRisk(input);
    const second = calculateRegionalRisk(input);
    expect(first.riskScore).toBe(second.riskScore);
    expect(first.failureCount).toBe(1);
    expect(first.factors.find((factor) => factor.code === 'incident_severity')?.observedValue).toBe(0.5);
  });

  it('does not call a region with sparse history low risk', () => {
    const sparse = [event(80, 'status_observation', 'asset-1', { status: 'operational' }), event(0, 'status_observation', 'asset-1', { status: 'operational' })];
    const assessment = calculateRegionalRisk({ region, referenceAt, sourceScope: 'demo', events: sparse, eligibleEquipmentCount: 1, sourceComposition });
    expect(assessment.classification).toBe('insufficient_data');
    expect(assessment.riskScore).toBeNull();
    expect(assessment.recommendations[0]).toContain('Ampliar ou atualizar a coleta histórica');
  });

  it('uses the age of the latest observation as a weighted information-quality factor', () => {
    const observations = Array.from({ length: 28 }, (_, index) => event(85 - index * 2.5, 'status_observation', 'asset-1', { status: 'operational' }));
    const assessment = calculateRegionalRisk({ region, referenceAt, sourceScope: 'demo', events: observations, eligibleEquipmentCount: 1, sourceComposition });
    const freshness = assessment.factors.find((factor) => factor.code === 'information_age');
    expect(assessment.dataQuality).toBe('limited');
    expect(assessment.latestObservationAt).not.toBeNull();
    expect(freshness?.weight).toBe(0.05);
    expect(freshness?.normalizedValue).toBeGreaterThan(0);
    expect(assessment.factors.reduce((sum, factor) => sum + factor.weight, 0)).toBeCloseTo(1);
  });

  it('prioritizes corrective failures separately from preventive inspection and does not forecast failure dates', () => {
    const recentFailures = [event(20, 'failure', 'asset-1', {}, 'high'), event(7, 'failure', 'asset-1', {}, 'critical')];
    const recommendation = prioritizeMaintenance({
      equipment: {
        id: 'asset-1', serialNumber: 'DEMO-RAD-001', brand: 'Demo', model: 'Radar', typeCode: 'radar', typeLabel: 'Radar',
        status: 'malfunctioning', organizationName: 'DSIN', regionId: region.id, regionName: region.name, regionZone: region.zone,
        dataOrigin: 'demo', maintenancePriority: 'high', nextMaintenanceDate: null, createdAt: referenceAt,
      },
      events: recentFailures,
      maintenances: [],
      referenceAt,
    });
    expect(recommendation?.recommendationType).toBe('corrective_urgent');
    expect(recommendation?.failureCount90d).toBe(2);
    expect(recommendation?.reasons.map((reason) => reason.code)).toContain('recurrent_failures');
    expect(recommendation).not.toHaveProperty('predictedFailureAt');
  });
});
