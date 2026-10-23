import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import type { DemoScenario, DemoTimelineEntry, MaintenanceAttention, MonitoringAlert, MonitoringOverview, MonitoringRegionSummary, Page } from '@fogo/contracts';
import { catchError, forkJoin, map, of, switchMap, type Observable } from 'rxjs';
import { apiErrorMessage, InventoryApiService } from '../core/inventory-api.service';
import { MonitoringRealtimeService } from '../core/monitoring-realtime.service';
import { MissionControlComponent } from './mission-control.component';
import { OperationalMapComponent } from './operational-map.component';

type CommandSnapshot = {
  overview: MonitoringOverview;
  alerts: Page<MonitoringAlert>;
  regions: MonitoringRegionSummary[];
  maintenance: MaintenanceAttention[];
  demoScenario: DemoScenario | null;
  demoTimeline: DemoTimelineEntry[];
};

@Component({
  selector: 'app-command-center',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, MissionControlComponent, OperationalMapComponent],
  templateUrl: './command-center.component.html',
  styleUrl: './command-center.component.scss',
})
export class CommandCenterComponent {
  protected readonly snapshot = signal<CommandSnapshot | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly busyAlertId = signal<string | null>(null);
  protected readonly busyScenario = signal(false);
  private readonly api = inject(InventoryApiService);
  private readonly realtime = inject(MonitoringRealtimeService);
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
        }).pipe(map((mission) => ({ ...base, ...mission })))
        : of({ ...base, demoScenario: null, demoTimeline: [] })), catchError((failure: unknown) => {
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

  protected acknowledge(alertId: string): void {
    this.busyAlertId.set(alertId);
    this.api.acknowledgeAlert(alertId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.busyAlertId.set(null),
      error: (failure: unknown) => {
        this.busyAlertId.set(null);
        this.error.set(apiErrorMessage(failure));
      },
    });
  }

  protected reload(): void {
    this.loading.set(true);
    this.realtime.refreshVersion.update((version) => version + 1);
  }

  protected toggleMissionControl(): void {
    if (this.busyScenario()) return;
    const scenario = this.snapshot()?.demoScenario;
    if (!scenario) return;
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
