import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  IntelligenceBacktest,
  IntelligenceOverview,
  IntelligenceSourceComposition,
  IntelligenceSourceScope,
  IntelligenceTrendPoint,
  PredictiveMaintenancePriority,
  RegionContract,
  RegionIntelligenceDetail,
  RegionalRiskAssessment,
} from '@fogo/contracts';
import { DataSource } from 'typeorm';
import { EquipmentEntity } from '../equipment/equipment.entity.js';
import { RegionEntity } from '../regions/region.entity.js';
import { IntelligenceAssessmentEntity } from './intelligence-assessment.entity.js';
import { IntelligenceHistoryEventEntity } from './intelligence-history-event.entity.js';
import { IntelligenceRegionAssessmentEntity } from './intelligence-region-assessment.entity.js';
import {
  calculateRegionalRisk,
  HISTORY_WINDOW_DAYS,
  INTELLIGENCE_METHOD_VERSION,
  prioritizeMaintenance,
  type HistoricalIntelligenceEvent,
} from './intelligence-scoring.js';

const dayMs = 24 * 60 * 60 * 1000;
const eventHorizonMs = 24 * 60 * 60 * 1000;
const classificationOrder = { critical: 0, elevated: 1, moderate: 2, low: 3, insufficient_data: 4 } as const;
type EquipmentRecord = EquipmentEntity & { location: EquipmentEntity['location'] & { region: RegionEntity } };
type IntelligenceSnapshotData = {
  referenceAt: Date;
  evaluatedAt: Date;
  regionEntities: RegionEntity[];
  events: HistoricalIntelligenceEvent[];
  equipmentByRegion: Map<string, EquipmentRecord[]>;
  sourceComposition: IntelligenceSourceComposition;
  riskRows: RegionalRiskAssessment[];
  maintenancePriorities: PredictiveMaintenancePriority[];
};

@Injectable()
export class IntelligenceService {
  private readonly cache = new Map<IntelligenceSourceScope, { expiresAt: number; value: Promise<IntelligenceSnapshotData> }>();

  constructor(private readonly dataSource: DataSource) {}

  async overview(sourceScope: IntelligenceSourceScope = 'demo'): Promise<IntelligenceOverview> {
    const snapshot = await this.snapshot(sourceScope);
    const maintenancePriorities = snapshot.maintenancePriorities;
    const trends = snapshot.riskRows.map((risk) => this.trendSummaryFor(risk, snapshot.events));
    return {
      sourceScope,
      evaluatedAt: snapshot.evaluatedAt.toISOString(),
      referenceAt: snapshot.referenceAt.toISOString(),
      windowStart: new Date(snapshot.referenceAt.getTime() - HISTORY_WINDOW_DAYS * dayMs).toISOString(),
      horizonHours: 24,
      historyWindowDays: HISTORY_WINDOW_DAYS,
      methodVersion: INTELLIGENCE_METHOD_VERSION,
      dataQuality: snapshot.riskRows.some((risk) => risk.dataQuality === 'sufficient')
        ? 'sufficient'
        : snapshot.riskRows.some((risk) => risk.dataQuality === 'limited') ? 'limited' : 'insufficient',
      sourceComposition: snapshot.sourceComposition,
      regionCount: snapshot.riskRows.length,
      insufficientRegionCount: snapshot.riskRows.filter((risk) => risk.classification === 'insufficient_data').length,
      highestRiskRegions: [...snapshot.riskRows].sort((a, b) => {
        const classDifference = classificationOrder[a.classification] - classificationOrder[b.classification];
        return classDifference || (b.riskScore ?? -1) - (a.riskScore ?? -1) || a.regionName.localeCompare(b.regionName);
      }).slice(0, 6),
      maintenancePriorities: maintenancePriorities.slice(0, 8),
      trendSummary: trends,
    };
  }

  async regions(sourceScope: IntelligenceSourceScope): Promise<RegionalRiskAssessment[]> {
    const { riskRows } = await this.snapshot(sourceScope);
    return [...riskRows].sort((a, b) => {
      const classDifference = classificationOrder[a.classification] - classificationOrder[b.classification];
      return classDifference || (b.riskScore ?? -1) - (a.riskScore ?? -1) || a.regionName.localeCompare(b.regionName);
    });
  }

