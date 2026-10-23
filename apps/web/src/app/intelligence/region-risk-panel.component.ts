import { Component, computed, input, output } from '@angular/core';
import type { IntelligenceRiskClassification, RegionalRiskAssessment } from '@fogo/contracts';

type PlotPoint = { region: RegionalRiskAssessment; left: number; top: number };

@Component({
  selector: 'app-region-risk-panel',
  templateUrl: './region-risk-panel.component.html',
  styleUrl: './region-risk-panel.component.scss',
})
export class RegionRiskPanelComponent {
  readonly regions = input.required<RegionalRiskAssessment[]>();
  readonly selectedRegionId = input('');
  readonly regionSelected = output<RegionalRiskAssessment>();

  protected readonly plotPoints = computed<PlotPoint[]>(() => {
    const located = this.regions().filter((region) => region.locationCenter);
    if (!located.length) return [];
    const latitudes = located.map((region) => region.locationCenter!.latitude);
    const longitudes = located.map((region) => region.locationCenter!.longitude);
    const minLatitude = Math.min(...latitudes);
    const maxLatitude = Math.max(...latitudes);
    const minLongitude = Math.min(...longitudes);
    const maxLongitude = Math.max(...longitudes);
    return located.map((region) => ({
      region,
      left: maxLongitude === minLongitude ? 50 : 10 + (region.locationCenter!.longitude - minLongitude) / (maxLongitude - minLongitude) * 80,
      top: maxLatitude === minLatitude ? 50 : 90 - (region.locationCenter!.latitude - minLatitude) / (maxLatitude - minLatitude) * 80,
    }));
  });

  protected riskLabel(classification: IntelligenceRiskClassification): string {
    return { low: 'Baixo', moderate: 'Moderado', elevated: 'Elevado', critical: 'Crítico', insufficient_data: 'Dados insuficientes' }[classification];
  }
}
