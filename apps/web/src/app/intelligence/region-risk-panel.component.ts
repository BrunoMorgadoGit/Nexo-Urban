import { Component, input, output } from '@angular/core';
import type { IntelligenceRiskClassification, RegionalRiskAssessment } from '@fogo/contracts';

@Component({
  selector: 'app-region-risk-panel',
  templateUrl: './region-risk-panel.component.html',
  styleUrl: './region-risk-panel.component.scss',
})
export class RegionRiskPanelComponent {
  readonly regions = input.required<RegionalRiskAssessment[]>();
  readonly selectedRegionId = input('');
  readonly regionSelected = output<RegionalRiskAssessment>();

  protected riskLabel(classification: IntelligenceRiskClassification): string {
    return { low: 'Baixo', moderate: 'Moderado', elevated: 'Elevado', critical: 'Crítico', insufficient_data: 'Dados insuficientes' }[classification];
  }

  protected scoreWidth(score: number | null): string {
    return `${Math.max(0, Math.min(100, score ?? 0))}%`;
  }
}
