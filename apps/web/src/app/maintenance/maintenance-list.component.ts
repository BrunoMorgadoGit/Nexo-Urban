import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormField, form, pattern, required, submit } from '@angular/forms/signals';
import type { EquipmentContract, MaintenanceContract, Page } from '@fogo/contracts';
import { InventoryApiService, type MaintenanceWriteInput } from '../core/inventory-api.service';
import { apiErrorMessage } from '../core/api-error-message';
import { localDateInputValue } from '../core/date-time';
import { StateBadgeComponent } from '../shared/state-badge.component';
import { ErrorFeedback } from '../shared/error-feedback/error-feedback';
import { catchError, firstValueFrom, map, of, Subject, switchMap } from 'rxjs';
import type { MaintenanceFilters } from '../core/inventory-api.service';

type MaintenanceFormModel = {
  equipmentId: string;
  kind: 'immediate' | 'scheduled' | 'periodic';
  priority: 'low' | 'normal' | 'high' | 'immediate';
  description: string;
  scheduledDate: string;
};

function emptyModel(): MaintenanceFormModel {
  return { equipmentId: '', kind: 'scheduled', priority: 'normal', description: '', scheduledDate: localDateInputValue() };
}

@Component({
  selector: 'app-maintenance-list',
  imports: [DatePipe, FormField, RouterLink, StateBadgeComponent, ErrorFeedback],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './maintenance-list.component.html',
  styleUrl: './maintenance-list.component.scss',
})
export class MaintenanceListComponent {
  private readonly api = inject(InventoryApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly loadRequests = new Subject<MaintenanceFilters>();

  protected readonly model = signal(emptyModel());
  protected readonly maintenanceForm = form(this.model, (schema) => {
    required(schema.equipmentId, { message: 'Selecione um equipamento.' });
    required(schema.kind);
    required(schema.priority);
    required(schema.description, { message: 'Informe o serviço previsto.' });
    required(schema.scheduledDate, { message: 'Informe a data prevista.' });
    pattern(schema.scheduledDate, /^\d{4}-\d{2}-\d{2}$/, { message: 'Informe uma data válida.' });
  });
  protected readonly page = signal<Page<MaintenanceContract> | null>(null);
  protected readonly equipment = signal<EquipmentContract[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly showCreateForm = signal(false);
  protected readonly overdueOnly = signal(false);
  protected readonly status = signal('');

  constructor() {
    this.loadRequests.pipe(
      switchMap((filters) => this.api.listMaintenance(filters).pipe(
        map((result) => ({ result })),
        catchError((error: unknown) => of({ error })),
      )),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((response) => {
      this.loading.set(false);
      if ('error' in response) {
        this.error.set(apiErrorMessage(response.error));
        return;
      }
      this.page.set(response.result);
    });
    this.api.listEquipment({ pageSize: 100 }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => this.equipment.set(result.items.filter((item) => !['deactivated', 'stolen'].includes(item.status))),
      error: (error: unknown) => this.error.set(apiErrorMessage(error)),
    });
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set('');
    this.loadRequests.next({
      pageSize: 50,
      overdueOnly: this.overdueOnly(),
      status: this.status(),
    });
  }

  protected openCreateForm(): void {
    this.model.set(emptyModel());
    this.error.set('');
    this.success.set('');
    this.showCreateForm.set(true);
  }

  protected closeCreateForm(): void {
    if (!this.saving()) this.showCreateForm.set(false);
  }

  protected overdueFilterChanged(event: Event): void {
    if (!(event.target instanceof HTMLSelectElement)) return;
    this.overdueOnly.set(event.target.value === 'overdue');
    this.load();
  }

  protected statusFilterChanged(event: Event): void {
    if (!(event.target instanceof HTMLSelectElement)) return;
    this.status.set(event.target.value);
    this.load();
  }

  protected save(): void {
    this.error.set('');
    void submit(this.maintenanceForm, async () => {
      const current = this.model();
      const input: MaintenanceWriteInput = {
        equipmentId: current.equipmentId,
        kind: current.kind,
        priority: current.priority,
        description: current.description.trim(),
        scheduledDate: current.scheduledDate,
      };
      this.saving.set(true);
      try {
        await firstValueFrom(this.api.createMaintenance(input));
        this.showCreateForm.set(false);
        this.success.set('Manutenção agendada com sucesso.');
        this.load();
      } catch (error: unknown) {
        this.error.set(apiErrorMessage(error));
      } finally {
        this.saving.set(false);
      }
    });
  }

  protected advance(maintenance: MaintenanceContract): void {
    const nextStatus = maintenance.status === 'scheduled' ? 'in_progress' : 'completed';
    this.api.updateMaintenanceStatus(maintenance.id, nextStatus).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.load(),
      error: (error: unknown) => this.error.set(apiErrorMessage(error)),
    });
  }
}
