import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { EquipmentContract, EquipmentTypeContract, InventorySummary, OrganizationContract, Page, RegionContract } from '@fogo/contracts';
import { InventoryApiService } from '../core/inventory-api.service';
import { apiErrorMessage } from '../core/api-error-message';
import { StateBadgeComponent } from '../shared/state-badge.component';
import { ErrorFeedback } from '../shared/error-feedback/error-feedback';
import { catchError, map, of, Subject, switchMap } from 'rxjs';
import type { EquipmentFilters } from '../core/inventory-api.service';

@Component({
  selector: 'app-equipment-list',
  imports: [DatePipe, RouterLink, StateBadgeComponent, ErrorFeedback],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './equipment-list.component.html',
  styleUrl: './equipment-list.component.scss',
})
export class EquipmentListComponent {
  private readonly api = inject(InventoryApiService);
  private readonly destroyRef = inject(DestroyRef);
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly loadRequests = new Subject<EquipmentFilters>();

  protected readonly page = signal<Page<EquipmentContract> | null>(null);
  protected readonly summary = signal<InventorySummary | null>(null);
  protected readonly types = signal<EquipmentTypeContract[]>([]);
  protected readonly organizations = signal<OrganizationContract[]>([]);
  protected readonly regions = signal<RegionContract[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly search = signal('');
  protected readonly typeCode = signal('');
  protected readonly status = signal('');
  protected readonly organizationId = signal('');
  protected readonly regionId = signal('');
  protected readonly pendingDeactivation = signal<EquipmentContract | null>(null);
  protected readonly deactivating = signal(false);

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.searchTimer));
    this.loadRequests.pipe(
      switchMap((filters) => this.api.listEquipment(filters).pipe(
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
    this.api.getEquipmentTypes().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (items) => this.types.set(items),
      error: () => this.error.set('Não foi possível carregar os tipos de equipamento.'),
    });
    this.api.getOrganizations().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (items) => this.organizations.set(items),
      error: () => this.error.set('Não foi possível carregar os órgãos responsáveis.'),
    });
    this.api.getRegions().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (items) => this.regions.set(items),
      error: () => this.error.set('Não foi possível carregar os bairros.'),
    });
    this.api.getSummary().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (value) => this.summary.set(value),
      error: () => this.error.set('Não foi possível carregar os indicadores do inventário.'),
    });
    this.load();
  }

  protected load(pageNumber = this.page()?.page ?? 1): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = undefined;
    this.loading.set(true);
    this.error.set('');
    this.loadRequests.next({
      page: pageNumber,
      pageSize: 10,
      search: this.search(),
      typeCode: this.typeCode(),
      status: this.status(),
      organizationId: this.organizationId(),
      regionId: this.regionId(),
    });
  }

  protected searchChanged(event: Event): void {
    if (!(event.target instanceof HTMLInputElement)) return;
    const value = event.target.value;
    this.search.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.searchTimer = undefined;
      this.load(1);
    }, 280);
  }

  protected filtersChanged(): void {
    this.load(1);
  }

  protected filterChanged(
    event: Event,
    field: 'typeCode' | 'status' | 'organizationId' | 'regionId',
  ): void {
    if (!(event.target instanceof HTMLSelectElement)) return;
    const filters = {
      typeCode: this.typeCode,
      status: this.status,
      organizationId: this.organizationId,
      regionId: this.regionId,
    };
    filters[field].set(event.target.value);
    this.filtersChanged();
  }

  protected changePage(delta: number): void {
    const current = this.page();
    if (!current) return;
    const nextPage = current.page + delta;
    if (nextPage < 1 || nextPage > current.totalPages) return;
    this.load(nextPage);
  }

  protected requestDeactivation(item: EquipmentContract): void {
    this.pendingDeactivation.set(item);
  }

  protected cancelDeactivation(): void {
    if (!this.deactivating()) this.pendingDeactivation.set(null);
  }

  protected deactivate(): void {
    const item = this.pendingDeactivation();
    if (!item || this.deactivating()) return;
    this.deactivating.set(true);
    this.api.deactivateEquipment(item.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.deactivating.set(false);
        this.pendingDeactivation.set(null);
        this.load();
        this.api.getSummary().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: (summary) => this.summary.set(summary),
        });
      },
      error: (error: unknown) => {
        this.error.set(apiErrorMessage(error));
        this.deactivating.set(false);
      },
    });
  }
}
