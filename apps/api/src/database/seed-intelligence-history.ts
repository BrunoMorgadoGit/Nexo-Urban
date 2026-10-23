import { EquipmentEntity } from '../equipment/equipment.entity.js';
import { IntelligenceDatasetEntity } from '../intelligence/intelligence-dataset.entity.js';
import { IntelligenceHistoryEventEntity, type IntelligenceHistoryEventType } from '../intelligence/intelligence-history-event.entity.js';
import dataSource from './data-source.js';
import type { QueryDeepPartialEntity } from 'typeorm';

const datasetKey = 'campinas-city-history-v1';
const datasetVersion = '1.0.0';
const dayMs = 24 * 60 * 60 * 1000;
type SeedHistoryEvent = {
  datasetKey: string;
  eventKey: string;
  equipmentId: string;
  regionId: string;
  eventType: IntelligenceHistoryEventType;
  severity: 'low' | 'medium' | 'high' | 'critical' | null;
  occurredAt: Date;
  details: Record<string, unknown>;
  origin: 'synthetic';
};

type Scenario = {
  failures: Array<{ daysAgo: number; severity: 'medium' | 'high' | 'critical' }>;
  recoveries: number[];
  maintenanceDue?: Array<{ daysAgo: number; priority: 'high' | 'immediate' }>;
  maintenanceCompleted?: number[];
  observations?: number[];
};

const scenarios: Record<string, Scenario> = {
  'DEMO-RAD-001': {
    failures: [80, 50, 25, 14, 9, 3].map((daysAgo) => ({ daysAgo, severity: daysAgo <= 14 ? 'high' : 'medium' })),
    recoveries: [77, 47, 22, 11, 6, 1],
  },
  'DEMO-CAM-001': { failures: [{ daysAgo: 62, severity: 'medium' }], recoveries: [58] },
  'DEMO-BAL-001': {
    failures: [80, 61, 46, 32, 21, 10, 4].map((daysAgo) => ({ daysAgo, severity: daysAgo <= 10 ? 'critical' : 'high' })),
    recoveries: [76, 58, 42, 28, 17, 7],
    maintenanceDue: [{ daysAgo: 12, priority: 'immediate' }],
  },
  'DEMO-FIS-001': {
    failures: [71, 42, 19, 8].map((daysAgo) => ({ daysAgo, severity: 'medium' })),
    recoveries: [68, 39, 16, 5],
  },
  'DEMO-CAN-001': { failures: [], recoveries: [] },
  'DEMO-TRN-001': { failures: [{ daysAgo: 65, severity: 'medium' }, { daysAgo: 20, severity: 'high' }], recoveries: [62, 17] },
  'DEMO-TOT-001': {
    failures: [72, 43, 36].map((daysAgo) => ({ daysAgo, severity: 'high' })),
    recoveries: [69, 40, 32],
    maintenanceDue: [{ daysAgo: 5, priority: 'high' }],
  },
  'DEMO-PAT-001': {
    failures: [33, 10, 5].map((daysAgo) => ({ daysAgo, severity: daysAgo <= 10 ? 'high' : 'medium' })),
    recoveries: [30, 8, 2],
    maintenanceDue: [{ daysAgo: 34, priority: 'high' }],
  },
  'DEMO-MOT-001': {
    failures: [51, 47, 42].map((daysAgo) => ({ daysAgo, severity: 'high' })),
    recoveries: [38],
    maintenanceDue: [{ daysAgo: 54, priority: 'immediate' }],
  },
  'DEMO-VIA-001': { failures: [], recoveries: [], observations: [70, 35, 0] },
  'DEMO-CAM-002': { failures: [{ daysAgo: 80, severity: 'medium' }], recoveries: [] },
  'DEMO-PAT-002': { failures: [{ daysAgo: 75, severity: 'critical' }, { daysAgo: 65, severity: 'critical' }], recoveries: [] },
};

function occurredAt(anchorAt: Date, daysAgo: number, hour = 8): Date {
  return new Date(anchorAt.getTime() - daysAgo * dayMs - hour * 60 * 60 * 1000);
}

function eventKey(serialNumber: string, type: IntelligenceHistoryEventType, daysAgo: number, ordinal = 0): string {
  return `${datasetKey}:${serialNumber}:${type}:${daysAgo}:${ordinal}`;
}

