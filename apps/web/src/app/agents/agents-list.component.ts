import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { AgentContract, InventorySummary, OrganizationContract, Page } from '@fogo/contracts';
import { InventoryApiService, apiErrorMessage, type AgentFilters } from '../core/inventory-api.service';
import { StateBadgeComponent } from '../shared/state-badge.component';
import { catchError, map, of, Subject, switchMap } from 'rxjs';

@Component({
  selector: 'app-agents-list',
  imports: [DatePipe, DecimalPipe, RouterLink, StateBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agents-list.component.html',
  styleUrl: './agents-list.component.scss',
})
export class AgentsListComponent {
  private readonly api = inject(InventoryApiService);
  private readonly destroyRef = inject(DestroyRef);
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly loadRequests = new Subject<AgentFilters>();

  protected readonly page = signal<Page<AgentContract> | null>(null);
  protected readonly summary = signal<InventorySummary | null>(null);
  protected readonly organizations = signal<OrganizationContract[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly search = signal('');
  protected readonly category = signal('');
  protected readonly availability = signal('');
  protected readonly organizationId = signal('');

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.searchTimer));
    this.loadRequests.pipe(
      switchMap((filters) => this.api.listAgents(filters).pipe(
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
    this.api.getOrganizations().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (items) => this.organizations.set(items),
      error: (error: unknown) => this.error.set(apiErrorMessage(error)),
    });
    this.api.getSummary().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (value) => this.summary.set(value),
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
      category: this.category(),
      availability: this.availability(),
      organizationId: this.organizationId(),
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

  protected filtersChanged(): void { this.load(1); }

  protected filterChanged(
    event: Event,
    field: 'category' | 'availability' | 'organizationId',
  ): void {
    if (!(event.target instanceof HTMLSelectElement)) return;
    const filters = {
      category: this.category,
      availability: this.availability,
      organizationId: this.organizationId,
    };
    filters[field].set(event.target.value);
    this.filtersChanged();
  }

  protected changePage(delta: number): void {
    const current = this.page();
    if (!current) return;
    const next = current.page + delta;
    if (next >= 1 && next <= current.totalPages) this.load(next);
  }

  protected categoryLabel(category: string): string {
    return ({ traffic_agent: 'Agente de trânsito', municipal_guard: 'Guarda municipal', police_officer: 'Policial' } as Record<string, string>)[category] ?? category;
  }
}
