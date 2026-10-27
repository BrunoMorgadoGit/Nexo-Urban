import { TestBed } from '@angular/core/testing';
import type { RegionIntelligenceDetail } from '@fogo/contracts';
import { RegionRiskDetailComponent } from './region-risk-detail.component';

const detail: RegionIntelligenceDetail = {
  risk: {
    regionId: 'region-1', regionName: 'Sousas', zone: 'Leste', city: 'Campinas', state: 'SP',
    riskScore: 72, classification: 'elevated', evaluatedAt: '2026-10-24T12:00:00.000Z',
    referenceAt: '2026-10-24T12:00:00.000Z', windowStart: '2026-07-26T12:00:00.000Z',
    horizonHours: 24, historyWindowDays: 90, observationCount: 12, latestObservationAt: '2026-10-24T12:00:00.000Z',
    failureCount: 3, eligibleEquipmentCount: 5, unavailableEquipmentCount: 1, dataQuality: 'sufficient',
    coverageDays: 80, sourceScope: 'all',
    sourceComposition: { syntheticObservations: 10, syntheticIncidents: 2, manualObservations: 0, manualIncidents: 1 },
    methodVersion: 'risk-rules-v1', factors: [{ code: 'recent_failures', label: 'Falhas recentes', observedValue: 2, normalizedValue: 60, weight: 0.4, contribution: 24, explanation: 'Duas falhas recentes.' }],
    recommendations: ['Programar uma inspeção.'],
  },
  trend: [
    { regionId: 'region-1', regionName: 'Sousas', referenceAt: '2026-10-01T12:00:00.000Z', riskScore: 45, classification: 'moderate', failuresInWindow: 1, failureRatePerTenEquipment: 2 },
    { regionId: 'region-1', regionName: 'Sousas', referenceAt: '2026-10-08T12:00:00.000Z', riskScore: null, classification: 'insufficient_data', failuresInWindow: 0, failureRatePerTenEquipment: 0 },
    { regionId: 'region-1', regionName: 'Sousas', referenceAt: '2026-10-15T12:00:00.000Z', riskScore: 72, classification: 'elevated', failuresInWindow: 2, failureRatePerTenEquipment: 4 },
  ],
};

describe('RegionRiskDetailComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [RegionRiskDetailComponent] }));

  it('renders provenance, a gap-aware trend, factors and recommendations', async () => {
    const fixture = TestBed.createComponent(RegionRiskDetailComponent);
    fixture.componentRef.setInput('detail', detail);

    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Sousas');
    expect(root.textContent).toContain('fontes combinadas e identificadas');
    expect(root.querySelectorAll('.trend-line')).toHaveLength(0);
    expect(root.querySelectorAll('.trend-point')).toHaveLength(2);
    expect(root.textContent).toContain('Falhas recentes');
    expect(root.textContent).toContain('Programar uma inspeção.');
  });

  it('shows the empty trend state when fewer than two scores can be plotted', async () => {
    const fixture = TestBed.createComponent(RegionRiskDetailComponent);
    fixture.componentRef.setInput('detail', { ...detail, trend: [detail.trend[1]] });
    fixture.componentRef.setInput('loading', true);
    fixture.componentRef.setInput('error', 'Falha ao atualizar.');

    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('O histórico ainda não contém dois pontos calculáveis');
    expect(root.textContent).toContain('Atualizando detalhe…');
    expect(root.textContent).toContain('Falha ao atualizar.');
  });
});
