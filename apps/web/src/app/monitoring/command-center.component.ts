import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import type { DemoScenario, DemoTimelineEntry, MaintenanceAttention, MonitoringAlert, MonitoringOverview, MonitoringRegionSummary, Page } from '@fogo/contracts';
import { catchError, forkJoin, map, of, switchMap, type Observable } from 'rxjs';
import { InventoryApiService } from '../core/inventory-api.service';
import { apiErrorMessage } from '../core/api-error-message';
import { MonitoringRealtimeService } from '../core/monitoring-realtime.service';
import { ErrorFeedback } from '../shared/error-feedback/error-feedback';
import { MissionControlComponent } from './mission-control.component';
import { OperationalMapComponent } from './operational-map.component';
import { equipmentDistribution } from './equipment-distribution';
import { demoGuideStepState, type DemoGuideStep } from './demo-guide-progress';

type CommandSnapshot = {
  overview: MonitoringOverview;
  alerts: Page<MonitoringAlert>;
  regions: MonitoringRegionSummary[];
  maintenance: MaintenanceAttention[];
  demoScenario: DemoScenario | null;
  demoTimeline: DemoTimelineEntry[];
  demoAlert: MonitoringAlert | null;
};

@Component({
  selector: 'app-command-center',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, MissionControlComponent, OperationalMapComponent, ErrorFeedback],
  templateUrl: './command-center.component.html',
})
export class CommandCenterComponent {
  protected readonly snapshot = signal<CommandSnapshot | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly busyScenario = signal(false);
  protected readonly guideFeedback = signal('');
  protected readonly distribution = computed(() => {
    const overview = this.snapshot()?.overview;
    return overview ? equipmentDistribution(overview) : [];
  });
  private readonly api = inject(InventoryApiService);
  private readonly router = inject(Router);
  private readonly missionControl = viewChild(MissionControlComponent);
  protected readonly realtime = inject(MonitoringRealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.realtime.acquire(this.destroyRef);
    toObservable(this.realtime.refreshVersion).pipe(
      switchMap(() => forkJoin({
        overview: this.api.getMonitoringOverview(),
        alerts: this.api.listMonitoringAlerts({ page: 1, pageSize: 5, status: 'active' }),
        regions: this.api.getMonitoringRegions(),
        maintenance: this.api.getMaintenanceAttention(),
      }).pipe(switchMap((base): Observable<CommandSnapshot> => base.overview.demoMode
        ? forkJoin({
          demoScenario: this.api.getDemoScenario(),
          demoTimeline: this.api.getDemoTimeline(),
        }).pipe(switchMap((mission) => this.api.listMonitoringAlerts({
          page: 1,
          pageSize: 1,
          code: 'equipment_malfunctioning',
          resourceId: mission.demoScenario.equipmentId,
        }).pipe(map((demoAlerts) => ({
          ...base,
          ...mission,
          demoAlert: demoAlerts.items[0] ?? null,
        })))))
        : of({ ...base, demoScenario: null, demoTimeline: [], demoAlert: null })), catchError((failure: unknown) => {
          this.error.set(apiErrorMessage(failure));
          return of(null);
        }))),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((result) => {
      this.loading.set(false);
      if (!result) return;
      this.snapshot.set(result);
      this.error.set('');
    });
  }

  protected statusLabel(status: MonitoringAlert['status']): string {
    return status === 'open' ? 'Aberto' : status === 'acknowledged' ? 'Reconhecido' : 'Resolvido';
  }

  protected severityLabel(severity: MonitoringAlert['severity']): string {
    return severity === 'critical' ? 'Crítico' : severity === 'high' ? 'Alto' : severity === 'medium' ? 'Médio' : 'Baixo';
  }

  protected urgencyLabel(urgency: MaintenanceAttention['urgency']): string {
    return urgency === 'overdue' ? 'Vencida' : urgency === 'immediate' ? 'Imediata' : 'Próxima';
  }

  protected reload(): void {
    this.loading.set(true);
    this.realtime.refreshVersion.update((version) => version + 1);
  }

  protected stepState(step: DemoGuideStep): ReturnType<typeof demoGuideStepState> | 'waiting' {
    const snapshot = this.snapshot();
    if (!snapshot?.demoScenario) return 'waiting';
    return demoGuideStepState(step, snapshot.demoScenario, snapshot.demoAlert, snapshot.demoTimeline);
  }

  protected stepStateLabel(step: DemoGuideStep): string {
    const state = this.stepState(step);
    return state === 'completed' ? 'Concluída'
      : state === 'current' ? 'Etapa atual'
        : state === 'ready' ? 'Equipamento cadastrado' : 'Aguardando etapa anterior';
  }

  protected guideToMissionAction(action: 'outage' | 'restore'): void {
    const scenario = this.snapshot()?.demoScenario;
    if (!scenario) {
      this.guideFeedback.set('O Mission Control ainda não está disponível.');
      return;
    }
    if (this.busyScenario()) {
      this.guideFeedback.set('Aguarde a atualização do cenário antes de escolher outra etapa.');
      return;
    }
    const alreadyInRequestedState = action === 'outage' ? scenario.active : !scenario.active;
    if (alreadyInRequestedState) {
      this.guideFeedback.set(action === 'outage'
        ? 'A falha já está ativa. Consulte a ocorrência e o histórico nas próximas etapas.'
        : 'Não há uma falha ativa para restaurar.');
      return;
    }
    if (this.missionControl()?.focusScenarioAction(action)) {
      this.guideFeedback.set(action === 'outage'
        ? 'Controle “Simular mau funcionamento” destacado. A falha só será executada pelo botão do Mission Control.'
        : 'Controle “Restaurar equipamento” destacado. Confirme a restauração pelo botão do Mission Control.');
      return;
    }
    this.guideFeedback.set('Não foi possível localizar o controle do Mission Control.');
  }

  protected openDemoAlert(step: 3 | 4): void {
    const snapshot = this.snapshot();
    const scenario = snapshot?.demoScenario;
    const alert = snapshot?.demoAlert;
    if (!scenario || !alert) {
      this.guideFeedback.set('Nenhuma ocorrência do equipamento demonstrativo foi localizada. Simule uma falha primeiro.');
      return;
    }
    if (step === 4 && !scenario.active) {
      this.guideFeedback.set('Simule uma falha no Mission Control antes de reconhecer ou anotar uma ocorrência.');
      return;
    }
    if (step === 4 && alert.status === 'resolved') {
      this.guideFeedback.set('Esta ocorrência já foi resolvida. Consulte o histórico antes de iniciar outra simulação.');
      return;
    }
    this.guideFeedback.set('Ocorrência do equipamento demonstrativo aberta com detalhes e histórico.');
    void this.router.navigate(['/alerts'], { queryParams: { alert: alert.id } });
  }

  protected toggleMissionControl(): void {
    if (this.busyScenario()) return;
    const scenario = this.snapshot()?.demoScenario;
    if (!scenario) return;
    this.guideFeedback.set('');
    this.busyScenario.set(true);
    const operation = scenario.active ? this.api.resetDemoScenario() : this.api.triggerDemoOutage();
    operation.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busyScenario.set(false);
        this.reload();
      },
      error: (failure: unknown) => {
        this.busyScenario.set(false);
        this.error.set(apiErrorMessage(failure));
      },
    });
  }

}
