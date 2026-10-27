import { TestBed } from '@angular/core/testing';
import type { RegionalRiskAssessment } from '@fogo/contracts';
import { RegionRiskPanelComponent } from './region-risk-panel.component';

const assessment = (regionId: string, riskScore: number | null, classification: RegionalRiskAssessment['classification']): RegionalRiskAssessment => ({
  regionId,
  regionName: `Região ${regionId}`,
  zone: 'Norte',
  city: 'Campinas',
  state: 'SP',
  riskScore,
  classification,
  evaluatedAt: '2026-10-24T12:00:00.000Z',
  referenceAt: '2026-10-24T12:00:00.000Z',
  windowStart: '2026-07-26T12:00:00.000Z',
  horizonHours: 24,
  historyWindowDays: 90,
  observationCount: 10,
  latestObservationAt: '2026-10-24T12:00:00.000Z',
  failureCount: 1,
  eligibleEquipmentCount: 4,
  unavailableEquipmentCount: 1,
  dataQuality: 'limited',
  coverageDays: 60,
  sourceScope: 'demo',
  sourceComposition: { syntheticObservations: 10, syntheticIncidents: 1, manualObservations: 0, manualIncidents: 0 },
  methodVersion: 'risk-rules-v1',
  factors: [],
  recommendations: [],
});

describe('RegionRiskPanelComponent', () => {
  beforeEach(() => { TestBed.configureTestingModule({ imports: [RegionRiskPanelComponent] }); });

  it('renders the empty message when there are no assessments', async () => {
    const fixture = TestBed.createComponent(RegionRiskPanelComponent);
    fixture.componentRef.setInput('regions', []);

    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Nenhuma região cadastrada para esta origem.');
  });

  it('shows score labels and emits the selected assessment when a region is pressed', async () => {
    const regions = [
      assessment('one', 0, 'low'),
      assessment('two', 65, 'elevated'),
      assessment('three', null, 'insufficient_data'),
    ];
    const fixture = TestBed.createComponent(RegionRiskPanelComponent);
    fixture.componentRef.setInput('regions', regions);
    fixture.componentRef.setInput('selectedRegionId', 'two');
    const selected = vi.fn();
    fixture.componentInstance.regionSelected.subscribe(selected);

    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    const rows = [...root.querySelectorAll<HTMLButtonElement>('.region-row')];
    expect(rows).toHaveLength(3);
    expect(rows[1].getAttribute('aria-pressed')).toBe('true');
    expect(rows[1].querySelector('.risk-track__fill')?.getAttribute('style')).toContain('65%');
    expect(rows[2].getAttribute('aria-label')).toContain('dados insuficientes');

    rows[0].click();
    await fixture.whenStable();

    expect(selected).toHaveBeenCalledWith(regions[0]);
  });
});
