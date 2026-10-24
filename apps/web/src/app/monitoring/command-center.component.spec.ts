import { Component, input, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { DemoScenario, MonitoringAlert, MonitoringOverview } from '@fogo/contracts';
import { of, throwError } from 'rxjs';
import { InventoryApiService } from '../core/inventory-api.service';
import { MonitoringRealtimeService } from '../core/monitoring-realtime.service';
import { OperationalMapComponent } from './operational-map.component';
import { CommandCenterComponent } from './command-center.component';

type CommandCenterHarness = {
  statusLabel(value: MonitoringAlert['status']): string;
  severityLabel(value: MonitoringAlert['severity']): string;
  urgencyLabel(value: 'overdue' | 'immediate' | 'upcoming'): string;
  stepState(step: 1 | 2 | 3 | 4 | 5): string;
  stepStateLabel(step: 1 | 2 | 3 | 4 | 5): string;
  guideToMissionAction(action: 'outage' | 'restore'): void;
  openDemoAlert(step: 3 | 4): void;
  toggleMissionControl(): void;
  reload(): void;
  busyScenario: WritableSignal<boolean>;
  guideFeedback: () => string;
  error: () => string;
};

@Component({ standalone: true, selector: 'app-operational-map', template: '' })
class OperationalMapStub { readonly compact = input(false); }

const overview = (demoMode: boolean): MonitoringOverview => ({
  demoMode, totalEquipment: 2,
  equipmentStatusCounts: { not_installed: 0, operational: 1, malfunctioning: 1, maintenance: 0, deactivated: 0, stolen: 0 },
  unclassifiedEquipment: 0, eligibleEquipment: 2, operationalEquipment: 1, unavailableEquipment: 1,
  availabilityPercent: 50, agentsOnDuty: 1, activeCriticalAlerts: 1, overdueMaintenance: 0,
  calculatedAt: '2026-10-24T12:00:00.000Z',
});
const scenario: DemoScenario = {
  mode: 'DEMONSTRATION', code: 'radar-outage', label: 'Indisponibilidade controlada de radar',
  equipmentId: 'equipment-1', serialNumber: 'RAD-001', status: 'operational', initialStatus: 'operational', active: false,
};
const alert: MonitoringAlert = {
  id: 'alert-1', code: 'equipment_malfunctioning', severity: 'critical', status: 'open', canResolve: false,
  title: 'Falha detectada', description: 'Verificar o equipamento.', resourceType: 'equipment', resourceId: 'equipment-1',
  resourceLabel: 'RAD-001', organizationName: 'Mobilidade', regionName: 'Sousas',
  createdAt: '2026-10-24T12:00:00.000Z', updatedAt: '2026-10-24T12:00:00.000Z',
  acknowledgedAt: null, resolvedAt: null, actions: [], detailPath: '/equipments/equipment-1',
};

describe('CommandCenterComponent', () => {
  const configure = async (demoMode: boolean) => {
    const api = {
      getMonitoringOverview: () => of(overview(demoMode)),
      listMonitoringAlerts: (filters: { resourceId?: string }) => of({
        items: filters.resourceId ? [alert] : [], page: 1, pageSize: 5, total: filters.resourceId ? 1 : 0, totalPages: 1,
      }),
      getMonitoringRegions: () => of([]),
      getMaintenanceAttention: () => of([]),
      getDemoScenario: () => of(scenario),
      getDemoTimeline: () => of([]),
      triggerDemoOutage: vi.fn(() => of(scenario)),
      resetDemoScenario: vi.fn(() => of(scenario)),
    };
    await TestBed.configureTestingModule({
      imports: [CommandCenterComponent],
      providers: [
        provideRouter([{ path: 'alerts', component: OperationalMapStub }]),
        { provide: InventoryApiService, useValue: api },
        { provide: MonitoringRealtimeService, useValue: { acquire: vi.fn(), refreshVersion: signal(0) } },
      ],
    }).overrideComponent(CommandCenterComponent, {
      remove: { imports: [OperationalMapComponent] },
      add: { imports: [OperationalMapStub] },
    }).compileComponents();
    return api;
  };

  it('renders the operational snapshot and empty inventory guidance', async () => {
    await configure(false);
    const fixture = TestBed.createComponent(CommandCenterComponent);

    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Atenção necessária');
    expect(root.querySelector('.distribution-chart')?.getAttribute('aria-label')).toContain('Distribuição dos 2 equipamentos');
    expect(root.textContent).toContain('Sem ocorrências ativas');
    expect(root.textContent).toContain('Sem regiões cadastradas.');
  });

  it('shows the guided demo and opens its related occurrence', async () => {
    await configure(true);
    const fixture = TestBed.createComponent(CommandCenterComponent);

    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Demonstração guiada');
    expect(root.textContent).toContain('Conferir ocorrência e histórico');
    root.querySelector<HTMLButtonElement>('.demo-step:nth-child(3) .demo-step__label')?.click();
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toContain('/alerts');
  });

  it('guides operators through valid, blocked, and repeat scenario actions', async () => {
    const api = await configure(true);
    const fixture = TestBed.createComponent(CommandCenterComponent);
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as CommandCenterHarness;

    expect(component.statusLabel('acknowledged')).toBe('Reconhecido');
    expect(component.severityLabel('high')).toBe('Alto');
    expect(component.urgencyLabel('immediate')).toBe('Imediata');
    expect(component.stepState(1)).toBe('ready');
    expect(component.stepState(2)).toBe('current');
    expect(component.stepStateLabel(3)).toBe('Concluída');

    const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
    try {
      component.guideToMissionAction('outage');
      expect(component.guideFeedback()).toContain('Controle “Simular mau funcionamento” destacado');
    } finally {
      if (originalScroll) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScroll);
      else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
    }

    component.openDemoAlert(4);
    expect(component.guideFeedback()).toContain('Simule uma falha');
    component.openDemoAlert(3);
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toContain('/alerts');

    component.busyScenario.set(true);
    component.guideToMissionAction('outage');
    expect(component.guideFeedback()).toContain('Aguarde a atualização');
    component.busyScenario.set(false);
    component.guideToMissionAction('restore');
    expect(component.guideFeedback()).toContain('Não há uma falha ativa');

    component.toggleMissionControl();
    await fixture.whenStable();
    expect(api.triggerDemoOutage).toHaveBeenCalledOnce();
    component.reload();
    await fixture.whenStable();
  });

  it('handles an unavailable operational snapshot without exposing internals', async () => {
    const unavailableApi = await configure(false);
    unavailableApi.getMonitoringOverview = () => throwError(() => new Error('private overview failure'));
    const fixture = TestBed.createComponent(CommandCenterComponent);
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as CommandCenterHarness;

    expect(component.error()).not.toContain('private overview failure');
    expect(component.stepState(2)).toBe('waiting');
    component.openDemoAlert(3);
    expect(component.guideFeedback()).toContain('Nenhuma ocorrência');
    component.guideToMissionAction('outage');
    expect(component.guideFeedback()).toContain('ainda não está disponível');
    component.toggleMissionControl();
  });

  it('prevents responding to a resolved demonstration alert and restores the scenario', async () => {
    const api = await configure(true);
    const resolvedAlert = { ...alert, status: 'resolved' as const };
    api.getDemoScenario = () => of({ ...scenario, active: true, status: 'malfunctioning' });
    api.listMonitoringAlerts = (filters) => of({
      items: filters.resourceId ? [resolvedAlert] : [], page: 1, pageSize: 5,
      total: filters.resourceId ? 1 : 0, totalPages: 1,
    });
    const fixture = TestBed.createComponent(CommandCenterComponent);
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as CommandCenterHarness;
    component.openDemoAlert(4);
    expect(component.guideFeedback()).toContain('já foi resolvida');
    component.toggleMissionControl();
    await fixture.whenStable();
    expect(api.resetDemoScenario).toHaveBeenCalledOnce();
  });

  it('reports a safe error when the demonstration action fails', async () => {
    const api = await configure(true);
    api.triggerDemoOutage.mockReturnValue(throwError(() => new Error('private outage failure')));
    const fixture = TestBed.createComponent(CommandCenterComponent);
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as CommandCenterHarness;

    component.toggleMissionControl();
    await fixture.whenStable();

    expect(component.error()).not.toContain('private outage failure');
  });
});
