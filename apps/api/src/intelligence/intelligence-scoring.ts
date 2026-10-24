import type {
  IntelligenceRiskClassification,
  IntelligenceRiskFactor,
  IntelligenceSourceScope,
  PredictiveMaintenancePriority,
  RegionContract,
  RegionalRiskAssessment,
} from '@fogo/contracts';
import type { EquipmentStatus, MaintenancePriority } from '@fogo/contracts';
import { equipmentStatuses } from '@fogo/contracts';
import { addCalendarDays, operationalDateKey } from '../common/operational-date.js';

export const INTELLIGENCE_METHOD_VERSION = 'risk-rules-v1';
export const HISTORY_WINDOW_DAYS = 90;
const dayMs = 24 * 60 * 60 * 1000;

export type HistoricalIntelligenceEvent = {
  occurredAt: Date;
  equipmentId: string;
  regionId: string;
  eventType: 'status_observation' | 'failure' | 'maintenance_due' | 'maintenance_completed';
  severity: 'low' | 'medium' | 'high' | 'critical' | null;
  details: Record<string, unknown>;
};

export type CurrentStatusSnapshot = { equipmentId: string; status: EquipmentStatus };

export type RegionalScoringInput = {
  region: RegionContract;
  referenceAt: Date;
  sourceScope: IntelligenceSourceScope;
  events: HistoricalIntelligenceEvent[];
  eligibleEquipmentCount: number;
  currentStatuses?: CurrentStatusSnapshot[];
  currentPendingMaintenanceCount?: number;
  sourceComposition: RegionalRiskAssessment['sourceComposition'];
};

const weights = {
  failurePressure: 0.26,
  temporalTrend: 0.22,
  unavailability: 0.18,
  recurrence: 0.14,
  maintenancePressure: 0.1,
  severity: 0.05,
  informationAge: 0.05,
} as const;

const clamp = (value: number, min = 0, max = 100): number => Math.min(max, Math.max(min, value));
const ratePerTen = (count: number, equipment: number, days: number): number =>
  equipment > 0 && days > 0 ? count / equipment * 10 * 30 / days : 0;

function riskClassification(score: number): IntelligenceRiskClassification {
  if (score >= 70) return 'critical';
  if (score >= 50) return 'elevated';
  if (score >= 25) return 'moderate';
  return 'low';
}

function statusFrom(event: HistoricalIntelligenceEvent): EquipmentStatus | null {
  const status = event.details.status;
  return typeof status === 'string' && equipmentStatuses.includes(status as EquipmentStatus) ? status as EquipmentStatus : null;
}

function latestStatusByEquipment(events: HistoricalIntelligenceEvent[]): Map<string, EquipmentStatus> {
  const latest = new Map<string, { at: number; status: EquipmentStatus }>();
  for (const event of events) {
    if (event.eventType !== 'status_observation') continue;
    const status = statusFrom(event);
    if (!status) continue;
    const existing = latest.get(event.equipmentId);
    if (!existing || existing.at < event.occurredAt.getTime()) {
      latest.set(event.equipmentId, { at: event.occurredAt.getTime(), status });
    }
  }
  return new Map([...latest].map(([equipmentId, value]) => [equipmentId, value.status]));
}

