import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import type { MonitoringAlert, MonitoringAlertSeverity, Page } from '@fogo/contracts';
import { apiErrorMessage, InventoryApiService } from '../core/inventory-api.service';
import { MonitoringRealtimeService } from '../core/monitoring-realtime.service';

@Component({
  selector: 'app-alerts',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './alerts.component.html',
  styleUrl: './alerts.component.scss',
})
export class AlertsComponent {
  protected readonly page = signal<Page<MonitoringAlert> | null>(null);
  protected readonly focusedAlert = signal<MonitoringAlert | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly severity = signal<MonitoringAlertSeverity | ''>('');
  protected readonly status = signal('active');
  protected readonly currentPage = signal(1);
  protected readonly notes = signal<Record<string, string>>({});
  protected readonly busyAlertId = signal<string | null>(null);
  protected readonly selectedAlertId = signal('');
  protected readonly displayItems = computed(() => {
    const items = this.page()?.items ?? [];
    const focused = this.focusedAlert();
    if (!focused) return items;
    if (!items.some((item) => item.id === focused.id)) return [focused, ...items];
    return items.map((item) => item.id === focused.id ? focused : item);
  });
  private readonly api = inject(InventoryApiService);
  private readonly route = inject(ActivatedRoute);
  protected readonly realtime = inject(MonitoringRealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.realtime.acquire(this.destroyRef);
    toObservable(this.realtime.refreshVersion).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('alert') ?? '';
      this.selectedAlertId.set(id);
      this.focusedAlert.set(null);
      this.load();
    });
  }

  protected setSeverity(value: MonitoringAlertSeverity | ''): void { this.severity.set(value); this.currentPage.set(1); this.load(); }
  protected setStatus(value: string): void { this.status.set(value); this.currentPage.set(1); this.load(); }
  protected setNote(id: string, note: string): void { this.notes.update((current) => ({ ...current, [id]: note })); }
  protected toggleDetails(id: string): void {
    const nextId = this.selectedAlertId() === id ? '' : id;
    this.selectedAlertId.set(nextId);
    if (this.focusedAlert()?.id !== nextId) this.focusedAlert.set(null);
  }
  protected isExpanded(id: string): boolean { return this.selectedAlertId() === id; }
  protected prev(): void { if (this.currentPage() > 1) { this.currentPage.update((page) => page - 1); this.load(); } }
  protected next(): void { if (this.page() && this.currentPage() < this.page()!.totalPages) { this.currentPage.update((page) => page + 1); this.load(); } }

  protected actionLabel(type: string): string {
    return ({ created: 'Ocorrência aberta', acknowledged: 'Reconhecida', note: 'Observação', resolved: 'Encerrada' } as Record<string, string>)[type] ?? type;
  }

  protected severityLabel(value: MonitoringAlertSeverity): string {
    return value === 'critical' ? 'Crítico' : value === 'high' ? 'Alto' : value === 'medium' ? 'Médio' : 'Baixo';
  }

  protected statusLabel(value: MonitoringAlert['status']): string {
    return value === 'open' ? 'Aberto' : value === 'acknowledged' ? 'Reconhecido' : 'Resolvido';
  }

  protected acknowledge(id: string): void { this.runAction(id, () => this.api.acknowledgeAlert(id)); }
  protected resolve(id: string): void { this.runAction(id, () => this.api.resolveAlert(id)); }

  protected addNote(alert: MonitoringAlert): void {
    const note = this.notes()[alert.id]?.trim() ?? '';
    if (note.length < 2 || note.length > 500) {
      this.error.set('A observação deve conter entre 2 e 500 caracteres.');
      return;
    }
    this.runAction(alert.id, () => this.api.addAlertNote(alert.id, note), () => {
      this.notes.update((current) => ({ ...current, [alert.id]: '' }));
    });
  }

  protected reload(): void { this.load(); }

  private runAction(id: string, request: () => ReturnType<InventoryApiService['acknowledgeAlert']>, success?: () => void): void {
    this.busyAlertId.set(id);
    request().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (alert) => {
        if (this.selectedAlertId() === id) this.focusedAlert.set(alert);
        success?.();
        this.busyAlertId.set(null);
        this.error.set('');
        this.load();
      },
      error: (failure: unknown) => {
        this.busyAlertId.set(null);
        this.error.set(apiErrorMessage(failure));
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    const selectedId = this.selectedAlertId();
    if (selectedId) {
      this.api.getMonitoringAlert(selectedId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (alert) => { if (this.selectedAlertId() === selectedId) this.focusedAlert.set(alert); },
        error: (failure: unknown) => { if (this.selectedAlertId() === selectedId) this.error.set(apiErrorMessage(failure)); },
      });
    }
    this.api.listMonitoringAlerts({
      page: this.currentPage(),
      pageSize: 10,
      ...(this.severity() ? { severity: this.severity() as MonitoringAlertSeverity } : {}),
      status: this.status(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => { this.page.set(result); this.loading.set(false); },
      error: (failure: unknown) => { this.error.set(apiErrorMessage(failure)); this.loading.set(false); },
    });
  }
}
