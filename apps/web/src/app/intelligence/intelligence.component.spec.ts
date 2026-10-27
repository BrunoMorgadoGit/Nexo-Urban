import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { IntelligenceBacktest, IntelligenceOverview, PredictiveMaintenancePriority, RegionalRiskAssessment } from '@fogo/contracts';
import { of, Subject, throwError } from 'rxjs';
import { InventoryApiService } from '../core/inventory-api.service';
import { IntelligenceComponent } from './intelligence.component';

type IntelligenceHarness = {
  qualityLabel(value: 'sufficient' | 'limited' | 'insufficient'): string;
  scopeLabel(value: 'demo' | 'manual' | 'all'): string;
  recommendationLabel(value: 'corrective_urgent' | 'preventive_inspection' | 'monitor'): string;
  recommendationAction(item: PredictiveMaintenancePriority): string;
  validationComparison(value: IntelligenceBacktest): string;
  changeScope(value: string): void;
  error: () => string;
  detailError: () => string;
};

const testOverview: IntelligenceOverview = {
  sourceScope: 'demo', evaluatedAt: '2026-10-23T12:00:00.000Z', referenceAt: '2026-10-23T12:00:00.000Z',
  windowStart: '2026-07-25T12:00:00.000Z', horizonHours: 24, historyWindowDays: 90, methodVersion: 'risk-rules-v1',
  dataQuality: 'sufficient', sourceComposition: { syntheticObservations: 2, syntheticIncidents: 1, manualObservations: 0, manualIncidents: 0 },
  regionCount: 0, insufficientRegionCount: 0, highestRiskRegions: [], maintenancePriorities: [], trendSummary: [],
};

const testBacktest: IntelligenceBacktest = {
  sourceScope: 'demo', evaluatedAt: '2026-10-23T12:00:00.000Z', methodVersion: 'risk-rules-v1', horizonHours: 24,
  evaluationStart: '2026-07-26T12:00:00.000Z', evaluationEnd: '2026-10-22T12:00:00.000Z', sampleWindows: 10,
  incidentWindows: 2, excludedInsufficientWindows: 0, incidentPrevalence: 0.2, modelThreshold: 50,
  baselineRule: 'Uma falha anterior por região.', modelPrecision: 0.8, modelRecall: 0.5,
  baselinePrecision: 0.6, baselineRecall: 0.4,
  modelConfusion: { truePositives: 2, falsePositives: 1, trueNegatives: 6, falseNegatives: 1 },
  baselineConfusion: { truePositives: 1, falsePositives: 1, trueNegatives: 6, falseNegatives: 2 },
  modelClassificationDistribution: { low: 4, moderate: 3, elevated: 2, critical: 1 },
  modelPredictionRate: 0.3, baselinePredictionRate: 0.2,
  precisionAtOne: { evaluatedCutoffs: 10, truePositives: 1, precision: 0.1, recall: 0.5 },
  evaluationQuality: 'sufficient', periods: [], limitations: [],
};

const priorityWithReason = (code: string): PredictiveMaintenancePriority => ({
  equipmentId: 'equipment-1', serialNumber: 'RAD-001', label: 'Radar demonstrativo', typeCode: 'speed_radar',
  typeLabel: 'Radar de velocidade', status: 'operational', organizationName: 'Mobilidade', regionId: 'region-1',
  regionName: 'Sousas', regionZone: 'Leste', dataOrigin: 'demo', priorityScore: 80,
  recommendationType: 'preventive_inspection', failureCount90d: 1, recentFailureCount30d: 1,
  previousFailureCount30d: 0, lastFailureAt: null, lastMaintenanceAt: null, nextMaintenanceDate: null,
  overdueMaintenanceCount: 0, urgentMaintenanceCount: 0,
  reasons: [{ code, label: code, evidence: 'evidência sintética' }], detailPath: '/equipments/equipment-1',
});

const testRegion: RegionalRiskAssessment = {
  regionId: 'region-1', regionName: 'Sousas', zone: 'Leste', city: 'Campinas', state: 'SP', riskScore: 62,
  classification: 'elevated', evaluatedAt: '2026-10-23T12:00:00.000Z', referenceAt: '2026-10-23T12:00:00.000Z',
  windowStart: '2026-07-25T12:00:00.000Z', horizonHours: 24, historyWindowDays: 90, observationCount: 20,
  latestObservationAt: '2026-10-23T12:00:00.000Z', failureCount: 2, eligibleEquipmentCount: 3,
  unavailableEquipmentCount: 1, dataQuality: 'sufficient', coverageDays: 90, sourceScope: 'demo',
  sourceComposition: { syntheticObservations: 20, syntheticIncidents: 2, manualObservations: 0, manualIncidents: 0 },
  methodVersion: 'risk-rules-v1', factors: [], recommendations: [],
};

