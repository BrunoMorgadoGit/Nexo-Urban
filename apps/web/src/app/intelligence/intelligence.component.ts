import { DatePipe, PercentPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import type {
  IntelligenceBacktest,
  IntelligenceOverview,
  IntelligenceSourceScope,
  RegionIntelligenceDetail,
  RegionalRiskAssessment,
} from '@fogo/contracts';
import { apiErrorMessage, InventoryApiService } from '../core/inventory-api.service';
import { RegionRiskDetailComponent } from './region-risk-detail.component';
import { RegionRiskPanelComponent } from './region-risk-panel.component';

type IntelligenceSnapshot = {
  overview: IntelligenceOverview;
  regions: RegionalRiskAssessment[];
  validation: IntelligenceBacktest;
};

@Component({
  selector: 'app-intelligence',
  imports: [DatePipe, PercentPipe, RouterLink, RegionRiskPanelComponent, RegionRiskDetailComponent],
  templateUrl: './intelligence.component.html',
  styleUrl: './intelligence.component.scss',
})
export class IntelligenceComponent {
  private readonly api = inject(InventoryApiService);
  protected readonly snapshot = signal<IntelligenceSnapshot | null>(null);
  protected readonly selectedDetail = signal<RegionIntelligenceDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadingDetail = signal(false);
  protected readonly error = signal('');
  protected readonly detailError = signal('');
  protected readonly sourceScope = signal<IntelligenceSourceScope>('demo');
  protected readonly selectedRegionId = signal('');
  private snapshotRequestId = 0;
  private detailRequestId = 0;

  constructor() { this.reload(); }

  protected reload(): void {
    const requestId = ++this.snapshotRequestId;
    this.loading.set(true);
    this.error.set('');
    const scope = this.sourceScope();
    forkJoin({
      overview: this.api.getIntelligenceOverview(scope),
      regions: this.api.getIntelligenceRegions(scope),
      validation: this.api.getIntelligenceValidation(scope),
    }).subscribe({
      next: (data) => {
        if (requestId !== this.snapshotRequestId) return;
        this.snapshot.set(data);
        this.loading.set(false);
        const selected = data.regions.find((region) => region.regionId === this.selectedRegionId()) ?? data.regions[0];
        if (selected) this.selectRegion(selected);
      },
      error: (error: unknown) => {
        if (requestId !== this.snapshotRequestId) return;
        this.error.set(apiErrorMessage(error));
        this.loading.set(false);
      },
    });
  }

  protected changeScope(value: string): void {
    if (!['demo', 'manual', 'all'].includes(value)) return;
    this.sourceScope.set(value as IntelligenceSourceScope);
    this.selectedRegionId.set('');
    this.selectedDetail.set(null);
    this.reload();
  }

  protected selectRegion(region: RegionalRiskAssessment): void {
    const requestId = ++this.detailRequestId;
    this.selectedRegionId.set(region.regionId);
    this.selectedDetail.set(null);
    this.loadingDetail.set(true);
    this.detailError.set('');
    this.api.getIntelligenceRegion(region.regionId, this.sourceScope()).subscribe({
      next: (detail) => {
        if (requestId !== this.detailRequestId) return;
        this.selectedDetail.set(detail);
        this.loadingDetail.set(false);
      },
      error: (error: unknown) => {
        if (requestId !== this.detailRequestId) return;
        this.detailError.set(apiErrorMessage(error));
        this.loadingDetail.set(false);
      },
    });
  }

  protected qualityLabel(quality: 'sufficient' | 'limited' | 'insufficient'): string {
    return { sufficient: 'Suficiente', limited: 'Limitada', insufficient: 'Insuficiente' }[quality];
  }

  protected scopeLabel(scope: IntelligenceSourceScope): string {
    return { demo: 'Sintético demonstrativo', manual: 'Registros operacionais', all: 'Combinado, fontes separadas' }[scope];
  }

  protected recommendationLabel(type: 'corrective_urgent' | 'preventive_inspection' | 'monitor'): string {
    return {
      corrective_urgent: 'Correção urgente',
      preventive_inspection: 'Inspeção preventiva',
      monitor: 'Monitorar',
    }[type];
  }
}
