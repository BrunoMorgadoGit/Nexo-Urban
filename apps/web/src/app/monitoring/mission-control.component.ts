import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
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
}
