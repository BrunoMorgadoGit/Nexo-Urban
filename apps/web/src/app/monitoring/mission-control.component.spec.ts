import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { DemoScenario, DemoTimelineEntry } from '@fogo/contracts';
import { MissionControlComponent } from './mission-control.component';

const scenario: DemoScenario = {
  mode: 'DEMONSTRATION',
  code: 'radar-outage',
  label: 'Indisponibilidade controlada de radar',
  equipmentId: 'd912675e-2fe9-469a-986b-451859a30bac',
  serialNumber: 'DEMO-RAD-001',
  status: 'operational',
  initialStatus: 'operational',
  active: false,
};

describe('MissionControlComponent guided focus', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('scrolls to and focuses the existing outage control without executing it', async () => {
    const fixture = TestBed.createComponent(MissionControlComponent);
    fixture.componentRef.setInput('scenario', scenario);
    fixture.componentRef.setInput('events', []);
    await fixture.whenStable();

    const button = fixture.nativeElement.querySelector('.mission-action') as HTMLButtonElement;
    const scrollIntoView = vi.fn();
    Object.defineProperty(button, 'scrollIntoView', { configurable: true, value: scrollIntoView });
    const focus = vi.spyOn(button, 'focus');
    const emit = vi.spyOn(fixture.componentInstance.scenarioAction, 'emit');

    expect(fixture.componentInstance.focusScenarioAction('outage')).toBe(true);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(button.classList.contains('mission-action--guided-focus')).toBe(true);
    expect(emit).not.toHaveBeenCalled();
  });

  it('removes the temporary guide highlight after its timeout', async () => {
    const fixture = TestBed.createComponent(MissionControlComponent);
    fixture.componentRef.setInput('scenario', scenario);
    fixture.componentRef.setInput('events', []);
    await fixture.whenStable();
    const button = fixture.nativeElement.querySelector('.mission-action') as HTMLButtonElement;
    Object.defineProperty(button, 'scrollIntoView', { configurable: true, value: vi.fn() });

    vi.useFakeTimers();
    try {
      expect(fixture.componentInstance.focusScenarioAction('outage')).toBe(true);
      vi.advanceTimersByTime(2600);
      expect(button.classList.contains('mission-action--guided-focus')).toBe(false);
    } finally {
      vi.useRealTimers();
      fixture.destroy();
    }
  });

  it('does not focus an action that is invalid for the current scenario state', async () => {
    const fixture = TestBed.createComponent(MissionControlComponent);
    fixture.componentRef.setInput('scenario', { ...scenario, active: true, status: 'malfunctioning' });
    fixture.componentRef.setInput('events', []);
    await fixture.whenStable();

    expect(fixture.componentInstance.focusScenarioAction('outage')).toBe(false);
  });

  it('clears the temporary guide highlight when the existing action is activated', async () => {
    const fixture = TestBed.createComponent(MissionControlComponent);
    fixture.componentRef.setInput('scenario', scenario);
    fixture.componentRef.setInput('events', []);
    await fixture.whenStable();
    const button = fixture.nativeElement.querySelector('.mission-action') as HTMLButtonElement;
    const scrollIntoView = vi.fn();
    Object.defineProperty(button, 'scrollIntoView', { configurable: true, value: scrollIntoView });
    const emit = vi.spyOn(fixture.componentInstance.scenarioAction, 'emit');

    fixture.componentInstance.focusScenarioAction('outage');
    button.click();

    expect(button.classList.contains('mission-action--guided-focus')).toBe(false);
    expect(emit).toHaveBeenCalledOnce();
  });

  it('labels every scenario event and known or unknown timeline states', async () => {
    const eventTypes: DemoTimelineEntry['eventType'][] = [
      'equipment.updated', 'agent.updated', 'maintenance.created', 'maintenance.updated',
      'alert.created', 'alert.updated', 'alert.resolved', 'demo.scenario.changed',
    ];
    const events: DemoTimelineEntry[] = eventTypes.map((eventType, index) => ({
      id: `event-${index}`, occurredAt: '2026-10-24T12:00:00.000Z', serialNumber: 'DEMO-RAD-001',
      eventType, source: 'demo', status: 'recorded', description: 'Alteração de demonstração.', equipmentId: scenario.equipmentId,
    }));
    const fixture = TestBed.createComponent(MissionControlComponent);
    fixture.componentRef.setInput('scenario', scenario);
    fixture.componentRef.setInput('events', events);
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as {
      statusLabel(value: DemoScenario['status']): string;
      eventLabel(value: DemoTimelineEntry): string;
      timelineStatusLabel(value: string): string;
    };

    expect(component.statusLabel('stolen')).toBe('Furtado');
    expect(component.statusLabel('deactivated')).toBe('Desativado');
    expect(events.map((event) => component.eventLabel(event))).toEqual([
      'Equipamento atualizado', 'Agente atualizado', 'Manutenção criada', 'Manutenção atualizada',
      'Alerta aberto', 'Alerta atendido', 'Alerta resolvido', 'Simulação',
    ]);
    expect(component.timelineStatusLabel('acknowledged')).toBe('Reconhecido');
    expect(component.timelineStatusLabel('custom')).toBe('custom');
  });
});
