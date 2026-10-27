import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { ErrorFeedback } from '../shared/error-feedback/error-feedback';
import type { IntelligenceRiskClassification, RegionIntelligenceDetail } from '@fogo/contracts';

type TrendChartPoint = { referenceAt: string; riskScore: number; x: number; y: number };

@Component({
  selector: 'app-region-risk-detail',
  imports: [DatePipe, DecimalPipe, ErrorFeedback],
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

  protected readonly trendPoints = computed<TrendChartPoint[]>(() => {
    const points = this.detail().trend;
    return points.flatMap((point, index) => point.riskScore === null ? [] : [{
      referenceAt: point.referenceAt,
      riskScore: point.riskScore,
      x: 4 + index / Math.max(1, points.length - 1) * 92,
      y: 36 - point.riskScore / 100 * 30,
    }]);
  });

  protected readonly trendAvailable = computed(() => this.trendPoints().length >= 2);

  protected riskLabel(classification: IntelligenceRiskClassification): string {
    return { low: 'Baixo', moderate: 'Moderado', elevated: 'Elevado', critical: 'Crítico', insufficient_data: 'Dados insuficientes' }[classification];
  }

  protected qualityLabel(quality: RegionIntelligenceDetail['risk']['dataQuality']): string {
    return { sufficient: 'Suficiente', limited: 'Limitada', insufficient: 'Insuficiente' }[quality];
  }

  protected scopeLabel(scope: RegionIntelligenceDetail['risk']['sourceScope']): string {
    return { demo: 'histórico sintético demonstrativo', manual: 'registros operacionais', all: 'fontes combinadas e identificadas' }[scope];
  }
}