export function calculateRegionalRisk(input: RegionalScoringInput): RegionalRiskAssessment {
  const windowStart = new Date(input.referenceAt.getTime() - HISTORY_WINDOW_DAYS * dayMs);
  const history = input.events.filter((event) => event.regionId === input.region.id
    && event.occurredAt <= input.referenceAt && event.occurredAt >= windowStart);
  const observations = history.filter((event) => event.eventType === 'status_observation');
  const observedEquipment = new Set(observations.map((event) => event.equipmentId));
  const observationTimes = observations.map((event) => event.occurredAt.getTime());
  const coverageDays = observationTimes.length > 1
    ? Math.max(0, Math.floor((Math.max(...observationTimes) - Math.min(...observationTimes)) / dayMs))
    : 0;
  const latestObservationAt = observationTimes.length ? new Date(Math.max(...observationTimes)) : null;
  const latestObservationAgeDays = latestObservationAt
    ? Math.max(0, Math.floor((input.referenceAt.getTime() - latestObservationAt.getTime()) / dayMs))
    : null;
  const failures = history.filter((event) => event.eventType === 'failure');
  const recentStart = new Date(input.referenceAt.getTime() - 30 * dayMs);
  const previousStart = new Date(input.referenceAt.getTime() - 60 * dayMs);
  const recentFailures = failures.filter((event) => event.occurredAt >= recentStart);
  const previousFailures = failures.filter((event) => event.occurredAt >= previousStart && event.occurredAt < recentStart);
  const eligible = Math.max(input.eligibleEquipmentCount, observedEquipment.size);
  const latestStatuses = latestStatusByEquipment(history);
  for (const current of input.currentStatuses ?? []) {
    latestStatuses.set(current.equipmentId, current.status);
  }
  const unavailableStatuses = new Set<EquipmentStatus>(['malfunctioning', 'maintenance', 'stolen']);
  const unavailable = [...latestStatuses.values()].filter((status) => unavailableStatuses.has(status)).length;
  const failedEquipmentCounts = new Map<string, number>();
  for (const failure of failures) failedEquipmentCounts.set(failure.equipmentId, (failedEquipmentCounts.get(failure.equipmentId) ?? 0) + 1);
  const recurringEquipment = [...failedEquipmentCounts.values()].filter((count) => count > 1).length;
  const historicalMaintenanceDue = history.filter((event) => event.eventType === 'maintenance_due');
  const maintenanceDueCount = historicalMaintenanceDue.length + (input.currentPendingMaintenanceCount ?? 0);
  const completedMaintenances = history.filter((event) => event.eventType === 'maintenance_completed');
  const severityWeight: Record<NonNullable<HistoricalIntelligenceEvent['severity']>, number> = {
    low: 0.25, medium: 0.5, high: 0.75, critical: 1,
  };
  const meanSeverity = failures.length === 0 ? 0 : failures.reduce((total, event) =>
    total + (event.severity ? severityWeight[event.severity] : 0.5), 0) / failures.length;
  const recentRate = ratePerTen(recentFailures.length, eligible, 30);
  const previousRate = ratePerTen(previousFailures.length, eligible, 30);
  const trendChange = recentRate - previousRate;
  const trendRisk = recentRate === 0 && previousRate === 0
    ? 0
    : clamp(50 + trendChange / Math.max(previousRate, 0.5) * 50);
  const values = {
    failurePressure: clamp(recentRate * 25),
    temporalTrend: trendRisk,
    unavailability: eligible === 0 ? 0 : clamp(unavailable / eligible * 100),
    recurrence: eligible === 0 ? 0 : clamp(recurringEquipment / eligible * 250),
    maintenancePressure: eligible === 0 ? 0 : clamp(maintenanceDueCount / eligible * 300),
    severity: meanSeverity * 100,
    informationAge: latestObservationAgeDays === null ? 100 : clamp((latestObservationAgeDays - 7) / 14 * 100),
  };
  const score = Math.round(Object.entries(weights).reduce((total, [factor, weight]) =>
    total + values[factor as keyof typeof values] * weight, 0));
  const enoughObservations = observations.length >= 10 && coverageDays >= 60 && eligible > 0;
  const classification: IntelligenceRiskClassification = enoughObservations ? riskClassification(score) : 'insufficient_data';
  const dataQuality = !enoughObservations ? 'insufficient' : observations.length >= 20 && coverageDays >= 75 && (latestObservationAgeDays ?? 100) <= 14 ? 'sufficient' : 'limited';
  const factors: IntelligenceRiskFactor[] = [
    { code: 'failure_pressure', label: 'Taxa recente de falhas', observedValue: recentFailures.length, normalizedValue: values.failurePressure, weight: weights.failurePressure, contribution: values.failurePressure * weights.failurePressure, explanation: `${recentFailures.length} falha(s) nos últimos 30 dias; ${recentRate.toFixed(2)} por 10 equipamentos por mês.` },
    { code: 'temporal_trend', label: 'Tendência temporal', observedValue: Number(trendChange.toFixed(2)), normalizedValue: values.temporalTrend, weight: weights.temporalTrend, contribution: values.temporalTrend * weights.temporalTrend, explanation: `${recentRate.toFixed(2)} falhas/10 equipamentos no mês recente contra ${previousRate.toFixed(2)} no mês anterior.` },
    { code: 'unavailability', label: 'Indisponibilidade observada', observedValue: unavailable, normalizedValue: values.unavailability, weight: weights.unavailability, contribution: values.unavailability * weights.unavailability, explanation: `${unavailable} recurso(s) indisponível(is) na última observação disponível de ${latestStatuses.size} recurso(s).` },
    { code: 'recurrence', label: 'Recorrência', observedValue: recurringEquipment, normalizedValue: values.recurrence, weight: weights.recurrence, contribution: values.recurrence * weights.recurrence, explanation: `${recurringEquipment} equipamento(s) tiveram mais de uma falha na janela.` },
    { code: 'maintenance_pressure', label: 'Pressão de manutenção', observedValue: maintenanceDueCount, normalizedValue: values.maintenancePressure, weight: weights.maintenancePressure, contribution: values.maintenancePressure * weights.maintenancePressure, explanation: `${historicalMaintenanceDue.length} evento(s) histórico(s) e ${input.currentPendingMaintenanceCount ?? 0} manutenção(ões) atual(is) vencida(s) ou imediata(s); ${completedMaintenances.length} conclusão(ões) históricas.` },
    { code: 'incident_severity', label: 'Severidade histórica', observedValue: Number(meanSeverity.toFixed(2)), normalizedValue: values.severity, weight: weights.severity, contribution: values.severity * weights.severity, explanation: failures.length ? `Severidade média ponderada de ${meanSeverity.toFixed(2)} em ${failures.length} falha(s).` : 'Nenhuma falha observada na janela.' },
    { code: 'information_age', label: 'Atualidade das observações', observedValue: latestObservationAgeDays ?? -1, normalizedValue: values.informationAge, weight: weights.informationAge, contribution: values.informationAge * weights.informationAge, explanation: latestObservationAt ? `Última observação em ${latestObservationAt.toISOString()} (${latestObservationAgeDays} dia(s) antes da avaliação).` : 'Não há observações de estado na janela.' },
  ];
  const recommendations: string[] = [];
  if (!enoughObservations || latestObservationAgeDays === null || latestObservationAgeDays > 14) recommendations.push('Ampliar ou atualizar a coleta histórica antes de comparar esta região ou tratá-la como de baixo risco.');
  if (recentRate > previousRate && recentFailures.length > 0) recommendations.push('Investigar o aumento recente de falhas e priorizar inspeções dos equipamentos envolvidos.');
  if (unavailable > 0) recommendations.push('Verificar os recursos indisponíveis e confirmar se há manutenção ou incidente em andamento.');
  if (recurringEquipment > 0) recommendations.push('Antecipar inspeção dos equipamentos com falhas recorrentes.');
  if (maintenanceDueCount > 0) recommendations.push('Revisar manutenções vencidas, imediatas ou pendentes registradas.');
  if (recommendations.length === 0) recommendations.push('Manter o monitoramento periódico; o resultado não é uma probabilidade de incidente.');

  return {
    regionId: input.region.id,
    regionName: input.region.name,
    zone: input.region.zone,
    city: input.region.city,
    state: input.region.state,
    riskScore: enoughObservations ? score : null,
    classification,
    evaluatedAt: new Date().toISOString(),
    referenceAt: input.referenceAt.toISOString(),
    windowStart: windowStart.toISOString(),
    horizonHours: 24,
    historyWindowDays: HISTORY_WINDOW_DAYS,
    observationCount: observations.length,
    latestObservationAt: latestObservationAt?.toISOString() ?? null,
    failureCount: failures.length,
    eligibleEquipmentCount: eligible,
    unavailableEquipmentCount: unavailable,
    dataQuality,
    coverageDays,
    sourceScope: input.sourceScope,
    sourceComposition: input.sourceComposition,
    methodVersion: INTELLIGENCE_METHOD_VERSION,
    factors,
    recommendations,
  };
}