  async region(regionId: string, sourceScope: IntelligenceSourceScope): Promise<RegionIntelligenceDetail> {
    const snapshot = await this.snapshot(sourceScope);
    const risk = snapshot.riskRows.find((candidate) => candidate.regionId === regionId);
    if (!risk) throw new NotFoundException('Região não encontrada.');
    return { risk, trend: this.buildTrend(risk.regionId, risk, snapshot.events, sourceScope) };
  }

  async maintenancePriorities(sourceScope: IntelligenceSourceScope): Promise<PredictiveMaintenancePriority[]> {
    const { maintenancePriorities } = await this.snapshot(sourceScope);
    return maintenancePriorities;
  }

  async trends(sourceScope: IntelligenceSourceScope): Promise<IntelligenceTrendPoint[]> {
    const snapshot = await this.snapshot(sourceScope);
    const selected = [...snapshot.riskRows].sort((a, b) => (b.riskScore ?? -1) - (a.riskScore ?? -1)).slice(0, 5);
    return selected.flatMap((region) => this.buildTrend(region.regionId, region, snapshot.events, sourceScope));
  }

  async validation(sourceScope: IntelligenceSourceScope): Promise<IntelligenceBacktest> {
    const { regionEntities, events, referenceAt } = await this.snapshot(sourceScope);
    const firstCutoff = new Date(referenceAt.getTime() - 89 * dayMs);
    const lastCutoff = new Date(referenceAt.getTime() - eventHorizonMs);
    const periods = new Map<string, { start: Date; end: Date; windows: number; incidents: number; modelFlags: number; baselineFlags: number }>();
    let sampleWindows = 0;
    let incidentWindows = 0;
    let excludedInsufficientWindows = 0;
    let modelTruePositives = 0;
    let baselineTruePositives = 0;
    let modelFlags = 0;
    let baselineFlags = 0;
    let precisionAtOneTruePositives = 0;
    let precisionAtOneCutoffs = 0;
    const classificationDistribution = { low: 0, moderate: 0, elevated: 0, critical: 0 };

    for (let cutoff = firstCutoff; cutoff <= lastCutoff; cutoff = new Date(cutoff.getTime() + dayMs)) {
      const periodKey = cutoff.toISOString().slice(0, 7);
      let period = periods.get(periodKey);
      if (!period) {
        period = { start: cutoff, end: cutoff, windows: 0, incidents: 0, modelFlags: 0, baselineFlags: 0 };
        periods.set(periodKey, period);
      }
      period.end = cutoff;
      const rankedWindows: Array<{ regionId: string; score: number; incident: boolean }> = [];
      for (const region of regionEntities) {
        const regionEvents = events.filter((event) => event.regionId === region.id);
        const pastEvents = regionEvents.filter((event) => event.occurredAt <= cutoff);
        const seenEquipment = new Set(pastEvents.filter((event) => event.eventType === 'status_observation').map((event) => event.equipmentId));
        const risk = calculateRegionalRisk({
          region: this.toRegionContract(region),
          referenceAt: cutoff,
          sourceScope,
          events: pastEvents,
          eligibleEquipmentCount: seenEquipment.size,
          sourceComposition: this.sourceComposition(pastEvents),
        });
        if (risk.classification === 'insufficient_data') {
          excludedInsufficientWindows++;
          continue;
        }
        const nextStart = cutoff;
        const nextEnd = new Date(cutoff.getTime() + eventHorizonMs);
        const incident = regionEvents.some((event) => event.eventType === 'failure' && event.occurredAt > nextStart && event.occurredAt <= nextEnd);
        const prior30 = pastEvents.filter((event) => event.eventType === 'failure' && event.occurredAt > new Date(cutoff.getTime() - 30 * dayMs));
        const baseline = prior30.length > 0;
        const model = risk.riskScore !== null && risk.riskScore >= 50;
        classificationDistribution[risk.classification]++;
        sampleWindows++;
        period.windows++;
        if (incident) { incidentWindows++; period.incidents++; }
        if (model) { modelFlags++; period.modelFlags++; if (incident) modelTruePositives++; }
        if (baseline) { baselineFlags++; period.baselineFlags++; if (incident) baselineTruePositives++; }
        if (risk.riskScore !== null) rankedWindows.push({ regionId: region.id, score: risk.riskScore, incident });
      }
      rankedWindows.sort((left, right) => right.score - left.score || left.regionId.localeCompare(right.regionId));
      const highestRanked = rankedWindows[0];
      if (highestRanked) {
        precisionAtOneCutoffs++;
        if (highestRanked.incident) precisionAtOneTruePositives++;
      }
    }
    const sufficient = sampleWindows >= 30 && incidentWindows >= 5;
    const modelFalsePositives = modelFlags - modelTruePositives;
    const modelFalseNegatives = incidentWindows - modelTruePositives;
    const baselineFalsePositives = baselineFlags - baselineTruePositives;
    const baselineFalseNegatives = incidentWindows - baselineTruePositives;
    return {
      sourceScope,
      evaluatedAt: new Date().toISOString(),
      methodVersion: INTELLIGENCE_METHOD_VERSION,
      horizonHours: 24,
      evaluationStart: firstCutoff.toISOString(),
      evaluationEnd: lastCutoff.toISOString(),
      sampleWindows,
      incidentWindows,
      excludedInsufficientWindows,
      incidentPrevalence: sampleWindows ? incidentWindows / sampleWindows : null,
      modelThreshold: 50,
      baselineRule: 'Alerta se houve ao menos uma falha na mesma região nos 30 dias anteriores.',
      modelPrecision: sufficient && modelFlags ? modelTruePositives / modelFlags : null,
      modelRecall: sufficient ? modelTruePositives / incidentWindows : null,
      baselinePrecision: sufficient && baselineFlags ? baselineTruePositives / baselineFlags : null,
      baselineRecall: sufficient ? baselineTruePositives / incidentWindows : null,
      modelConfusion: {
        truePositives: modelTruePositives,
        falsePositives: modelFalsePositives,
        trueNegatives: sampleWindows - modelTruePositives - modelFalsePositives - modelFalseNegatives,
        falseNegatives: modelFalseNegatives,
      },
      baselineConfusion: {
        truePositives: baselineTruePositives,
        falsePositives: baselineFalsePositives,
        trueNegatives: sampleWindows - baselineTruePositives - baselineFalsePositives - baselineFalseNegatives,
        falseNegatives: baselineFalseNegatives,
      },
      modelClassificationDistribution: classificationDistribution,
      modelPredictionRate: sampleWindows ? modelFlags / sampleWindows : null,
      baselinePredictionRate: sampleWindows ? baselineFlags / sampleWindows : null,
      precisionAtOne: {
        evaluatedCutoffs: precisionAtOneCutoffs,
        truePositives: precisionAtOneTruePositives,
        precision: sufficient && precisionAtOneCutoffs ? precisionAtOneTruePositives / precisionAtOneCutoffs : null,
        recall: sufficient ? precisionAtOneTruePositives / incidentWindows : null,
      },
      evaluationQuality: sufficient ? 'sufficient' : 'insufficient_sample',
      periods: [...periods].map(([, value]) => ({
        start: value.start.toISOString(), end: value.end.toISOString(), sampleWindows: value.windows,
        incidentWindows: value.incidents, modelFlags: value.modelFlags, baselineFlags: value.baselineFlags,
      })).filter((period) => period.sampleWindows > 0),
      limitations: [
        'Histórico demonstrativo sintético não representa uma validação independente em operação real.',
        'O corte de cada janela exclui eventos posteriores; eventos futuros são consultados apenas para medir o desfecho de 24 horas.',
        'Escores são índices de priorização e não probabilidades calibradas de incidentes.',
        ...(sufficient ? [] : ['A amostra e/ou o número de janelas com incidentes é insuficiente para métricas de desempenho confiáveis.']),
      ],
    };
  }

