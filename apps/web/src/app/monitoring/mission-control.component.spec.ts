import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { DemoScenario } from '@fogo/contracts';
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

  it('scrolls to and focuses the existing outage control without executing it', () => {
    const fixture = TestBed.createComponent(MissionControlComponent);
    fixture.componentRef.setInput('scenario', scenario);
    fixture.componentRef.setInput('events', []);
    fixture.detectChanges();

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

  it('does not focus an action that is invalid for the current scenario state', () => {
    const fixture = TestBed.createComponent(MissionControlComponent);
    fixture.componentRef.setInput('scenario', { ...scenario, active: true, status: 'malfunctioning' });
    fixture.componentRef.setInput('events', []);
    fixture.detectChanges();

    expect(fixture.componentInstance.focusScenarioAction('outage')).toBe(false);
  });

  it('clears the temporary guide highlight when the existing action is activated', () => {
    const fixture = TestBed.createComponent(MissionControlComponent);
    fixture.componentRef.setInput('scenario', scenario);
    fixture.componentRef.setInput('events', []);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('.mission-action') as HTMLButtonElement;
    const scrollIntoView = vi.fn();
    Object.defineProperty(button, 'scrollIntoView', { configurable: true, value: scrollIntoView });
    const emit = vi.spyOn(fixture.componentInstance.scenarioAction, 'emit');

    fixture.componentInstance.focusScenarioAction('outage');
    button.click();

    expect(button.classList.contains('mission-action--guided-focus')).toBe(false);
    expect(emit).toHaveBeenCalledOnce();
  });
});