describe('IntelligenceComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [IntelligenceComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('renders the live API response with provenance and insufficient-data classification', async () => {
    const fixture = TestBed.createComponent(IntelligenceComponent);
    await fixture.whenStable();
    const overview = http.expectOne((request) => request.url.endsWith('/intelligence/overview'));
    const regions = http.expectOne((request) => request.url.endsWith('/intelligence/regions'));
    const validation = http.expectOne((request) => request.url.endsWith('/intelligence/validation'));
    expect(overview.request.params.get('sourceScope')).toBe('demo');
    overview.flush({
      sourceScope: 'demo', evaluatedAt: '2026-10-23T12:00:00.000Z', referenceAt: '2026-10-23T12:00:00.000Z',
      windowStart: '2026-07-25T12:00:00.000Z', horizonHours: 24, historyWindowDays: 90, methodVersion: 'risk-rules-v1',
      dataQuality: 'insufficient', sourceComposition: { syntheticObservations: 2, syntheticIncidents: 0, manualObservations: 0, manualIncidents: 0 },
      regionCount: 1, insufficientRegionCount: 1, highestRiskRegions: [], maintenancePriorities: [], trendSummary: [],
    });
    regions.flush([{
      regionId: 'region-1', regionName: 'Sousas', zone: 'Leste', city: 'Campinas', state: 'SP', riskScore: null,
      classification: 'insufficient_data', evaluatedAt: '2026-10-23T12:00:00.000Z', referenceAt: '2026-10-23T12:00:00.000Z',
      windowStart: '2026-07-25T12:00:00.000Z', horizonHours: 24, historyWindowDays: 90, observationCount: 2,
      failureCount: 0, eligibleEquipmentCount: 1, unavailableEquipmentCount: 0, dataQuality: 'insufficient', coverageDays: 70, latestObservationAt: '2026-10-23T12:00:00.000Z',
      sourceScope: 'demo', sourceComposition: { syntheticObservations: 2, syntheticIncidents: 0, manualObservations: 0, manualIncidents: 0 },
      methodVersion: 'risk-rules-v1', factors: [], recommendations: ['Ampliar a coleta histórica.'],
      locationCenter: { latitude: -22.9, longitude: -47.0, equipmentCount: 1 },
    }]);
    validation.flush({
      sourceScope: 'demo', evaluatedAt: '2026-10-23T12:00:00.000Z', methodVersion: 'risk-rules-v1', horizonHours: 24,
      evaluationStart: '2026-07-26T12:00:00.000Z', evaluationEnd: '2026-10-22T12:00:00.000Z', sampleWindows: 0,
      incidentWindows: 0, excludedInsufficientWindows: 20, incidentPrevalence: null, modelThreshold: 50,
      baselineRule: 'Uma falha anterior por região.', modelPrecision: null, modelRecall: null,
      baselinePrecision: null, baselineRecall: null,
      modelConfusion: { truePositives: 0, falsePositives: 0, trueNegatives: 0, falseNegatives: 0 },
      baselineConfusion: { truePositives: 0, falsePositives: 0, trueNegatives: 0, falseNegatives: 0 },
      modelClassificationDistribution: { low: 0, moderate: 0, elevated: 0, critical: 0 },
      modelPredictionRate: null, baselinePredictionRate: null,
      precisionAtOne: { evaluatedCutoffs: 0, truePositives: 0, precision: null, recall: null },
      evaluationQuality: 'insufficient_sample', periods: [], limitations: ['Amostra insuficiente.'],
    });
    await fixture.whenStable();
    http.expectOne((request) => request.url.endsWith('/intelligence/regions/region-1')).flush({
      risk: {
        regionId: 'region-1', regionName: 'Sousas', zone: 'Leste', city: 'Campinas', state: 'SP', riskScore: null,
        classification: 'insufficient_data', evaluatedAt: '2026-10-23T12:00:00.000Z', referenceAt: '2026-10-23T12:00:00.000Z',
        windowStart: '2026-07-25T12:00:00.000Z', horizonHours: 24, historyWindowDays: 90, observationCount: 2,
        failureCount: 0, eligibleEquipmentCount: 1, unavailableEquipmentCount: 0, dataQuality: 'insufficient', coverageDays: 70, latestObservationAt: '2026-10-23T12:00:00.000Z',
        sourceScope: 'demo', sourceComposition: { syntheticObservations: 2, syntheticIncidents: 0, manualObservations: 0, manualIncidents: 0 },
        methodVersion: 'risk-rules-v1', factors: [], recommendations: ['Ampliar a coleta histórica.'],
      }, trend: [],
    });
    await fixture.whenStable();
    const content = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(content).not.toContain('Identifique recursos e regiões que merecem atenção com base no histórico disponível.');
    expect((fixture.nativeElement as HTMLElement).querySelector('h1')).toBeNull();
    expect(content.toLocaleLowerCase('pt-BR')).toContain('não são probabilidades calibradas');
    expect(content).toContain('Sousas');
    expect(content).toContain('Dados insuficientes');
  });

  it('covers source labels, recommendation guidance, and validation comparisons', async () => {
    const api = TestBed.inject(InventoryApiService);
    vi.spyOn(api, 'getIntelligenceOverview').mockReturnValue(of(testOverview));
    vi.spyOn(api, 'getIntelligenceRegions').mockReturnValue(of([]));
    vi.spyOn(api, 'getIntelligenceValidation').mockReturnValue(of(testBacktest));
    const fixture = TestBed.createComponent(IntelligenceComponent);
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as IntelligenceHarness;

    expect(component.qualityLabel('sufficient')).toBe('Suficiente');
    expect(component.qualityLabel('limited')).toBe('Limitada');
    expect(component.scopeLabel('manual')).toBe('Registros operacionais');
    expect(component.scopeLabel('all')).toBe('Combinado, fontes separadas');
    expect(component.recommendationLabel('corrective_urgent')).toBe('Correção urgente');
    expect(component.recommendationLabel('monitor')).toBe('Monitorar');
    expect(component.recommendationAction(priorityWithReason('currently_malfunctioning'))).toContain('Priorizar');
    expect(component.recommendationAction(priorityWithReason('recurrent_failures'))).toContain('inspeção preventiva');
    expect(component.recommendationAction(priorityWithReason('immediate_priority'))).toContain('prioridade imediata');
    expect(component.recommendationAction(priorityWithReason('scheduled_maintenance'))).toContain('inspeção já cadastrada');
    expect(component.recommendationAction(priorityWithReason('maintenance_in_progress'))).toContain('em andamento');
    expect(component.recommendationAction(priorityWithReason('last_failure'))).toContain('último registro de falha');
    expect(component.recommendationAction(priorityWithReason('other'))).toContain('Monitorar a condição');

    expect(component.validationComparison({ ...testBacktest, modelPrecision: null })).toContain('Amostra insuficiente');
    expect(component.validationComparison({ ...testBacktest, modelPrecision: 0.804, baselinePrecision: 0.8 })).toContain('Precisão semelhante');
    expect(component.validationComparison(testBacktest)).toContain('Precisão maior');
    expect(component.validationComparison({ ...testBacktest, modelPrecision: 0.4, baselinePrecision: 0.8 })).toContain('Precisão abaixo');
    component.changeScope('unexpected');
    component.changeScope('manual');
  });

  it('shows safe errors when the snapshot or selected region cannot be loaded', async () => {
    const api = TestBed.inject(InventoryApiService);
    vi.spyOn(api, 'getIntelligenceOverview').mockReturnValue(throwError(() => new Error('internal overview failure')));
    vi.spyOn(api, 'getIntelligenceRegions').mockReturnValue(of([]));
    vi.spyOn(api, 'getIntelligenceValidation').mockReturnValue(of(testBacktest));
    const fixture = TestBed.createComponent(IntelligenceComponent);
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as IntelligenceHarness;
    expect(component.error()).not.toContain('internal overview failure');
  });

  it('reports a safe error when the selected region detail cannot be loaded', async () => {
    const api = TestBed.inject(InventoryApiService);
    vi.spyOn(api, 'getIntelligenceOverview').mockReturnValue(of(testOverview));
    vi.spyOn(api, 'getIntelligenceRegions').mockReturnValue(of([testRegion]));
    vi.spyOn(api, 'getIntelligenceValidation').mockReturnValue(of(testBacktest));
    vi.spyOn(api, 'getIntelligenceRegion').mockReturnValue(throwError(() => new Error('private detail failure')));
    const detailFixture = TestBed.createComponent(IntelligenceComponent);
    await detailFixture.whenStable();

    expect((detailFixture.componentInstance as unknown as IntelligenceHarness).detailError()).not.toContain('private detail failure');
  });

  it('ignores an older snapshot when a newer data scope finishes first', async () => {
    const oldOverview = new Subject<IntelligenceOverview>();
    const oldRegions = new Subject<RegionalRiskAssessment[]>();
    const oldValidation = new Subject<IntelligenceBacktest>();
    const currentOverview = new Subject<IntelligenceOverview>();
    const currentRegions = new Subject<RegionalRiskAssessment[]>();
    const currentValidation = new Subject<IntelligenceBacktest>();
    const api = TestBed.inject(InventoryApiService);
    vi.spyOn(api, 'getIntelligenceOverview').mockReturnValueOnce(oldOverview).mockReturnValueOnce(currentOverview);
    vi.spyOn(api, 'getIntelligenceRegions').mockReturnValueOnce(oldRegions).mockReturnValueOnce(currentRegions);
    vi.spyOn(api, 'getIntelligenceValidation').mockReturnValueOnce(oldValidation).mockReturnValueOnce(currentValidation);
    const fixture = TestBed.createComponent(IntelligenceComponent);
    const component = fixture.componentInstance as unknown as IntelligenceHarness;
    component.changeScope('manual');

    currentOverview.next({ ...testOverview, sourceScope: 'manual' });
    currentRegions.next([]);
    currentValidation.next({ ...testBacktest, sourceScope: 'manual' });
    currentOverview.complete();
    currentRegions.complete();
    currentValidation.complete();
    await fixture.whenStable();

    oldOverview.next(testOverview);
    oldRegions.next([]);
    oldValidation.next(testBacktest);
    oldOverview.complete();
    oldRegions.complete();
    oldValidation.complete();
    await fixture.whenStable();

    expect(component.error()).toBe('');
  });
});