  private snapshot(sourceScope: IntelligenceSourceScope): Promise<IntelligenceSnapshotData> {
    const now = Date.now();
    const cached = this.cache.get(sourceScope);
    if (cached && cached.expiresAt > now) return cached.value;
    const value = this.computeSnapshot(sourceScope);
    this.cache.set(sourceScope, { expiresAt: now + 5 * 60_000, value });
    void value.catch(() => {
      if (this.cache.get(sourceScope)?.value === value) this.cache.delete(sourceScope);
    });
    return value;
  }

  private async computeSnapshot(sourceScope: IntelligenceSourceScope): Promise<IntelligenceSnapshotData> {
    const referenceAt = new Date();
    const windowStart = new Date(referenceAt.getTime() - HISTORY_WINDOW_DAYS * dayMs);
    const [regions, equipment, syntheticEvents, manualAlerts] = await Promise.all([
      this.dataSource.getRepository(RegionEntity).find({ order: { name: 'ASC' } }),
      this.dataSource.getRepository(EquipmentEntity).createQueryBuilder('equipment')
        .innerJoinAndSelect('equipment.type', 'type')
        .innerJoinAndSelect('equipment.organization', 'organization')
        .innerJoinAndSelect('equipment.location', 'location')
        .innerJoinAndSelect('location.region', 'region')
        .leftJoinAndSelect('equipment.maintenances', 'maintenance')
        .getMany() as Promise<EquipmentRecord[]>,
      this.dataSource.getRepository(IntelligenceHistoryEventEntity)
        .createQueryBuilder('event').where('event.occurredAt <= :referenceAt', { referenceAt })
        .andWhere('event.occurredAt >= :windowStart', { windowStart }).orderBy('event.occurredAt', 'ASC').getMany(),
      this.dataSource.query(`
        SELECT alert.resource_id AS "equipmentId", location.region_id AS "regionId",
          alert.created_at AS "occurredAt", alert.code, alert.severity
        FROM operational_alerts alert
        INNER JOIN equipment ON equipment.id = alert.resource_id AND alert.resource_type = 'equipment'
        INNER JOIN equipment_locations location ON location.equipment_id = equipment.id
        WHERE equipment.data_origin = 'manual' AND alert.created_at <= $1 AND alert.created_at >= $2
          AND alert.code IN ('equipment_malfunctioning', 'equipment_unavailable', 'equipment_stolen', 'maintenance_immediate', 'maintenance_overdue')
      `, [referenceAt, windowStart]) as Promise<Array<{ equipmentId: string; regionId: string; occurredAt: Date; code: string; severity: 'low' | 'medium' | 'high' | 'critical' }>>,
    ]);
    const scopedEquipment = equipment.filter((asset) => sourceScope === 'all'
      || (sourceScope === 'demo' ? asset.dataOrigin === 'demo' : asset.dataOrigin === 'manual'));
    const demoHistory: HistoricalIntelligenceEvent[] = syntheticEvents.map((event) => ({
      occurredAt: event.occurredAt,
      equipmentId: event.equipmentId,
      regionId: event.regionId,
      eventType: event.eventType,
      severity: event.severity,
      details: event.details,
    }));
    const manualHistory: HistoricalIntelligenceEvent[] = manualAlerts.map((alert) => ({
      occurredAt: new Date(alert.occurredAt),
      equipmentId: alert.equipmentId,
      regionId: alert.regionId,
      eventType: alert.code === 'maintenance_immediate' || alert.code === 'maintenance_overdue' ? 'maintenance_due' : 'failure',
      severity: alert.severity,
      details: { code: alert.code, origin: 'manual' },
    }));
    const selectedEvents = [
      ...(sourceScope === 'manual' ? [] : demoHistory),
      ...(sourceScope === 'demo' ? [] : manualHistory),
    ];
    const equipmentByRegion = new Map<string, EquipmentRecord[]>();
    for (const asset of scopedEquipment) {
      const bucket = equipmentByRegion.get(asset.location.regionId) ?? [];
      bucket.push(asset);
      equipmentByRegion.set(asset.location.regionId, bucket);
    }
    const sourceComposition: IntelligenceSourceComposition = this.sourceComposition(selectedEvents);
    const riskRows = regions.map((region) => {
      const members = equipmentByRegion.get(region.id) ?? [];
      const regionalEvents = selectedEvents.filter((event) => event.regionId === region.id);
      const eligible = members.filter((asset) => !['not_installed', 'deactivated'].includes(asset.status)).length;
      const today = referenceAt.toISOString().slice(0, 10);
      const pendingMaintenanceCount = members.reduce((total, asset) => total + asset.maintenances.filter((maintenance) =>
        ['scheduled', 'in_progress'].includes(maintenance.status)
        && (maintenance.scheduledDate < today || maintenance.priority === 'immediate' || maintenance.kind === 'immediate')).length, 0);
      const risk = calculateRegionalRisk({
        region: this.toRegionContract(region), referenceAt, sourceScope, events: regionalEvents,
        eligibleEquipmentCount: eligible,
        currentStatuses: members.map((asset) => ({ equipmentId: asset.id, status: asset.status })),
        currentPendingMaintenanceCount: pendingMaintenanceCount,
        sourceComposition: this.sourceComposition(regionalEvents),
      });
      const located = members.filter((asset) => Number.isFinite(asset.location.latitude) && Number.isFinite(asset.location.longitude));
      return {
        ...risk,
        locationCenter: located.length ? {
          latitude: located.reduce((sum, asset) => sum + asset.location.latitude, 0) / located.length,
          longitude: located.reduce((sum, asset) => sum + asset.location.longitude, 0) / located.length,
          equipmentCount: located.length,
        } : null,
      };
    });
    const maintenancePriorities = this.scoreMaintenancePriorities(scopedEquipment, selectedEvents, referenceAt);
    await this.persistAssessment(sourceScope, referenceAt, windowStart, sourceComposition, riskRows);
    return {
      referenceAt,
      evaluatedAt: new Date(),
      regionEntities: regions,
      events: selectedEvents,
      equipmentByRegion,
      sourceComposition,
      riskRows,
      maintenancePriorities,
    };
  }

