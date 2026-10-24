import { DatePipe, PercentPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import type {
  IntelligenceBacktest,
  IntelligenceOverview,
  IntelligenceSourceScope,
  PredictiveMaintenancePriority,
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

  protected recommendationAction(item: PredictiveMaintenancePriority): string {
    const reasons = new Set(item.reasons.map((reason) => reason.code));
    if (reasons.has('currently_malfunctioning') || reasons.has('severe_failure')
      || reasons.has('urgent_maintenance') || reasons.has('overdue_maintenance')) {
      return 'Priorizar avaliação técnica e verificar a manutenção vencida ou urgente registrada.';
    }
    if (reasons.has('deteriorating_trend') || reasons.has('recurrent_failures')) {
      return 'Programar inspeção preventiva para investigar a recorrência ou o aumento recente de falhas.';
    }
    if (reasons.has('immediate_priority')) {
      return 'Verificar a prioridade imediata registrada no cadastro e confirmar se há manutenção ativa.';
    }
    if (reasons.has('scheduled_maintenance')) {
      return 'Confirmar a inspeção já cadastrada e acompanhar sua execução.';
    }
    if (reasons.has('maintenance_in_progress')) {
      return 'Acompanhar a manutenção em andamento antes de alterar a situação do equipamento.';
    }
    if (reasons.has('last_failure')) {
      return 'Revisar o último registro de falha e programar acompanhamento preventivo.';
    }
    return 'Monitorar a condição e revisar a prioridade quando houver novos registros.';
  }

  protected validationComparison(validation: IntelligenceBacktest): string {
    if (validation.modelPrecision === null || validation.baselinePrecision === null) {
      return 'Amostra insuficiente para comparar a precisão com a referência.';
    }
    const difference = validation.modelPrecision - validation.baselinePrecision;
    if (Math.abs(difference) < 0.01) return 'Precisão semelhante à regra de referência nesta amostra.';
    return difference > 0
      ? 'Precisão maior que a referência nesta amostra; isso não comprova desempenho em operação real.'
      : 'Precisão abaixo da referência nesta amostra; considere esse limite ao interpretar a prioridade.';
  }
}
