import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { AgentContract } from '@fogo/contracts';
import { InventoryApiService, apiErrorMessage } from '../core/inventory-api.service';
import { StateBadgeComponent } from '../shared/state-badge.component';

@Component({
  selector: 'app-agent-details',
  imports: [DatePipe, DecimalPipe, RouterLink, StateBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agent-details.component.html',
  styleUrl: './agent-details.component.scss',
})
export class AgentDetailsComponent {
  private readonly api = inject(InventoryApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly agent = signal<AgentContract | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly notice = signal('');

  constructor() {
    const notice = this.router.getCurrentNavigation()?.extras.state?.['notice'];
    if (typeof notice === 'string') this.notice.set(notice);
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Identificador do agente inválido.');
      this.loading.set(false);
      return;
    }
    this.api.getAgent(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (agent) => { this.agent.set(agent); this.loading.set(false); },
      error: (error: unknown) => { this.error.set(apiErrorMessage(error)); this.loading.set(false); },
    });
  }

  protected categoryLabel(category: string): string {
    return ({
      traffic_agent: 'Agente de trânsito', municipal_guard: 'Guarda municipal', police_officer: 'Policial',
      military_police_officer: 'Policial militar', civil_police_officer: 'Policial civil', other: 'Outro',
    } as Record<string, string>)[category] ?? category;
  }
}