  private async persistAssessment(
    sourceScope: IntelligenceSourceScope,
    referenceAt: Date,
    windowStart: Date,
    sourceComposition: IntelligenceSourceComposition,
    regions: RegionalRiskAssessment[],
  ): Promise<void> {
    const hourKey = referenceAt.toISOString().slice(0, 13);
    const assessmentKey = `${sourceScope}:${INTELLIGENCE_METHOD_VERSION}:${hourKey}`;
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(IntelligenceAssessmentEntity).upsert({
        assessmentKey, sourceScope, referenceAt, windowStart, horizonHours: 24,
        methodVersion: INTELLIGENCE_METHOD_VERSION, sourceComposition,
      }, ['assessmentKey']);
      const assessment = await manager.getRepository(IntelligenceAssessmentEntity).findOneByOrFail({ assessmentKey });
      if (regions.length === 0) return;
      await manager.getRepository(IntelligenceRegionAssessmentEntity).upsert(regions.map((risk) => ({
        assessmentId: assessment.id,
        regionId: risk.regionId,
        riskScore: risk.riskScore,
        classification: risk.classification,
        dataQuality: risk.dataQuality,
        observationCount: risk.observationCount,
        failureCount: risk.failureCount,
        eligibleEquipmentCount: risk.eligibleEquipmentCount,
        unavailableEquipmentCount: risk.unavailableEquipmentCount,
        coverageDays: risk.coverageDays,
        factors: risk.factors,
        recommendations: risk.recommendations,
      })), ['assessmentId', 'regionId']);
    });
  }

  private scoreMaintenancePriorities(
    equipment: EquipmentRecord[],
    events: HistoricalIntelligenceEvent[],
    referenceAt: Date,
  ): PredictiveMaintenancePriority[] {
    return equipment.map((asset) => prioritizeMaintenance({
      equipment: {
        id: asset.id, serialNumber: asset.serialNumber, brand: asset.brand, model: asset.model,
        typeCode: asset.typeCode, typeLabel: asset.type.label, status: asset.status,
        organizationName: asset.organization.name, regionId: asset.location.regionId,
        regionName: asset.location.region.name, regionZone: asset.location.region.zone,
        dataOrigin: asset.dataOrigin, maintenancePriority: asset.maintenancePriority,
        nextMaintenanceDate: asset.nextMaintenanceDate, createdAt: asset.createdAt,
      },
      events,
      maintenances: asset.maintenances.map((maintenance) => ({
        status: maintenance.status, kind: maintenance.kind, priority: maintenance.priority,
        scheduledDate: maintenance.scheduledDate, completedAt: maintenance.completedAt,
      })),
      referenceAt,
    })).filter((item): item is PredictiveMaintenancePriority => item !== null)
      .sort((a, b) => b.priorityScore - a.priorityScore || a.serialNumber.localeCompare(b.serialNumber));
  }

  private buildTrend(
    regionId: string,
    regionRisk: RegionalRiskAssessment,
    events: HistoricalIntelligenceEvent[],
    sourceScope: IntelligenceSourceScope,
  ): IntelligenceTrendPoint[] {
    const points: IntelligenceTrendPoint[] = [];
    const observationAnchor = events.filter((event) => event.regionId === regionId && event.eventType === 'status_observation')
      .reduce<Date | null>((latest, event) => !latest || latest < event.occurredAt ? event.occurredAt : latest, null);
    const endAt = observationAnchor ?? new Date(regionRisk.referenceAt);
    for (let daysAgo = 84; daysAgo >= 0; daysAgo -= 7) {
      const cutoff = new Date(endAt.getTime() - daysAgo * dayMs);
      const history = events.filter((event) => event.regionId === regionId && event.occurredAt <= cutoff);
      const pastObservations = history.filter((event) => event.eventType === 'status_observation');
      const observedAssets = new Set(pastObservations.map((event) => event.equipmentId));
      const score = calculateRegionalRisk({
        region: {
          id: regionRisk.regionId, code: '', name: regionRisk.regionName, zone: regionRisk.zone,
          city: regionRisk.city, state: regionRisk.state,
        },
        referenceAt: cutoff,
        sourceScope,
        events: history,
        eligibleEquipmentCount: observedAssets.size,
        sourceComposition: this.sourceComposition(history),
      });
      const last30Start = new Date(cutoff.getTime() - 30 * dayMs);
      const failuresInWindow = history.filter((event) => event.eventType === 'failure' && event.occurredAt > last30Start).length;
      points.push({
        regionId,
        regionName: regionRisk.regionName,
        referenceAt: cutoff.toISOString(),
        riskScore: score.riskScore,
        classification: score.classification,
        failuresInWindow,
        failureRatePerTenEquipment: Number((score.eligibleEquipmentCount > 0 ? failuresInWindow / score.eligibleEquipmentCount * 10 : 0).toFixed(2)),
      });
    }
    return points;
  }

  private trendSummaryFor(risk: RegionalRiskAssessment, events: HistoricalIntelligenceEvent[]) {
    const recentStart = new Date(risk.referenceAt).getTime() - 30 * dayMs;
    const priorStart = recentStart - 30 * dayMs;
    const failures = events.filter((event) => event.regionId === risk.regionId && event.eventType === 'failure' && event.occurredAt <= new Date(risk.referenceAt));
    const recent = failures.filter((event) => event.occurredAt.getTime() > recentStart).length;
    const previous = failures.filter((event) => event.occurredAt.getTime() > priorStart && event.occurredAt.getTime() <= recentStart).length;
    const denominator = Math.max(1, risk.eligibleEquipmentCount);
    return {
      regionId: risk.regionId,
      regionName: risk.regionName,
      recentRatePerTenEquipment: Number((recent / denominator * 10).toFixed(2)),
      previousRatePerTenEquipment: Number((previous / denominator * 10).toFixed(2)),
      direction: risk.dataQuality === 'insufficient'
        ? 'insufficient_data' as const
        : recent > previous ? 'increasing' as const : recent < previous ? 'decreasing' as const : 'stable' as const,
    };
  }

  private sourceComposition(events: HistoricalIntelligenceEvent[]): IntelligenceSourceComposition {
    return {
      syntheticObservations: events.filter((event) => event.eventType === 'status_observation').length,
      syntheticIncidents: events.filter((event) => ['failure', 'maintenance_due'].includes(event.eventType) && event.details.origin !== 'manual').length,
      manualIncidents: events.filter((event) => event.details.origin === 'manual').length,
    };
  }

  private toRegionContract(region: RegionEntity): RegionContract {
    return { id: region.id, code: region.code, name: region.name, zone: region.zone, city: region.city, state: region.state };
  }
}