async function seedIntelligenceHistory(): Promise<void> {
  await dataSource.initialize();
  try {
    const inserted = await dataSource.getRepository(IntelligenceDatasetEntity)
      .createQueryBuilder()
      .insert()
      .values({
        datasetKey,
        version: datasetVersion,
        origin: 'synthetic',
        anchorAt: new Date(),
        details: {
          city: 'Campinas',
          periodDays: 90,
          scenarios: ['stable', 'deteriorating', 'recurrent-failure', 'maintenance-recovery', 'low-coverage'],
          generator: 'seed-intelligence-history-v1',
        },
      })
      .orIgnore()
      .returning(['datasetKey'])
      .execute();
    const dataset = await dataSource.getRepository(IntelligenceDatasetEntity).findOneByOrFail({ datasetKey });
    const equipment = await dataSource.getRepository(EquipmentEntity).createQueryBuilder('equipment')
      .innerJoinAndSelect('equipment.location', 'location')
      .innerJoinAndSelect('location.region', 'region')
      .where('equipment.dataOrigin = :origin', { origin: 'demo' })
      .orderBy('equipment.serialNumber', 'ASC')
      .getMany();
    if (equipment.length === 0) throw new Error('Nenhum equipamento DEMO foi encontrado. Execute o seed base antes deste gerador.');

    const events: SeedHistoryEvent[] = [];
    for (const asset of equipment) {
      const scenario = scenarios[asset.serialNumber] ?? { failures: [], recoveries: [] };
      const observationOffsets = scenario.observations ?? [88, 81, 74, 67, 60, 53, 46, 39, 32, 25, 18, 11, 4, 0];
      const transitions = [
        ...scenario.failures.map((failure, ordinal) => ({
          at: occurredAt(dataset.anchorAt, failure.daysAgo, 5),
          status: 'malfunctioning',
          type: 'failure' as const,
          severity: failure.severity,
          ordinal,
        })),
        ...scenario.recoveries.map((daysAgo, ordinal) => ({
          at: occurredAt(dataset.anchorAt, daysAgo, 7),
          status: 'operational',
          type: 'maintenance_completed' as const,
          severity: null,
          ordinal,
        })),
      ].sort((left, right) => left.at.getTime() - right.at.getTime());

      for (const [ordinal, transition] of transitions.entries()) {
        events.push({
          datasetKey,
          eventKey: eventKey(asset.serialNumber, transition.type, Math.round((dataset.anchorAt.getTime() - transition.at.getTime()) / dayMs), ordinal),
          equipmentId: asset.id,
          regionId: asset.location.regionId,
          eventType: transition.type,
          severity: transition.severity,
          occurredAt: transition.at,
          details: {
            synthetic: true,
            datasetVersion,
            stateAfter: transition.status,
            scenario: asset.serialNumber === 'DEMO-RAD-001' ? 'increasing-failure-rate' : 'reproducible-city-history',
          },
          origin: 'synthetic',
        });
      }

      for (const [ordinal, daysAgo] of observationOffsets.entries()) {
        const observedAt = occurredAt(dataset.anchorAt, daysAgo, 8);
        const priorTransition = transitions.filter((transition) => transition.at <= observedAt).at(-1);
        const status = daysAgo === 0 ? asset.status : priorTransition?.status ?? 'operational';
        events.push({
          datasetKey,
          eventKey: eventKey(asset.serialNumber, 'status_observation', daysAgo, ordinal),
          equipmentId: asset.id,
          regionId: asset.location.regionId,
          eventType: 'status_observation',
          severity: null,
          occurredAt: observedAt,
          details: { synthetic: true, datasetVersion, status, cadence: scenario.observations ? 'sparse' : 'weekly' },
          origin: 'synthetic',
        });
      }

      for (const [ordinal, due] of (scenario.maintenanceDue ?? []).entries()) {
        events.push({
          datasetKey,
          eventKey: eventKey(asset.serialNumber, 'maintenance_due', due.daysAgo, ordinal),
          equipmentId: asset.id,
          regionId: asset.location.regionId,
          eventType: 'maintenance_due',
          severity: due.priority === 'immediate' ? 'high' : 'medium',
          occurredAt: occurredAt(dataset.anchorAt, due.daysAgo, 9),
          details: { synthetic: true, datasetVersion, priority: due.priority, maintenanceKey: `${asset.serialNumber}:maintenance:${due.daysAgo}` },
          origin: 'synthetic',
        });
      }

      for (const [ordinal, daysAgo] of (scenario.maintenanceCompleted ?? []).entries()) {
        events.push({
          datasetKey,
          eventKey: eventKey(asset.serialNumber, 'maintenance_completed', daysAgo, scenario.recoveries.length + ordinal),
          equipmentId: asset.id,
          regionId: asset.location.regionId,
          eventType: 'maintenance_completed',
          severity: null,
          occurredAt: occurredAt(dataset.anchorAt, daysAgo, 7),
          details: { synthetic: true, datasetVersion, outcome: 'improved', maintenanceKey: `${asset.serialNumber}:maintenance:${daysAgo}` },
          origin: 'synthetic',
        });
      }
    }

    if (events.length > 0) {
      await dataSource.getRepository(IntelligenceHistoryEventEntity)
        .createQueryBuilder()
        .insert()
        .values(events as unknown as QueryDeepPartialEntity<IntelligenceHistoryEventEntity>[])
        .orIgnore()
        .execute();
    }
    const counts = await dataSource.getRepository(IntelligenceHistoryEventEntity)
      .createQueryBuilder('event')
      .select('event.eventType', 'type')
      .addSelect('COUNT(*)::int', 'count')
      .where('event.datasetKey = :datasetKey', { datasetKey })
      .groupBy('event.eventType')
      .getRawMany<{ type: string; count: number }>();
    console.info(JSON.stringify({ datasetKey, datasetVersion, anchorAt: dataset.anchorAt.toISOString(), inserted: inserted.raw.length, eventsByType: counts }));
  } finally {
    await dataSource.destroy();
  }
}

await seedIntelligenceHistory();
