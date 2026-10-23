import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const labels: Record<string, string> = {
  not_installed: 'Não instalado',
  operational: 'Operacional',
  malfunctioning: 'Mau funcionamento',
  maintenance: 'Em manutenção',
  deactivated: 'Desativado',
  stolen: 'Furtado',
  available: 'Disponível',
  on_duty: 'Em serviço',
  unavailable: 'Indisponível',
  off_duty: 'Fora de serviço',
  scheduled: 'Agendada',
  in_progress: 'Em andamento',
  completed: 'Concluída',
  cancelled: 'Cancelada',
  low: 'Baixa',
  normal: 'Normal',
  high: 'Alta',
  immediate: 'Imediata',
};

const positiveStates = new Set(['operational', 'available', 'completed']);
const warningStates = new Set(['not_installed', 'maintenance', 'on_duty', 'scheduled', 'high']);
const dangerStates = new Set(['malfunctioning', 'deactivated', 'stolen', 'unavailable', 'cancelled', 'immediate']);

@Component({
  selector: 'app-state-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="state-badge"
      [class.state-badge--positive]="tone() === 'positive'"
      [class.state-badge--warning]="tone() === 'warning'"
      [class.state-badge--danger]="tone() === 'danger'"
      [class.state-badge--neutral]="tone() === 'neutral'"
    >
      <span class="state-badge__dot" aria-hidden="true"></span>
      {{ label() }}
    </span>
  `,
  styles: `
    :host { display: inline-flex; max-width: 100%; }
    .state-badge {
      display: inline-flex;
      max-width: 100%;
      align-items: center;
      gap: .4rem;
      padding: .25rem .55rem;
      border: 1px solid transparent;
      border-radius: 999px;
      font-size: .75rem;
      line-height: 1.25rem;
      white-space: nowrap;
    }
    .state-badge__dot { width: .375rem; height: .375rem; flex: 0 0 auto; border-radius: 50%; background: currentColor; }
    .state-badge--positive { border-color: rgb(86 196 142 / 24%); background: rgb(86 196 142 / 9%); color: var(--color-status-success); }
    .state-badge--warning { border-color: rgb(227 174 88 / 24%); background: rgb(227 174 88 / 9%); color: var(--color-status-warning); }
    .state-badge--danger { border-color: rgb(240 120 120 / 24%); background: rgb(240 120 120 / 9%); color: var(--color-status-danger); }
    .state-badge--neutral { border-color: var(--color-border); background: var(--color-surface-raised); color: var(--color-text-secondary); }
  `,
})
export class StateBadgeComponent {
  readonly status = input.required<string>();
  protected readonly label = computed(() => labels[this.status()] ?? this.status());
  protected readonly tone = computed(() => {
    const status = this.status();
    if (positiveStates.has(status)) return 'positive';
    if (warningStates.has(status)) return 'warning';
    if (dangerStates.has(status)) return 'danger';
    return 'neutral';
  });
}
