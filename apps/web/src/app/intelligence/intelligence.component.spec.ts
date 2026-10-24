import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { IntelligenceComponent } from './intelligence.component';

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
    fixture.detectChanges();
    const overview = http.expectOne((request) => request.url.endsWith('/intelligence/overview'));
    const regions = http.expectOne((request) => request.url.endsWith('/intelligence/regions'));
    const validation = http.expectOne((request) => request.url.endsWith('/intelligence/validation'));
    expect(overview.request.params.get('sourceScope')).toBe('demo');
    overview.flush({
      sourceScope: 'demo', evaluatedAt: '2026-10-23T12:00:00.000Z', referenceAt: '2026-10-23T12:00:00.000Z',
      windowStart: '2026-07-25T12:00:00.000Z', horizonHours: 24, historyWindowDays: 90, methodVersion: 'risk-rules-v1',
      dataQuality: 'insufficient', sourceComposition: { syntheticObservations: 2, syntheticIncidents: 0, manualIncidents: 0 },
      regionCount: 1, insufficientRegionCount: 1, highestRiskRegions: [], maintenancePriorities: [], trendSummary: [],
    });
    regions.flush([{
      regionId: 'region-1', regionName: 'Sousas', zone: 'Leste', city: 'Campinas', state: 'SP', riskScore: null,
      classification: 'insufficient_data', evaluatedAt: '2026-10-23T12:00:00.000Z', referenceAt: '2026-10-23T12:00:00.000Z',
      windowStart: '2026-07-25T12:00:00.000Z', horizonHours: 24, historyWindowDays: 90, observationCount: 2,
      failureCount: 0, eligibleEquipmentCount: 1, unavailableEquipmentCount: 0, dataQuality: 'insufficient', coverageDays: 70, latestObservationAt: '2026-10-23T12:00:00.000Z',
      sourceScope: 'demo', sourceComposition: { syntheticObservations: 2, syntheticIncidents: 0, manualIncidents: 0 },
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
    fixture.detectChanges();
    http.expectOne((request) => request.url.endsWith('/intelligence/regions/region-1')).flush({
      risk: {
        regionId: 'region-1', regionName: 'Sousas', zone: 'Leste', city: 'Campinas', state: 'SP', riskScore: null,
        classification: 'insufficient_data', evaluatedAt: '2026-10-23T12:00:00.000Z', referenceAt: '2026-10-23T12:00:00.000Z',
        windowStart: '2026-07-25T12:00:00.000Z', horizonHours: 24, historyWindowDays: 90, observationCount: 2,
        failureCount: 0, eligibleEquipmentCount: 1, unavailableEquipmentCount: 0, dataQuality: 'insufficient', coverageDays: 70, latestObservationAt: '2026-10-23T12:00:00.000Z',
        sourceScope: 'demo', sourceComposition: { syntheticObservations: 2, syntheticIncidents: 0, manualIncidents: 0 },
        methodVersion: 'risk-rules-v1', factors: [], recommendations: ['Ampliar a coleta histórica.'],
      }, trend: [],
    });
    await fixture.whenStable();
    fixture.detectChanges();
    const content = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(content).not.toContain('Identifique recursos e regiões que merecem atenção com base no histórico disponível.');
    expect((fixture.nativeElement as HTMLElement).querySelector('h1')).toBeNull();
    expect(content.toLocaleLowerCase('pt-BR')).toContain('não são probabilidades calibradas');
    expect(content).toContain('Sousas');
    expect(content).toContain('Dados insuficientes');
  });
});
