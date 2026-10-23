import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import type { IntelligenceRiskClassification, RegionIntelligenceDetail } from '@fogo/contracts';

@Component({
  selector: 'app-region-risk-detail',
  imports: [DatePipe, DecimalPipe],
  templateUrl: './region-risk-detail.component.html',
  styleUrl: './region-risk-detail.component.scss',
})
export class RegionRiskDetailComponent {
  readonly detail = input.required<RegionIntelligenceDetail>();
  readonly loading = input(false);
  readonly error = input('');

  protected readonly trendSegments = computed<string[]>(() => {
    const points = this.detail().trend;
    if (points.length < 2) return [];
    const segments: string[] = [];
    let active: string[] = [];
    points.forEach((point, index) => {
      if (point.riskScore === null) {
        if (active.length > 1) segments.push(active.join(' '));
        active = [];
      } else {
        active.push(`${4 + index / (points.length - 1) * 92},${36 - point.riskScore / 100 * 30}`);
      }
    });
    if (active.length > 1) segments.push(active.join(' '));
    return segments;
  });

  protected riskLabel(classification: IntelligenceRiskClassification): string {
    return { low: 'Baixo', moderate: 'Moderado', elevated: 'Elevado', critical: 'Crítico', insufficient_data: 'Dados insuficientes' }[classification];
  }
}