export type MaintenanceScoringInput = {
  equipment: {
    id: string;
    serialNumber: string;
    brand: string;
    model: string;
    typeCode: string;
    typeLabel: string;
    status: EquipmentStatus;
    organizationName: string;
    regionId: string;
    regionName: string;
    regionZone: string;
    dataOrigin: 'demo' | 'manual';
    maintenancePriority: MaintenancePriority;
    nextMaintenanceDate: string | null;
    createdAt: Date;
  };
  events: HistoricalIntelligenceEvent[];
  maintenances: Array<{ status: string; kind: string; priority: string; scheduledDate: string; completedAt: Date | null }>;
  referenceAt: Date;
};

export function prioritizeMaintenance(input: MaintenanceScoringInput): PredictiveMaintenancePriority | null {
  const { equipment, referenceAt } = input;
  if (['not_installed', 'deactivated', 'stolen'].includes(equipment.status)) return null;
  const windowStart = new Date(referenceAt.getTime() - HISTORY_WINDOW_DAYS * dayMs);
  const events = input.events.filter((event) => event.equipmentId === equipment.id
    && event.occurredAt <= referenceAt && event.occurredAt >= windowStart);
  const failures = events.filter((event) => event.eventType === 'failure');
  const lastFailure = failures.reduce<Date | null>((latest, event) => !latest || latest < event.occurredAt ? event.occurredAt : latest, null);
  const recentStart = new Date(referenceAt.getTime() - 30 * dayMs);
  const previousStart = new Date(referenceAt.getTime() - 60 * dayMs);
  const recentCount = failures.filter((event) => event.occurredAt >= recentStart).length;
  const previousCount = failures.filter((event) => event.occurredAt >= previousStart && event.occurredAt < recentStart).length;
  const activeMaintenance = input.maintenances.filter((maintenance) => ['scheduled', 'in_progress'].includes(maintenance.status));
  const today = operationalDateKey(referenceAt);
  const overdue = activeMaintenance.filter((maintenance) => maintenance.scheduledDate < today);
  const urgent = activeMaintenance.filter((maintenance) => maintenance.priority === 'immediate' || maintenance.kind === 'immediate');
  const overdueNextDate = Boolean(equipment.nextMaintenanceDate && equipment.nextMaintenanceDate < today);
  const nextDate = equipment.nextMaintenanceDate;
  const nextMaintenanceSoon = Boolean(nextDate && nextDate >= today && nextDate <= addCalendarDays(today, 7));
  const daysSinceLastFailure = lastFailure ? Math.max(0, Math.floor((referenceAt.getTime() - lastFailure.getTime()) / dayMs)) : null;
  const severityScore = failures.reduce((highest, failure) => Math.max(highest, {
    low: 2, medium: 5, high: 8, critical: 12,
  }[failure.severity ?? 'medium']), 0);
  const statusWeight: Partial<Record<EquipmentStatus, number>> = {
    malfunctioning: 45, maintenance: 28, stolen: 0, operational: 0,
  };
  const score = Math.min(100,
    Math.min(failures.length * 10, 30)
    + Math.min(recentCount * 12, 30)
    + (recentCount > previousCount ? 12 : 0)
    + Math.min(overdue.length * 15, 30)
    + Math.min(urgent.length * 18, 36)
    + (overdueNextDate ? 15 : 0)
    + (nextMaintenanceSoon ? 8 : 0)
    + Math.min(severityScore, 12)
    + (daysSinceLastFailure !== null && daysSinceLastFailure < 60 ? Math.floor((60 - daysSinceLastFailure) / 10) : 0)
    + (equipment.maintenancePriority === 'immediate' ? 18 : 0)
    + (statusWeight[equipment.status] ?? 0));
  const reasons: PredictiveMaintenancePriority['reasons'] = [];
  if (equipment.status === 'malfunctioning') reasons.push({ code: 'currently_malfunctioning', label: 'Falha atual', evidence: 'Equipamento está marcado como mau funcionamento no inventário.' });
  if (failures.length > 1) reasons.push({ code: 'recurrent_failures', label: 'Falhas recorrentes', evidence: `${failures.length} falhas nos últimos 90 dias.` });
  if (severityScore >= 8) reasons.push({ code: 'severe_failure', label: 'Falha grave registrada', evidence: `Severidade máxima observada: ${failures.find((failure) => (failure.severity === 'critical' ? 12 : failure.severity === 'high' ? 8 : 0) === severityScore)?.severity ?? 'alta'}.` });
  if (recentCount > previousCount && recentCount > 0) reasons.push({ code: 'deteriorating_trend', label: 'Aumento recente', evidence: `${recentCount} falha(s) nos últimos 30 dias contra ${previousCount} nos 30 dias anteriores.` });
  if (overdue.length || overdueNextDate) reasons.push({ code: 'overdue_maintenance', label: 'Manutenção vencida', evidence: `${Math.max(overdue.length, Number(overdueNextDate))} manutenção(ões) vencida(s) identificada(s).` });
  if (urgent.length) reasons.push({ code: 'urgent_maintenance', label: 'Manutenção urgente', evidence: `${urgent.length} manutenção(ões) ativa(s) com prioridade imediata.` });
  if (equipment.maintenancePriority === 'immediate' && !urgent.length) reasons.push({ code: 'immediate_priority', label: 'Prioridade imediata', evidence: 'Cadastro do equipamento indica prioridade imediata de manutenção.' });
  if (equipment.status === 'maintenance') reasons.push({ code: 'maintenance_in_progress', label: 'Em manutenção', evidence: 'Equipamento está com estado operacional de manutenção.' });
  if (nextMaintenanceSoon) reasons.push({ code: 'scheduled_maintenance', label: 'Manutenção próxima', evidence: `Próxima manutenção cadastrada para ${equipment.nextMaintenanceDate}.` });
  if (lastFailure) reasons.push({ code: 'last_failure', label: 'Falha mais recente', evidence: `Registro em ${lastFailure.toISOString()}.` });
  if (reasons.length === 0 && score < 20) return null;
  const recommendationType = equipment.status === 'malfunctioning' || urgent.length > 0 || overdue.some((maintenance) => maintenance.priority === 'immediate')
    ? 'corrective_urgent'
    : equipment.status === 'maintenance' ? 'monitor' : reasons.length > 0 ? 'preventive_inspection' : 'monitor';
  return {
    equipmentId: equipment.id,
    serialNumber: equipment.serialNumber,
    label: `${equipment.brand} ${equipment.model}`,
    typeCode: equipment.typeCode,
    typeLabel: equipment.typeLabel,
    status: equipment.status,
    organizationName: equipment.organizationName,
    regionId: equipment.regionId,
    regionName: equipment.regionName,
    regionZone: equipment.regionZone,
    dataOrigin: equipment.dataOrigin,
    priorityScore: score,
    recommendationType,
    failureCount90d: failures.length,
    recentFailureCount30d: recentCount,
    previousFailureCount30d: previousCount,
    lastFailureAt: lastFailure?.toISOString() ?? null,
    lastMaintenanceAt: [
      ...input.maintenances.filter((maintenance) => maintenance.status === 'completed' && maintenance.completedAt).map((maintenance) => maintenance.completedAt!),
      ...events.filter((event) => event.eventType === 'maintenance_completed').map((event) => event.occurredAt),
    ].reduce<Date | null>((latest, completedAt) => !latest || latest < completedAt ? completedAt : latest, null)
      ?.toISOString() ?? null,
    nextMaintenanceDate: equipment.nextMaintenanceDate,
    overdueMaintenanceCount: overdue.length + Number(overdueNextDate),
    urgentMaintenanceCount: urgent.length,
    reasons,
    detailPath: `/equipments/${equipment.id}`,
  };
}
