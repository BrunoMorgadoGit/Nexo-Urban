import { CommonModule, DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, input, output, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { DemoScenario, DemoTimelineEntry } from '@fogo/contracts';

@Component({
  selector: 'app-mission-control',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink],
  templateUrl: './mission-control.component.html',
  styleUrl: './mission-control.component.scss',
})
export class MissionControlComponent {
  readonly scenario = input.required<DemoScenario>();
  readonly events = input.required<DemoTimelineEntry[]>();
  readonly busy = input(false);
  readonly scenarioAction = output<void>();
  private readonly actionButton = viewChild<ElementRef<HTMLButtonElement>>('scenarioActionButton');
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private highlightTimeout: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.destroyRef.onDestroy(() => this.clearGuidedHighlight());
  }

  focusScenarioAction(action: 'outage' | 'restore'): boolean {
    if (this.busy() || (action === 'outage' && this.scenario().active) || (action === 'restore' && !this.scenario().active)) {
      return false;
    }
    const button = this.actionButton()?.nativeElement;
    if (!button) return false;

    const reduceMotion = this.document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    button.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    button.focus({ preventScroll: true });
    this.clearGuidedHighlight();
    button.classList.add('mission-action--guided-focus');
    this.highlightTimeout = setTimeout(() => {
      button.classList.remove('mission-action--guided-focus');
      this.highlightTimeout = undefined;
    }, 2600);
    return true;
  }

  protected activateScenarioAction(): void {
    this.clearGuidedHighlight();
    this.scenarioAction.emit();
  }

  protected statusLabel(status: DemoScenario['status']): string {
    return status === 'malfunctioning' ? 'Mau funcionamento'
      : status === 'operational' ? 'Operacional'
        : status === 'maintenance' ? 'Em manutenção'
          : status === 'stolen' ? 'Furtado'
            : status === 'not_installed' ? 'Ainda não instalado' : 'Desativado';
  }

  protected eventLabel(event: DemoTimelineEntry): string {
    const labels: Record<DemoTimelineEntry['eventType'], string> = {
      'equipment.updated': 'Equipamento atualizado',
      'agent.updated': 'Agente atualizado',
      'agent.deleted': 'Agente excluído',
      'maintenance.created': 'Manutenção criada',
      'maintenance.updated': 'Manutenção atualizada',
      'alert.created': 'Alerta aberto',
      'alert.updated': 'Alerta atendido',
      'alert.resolved': 'Alerta resolvido',
      'demo.scenario.changed': 'Simulação',
    };
    return labels[event.eventType];
  }

  protected timelineStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      operational: 'Operacional', malfunctioning: 'Mau funcionamento', maintenance: 'Em manutenção',
      not_installed: 'Não instalado', deactivated: 'Desativado', stolen: 'Furtado',
      open: 'Aberto', acknowledged: 'Reconhecido', resolved: 'Resolvido', recorded: 'Registrado',
    };
    return labels[status] ?? status;
  }

  private clearGuidedHighlight(): void {
    if (this.highlightTimeout === undefined) return;
    clearTimeout(this.highlightTimeout);
    this.highlightTimeout = undefined;
    this.actionButton()?.nativeElement.classList.remove('mission-action--guided-focus');
  }
}
