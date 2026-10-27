import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe, KeyValuePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { EquipmentContract, EquipmentTypeContract, MaintenanceContract } from '@fogo/contracts';
import { InventoryApiService } from '../core/inventory-api.service';
import { apiErrorMessage } from '../core/api-error-message';
import { StateBadgeComponent } from '../shared/state-badge.component';
import { ErrorFeedback } from '../shared/error-feedback/error-feedback';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-equipment-details',
  imports: [DatePipe, DecimalPipe, KeyValuePipe, RouterLink, StateBadgeComponent, ErrorFeedback],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './equipment-details.component.html',
  styleUrl: './equipment-details.component.scss',
})
export class EquipmentDetailsComponent {
  private readonly api = inject(InventoryApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly equipment = signal<EquipmentContract | null>(null);
  protected readonly type = signal<EquipmentTypeContract | null>(null);
  protected readonly maintenances = signal<MaintenanceContract[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly deactivating = signal(false);
  protected readonly notice = signal('');

  constructor() {
    const notice = this.router.getCurrentNavigation()?.extras.state?.['notice'];
    if (typeof notice === 'string') this.notice.set(notice);
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Identificador do equipamento inválido.');
      this.loading.set(false);
      return;
    }
    forkJoin({
      equipment: this.api.getEquipment(id),
      types: this.api.getEquipmentTypes(),
      maintenance: this.api.listMaintenance({ equipmentId: id, pageSize: 50 }),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ equipment, types, maintenance }) => {
        this.equipment.set(equipment);
        this.type.set(types.find((item) => item.code === equipment.typeCode) ?? null);
        this.maintenances.set(maintenance.items);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(apiErrorMessage(error));
        this.loading.set(false);
      },
    });
  }

  protected characteristicLabel(key: string): string {
    return this.type()?.characteristics.find((field) => field.key === key)?.label ?? key;
  }

  protected deactivate(): void {
    const equipment = this.equipment();
    if (!equipment || this.deactivating()) return;
    this.deactivating.set(true);
    this.api.deactivateEquipment(equipment.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.router.navigate(['/equipments']),
      error: (error: unknown) => {
        this.error.set(apiErrorMessage(error));
        this.deactivating.set(false);
      },
    });
  }
}
