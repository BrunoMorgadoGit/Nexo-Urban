import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import type { MonitoringAlert, MonitoringAlertSeverity } from '@fogo/contracts';
import { AlertsComponent } from './alerts.component';
import { InventoryApiService } from '../core/inventory-api.service';
import { MonitoringRealtimeService } from '../core/monitoring-realtime.service';

const alertId = '3f175c06-783e-4ca1-9f79-fcf072c48de8';
const alert: MonitoringAlert = {
  id: alertId,
  code: 'equipment_malfunctioning',
  severity: 'critical',
  status: 'open',
  canResolve: false,
  title: 'Falha detectada',
  description: 'O equipamento foi marcado como indisponível.',
  resourceType: 'equipment',
  resourceId: 'd912675e-2fe9-469a-986b-451859a30bac',
  resourceLabel: 'DEMO-RAD-001',
  organizationName: 'DSIN',
  regionName: 'Ouro Verde',
  createdAt: '2026-10-24T12:00:00.000Z',
  updatedAt: '2026-10-24T12:00:00.000Z',
  acknowledgedAt: null,
  resolvedAt: null,
  actions: [],
  detailPath: '/equipments/d912675e-2fe9-469a-986b-451859a30bac',
};

type AlertsHarness = {
  setSeverity(value: MonitoringAlertSeverity | ''): void;
  setStatus(value: string): void;
  setNote(id: string, note: string): void;
  toggleDetails(id: string): void;
  isExpanded(id: string): boolean;
  severityLabel(value: MonitoringAlertSeverity): string;
  statusLabel(value: MonitoringAlert['status']): string;
  actionLabel(type: string): string;
  acknowledge(id: string): void;
  resolve(id: string): void;
  addNote(value: MonitoringAlert): void;
  next(): void;
  prev(): void;
  error: () => string;
  currentPage: () => number;
  displayItems: () => MonitoringAlert[];
  reload(): void;
};

describe('AlertsComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AlertsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({ alert: alertId })) } },
        { provide: MonitoringRealtimeService, useValue: { acquire: () => undefined, state: signal('connected'), refreshVersion: signal(0) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('opens an occurrence selected from the command center even when it is outside the current page', async () => {
    const fixture = TestBed.createComponent(AlertsComponent);
    await fixture.whenStable();

    const detailRequests = http.match((request) => request.url.endsWith(`/monitoring/alerts/${alertId}`));
    expect(detailRequests.length).toBeGreaterThan(0);
    detailRequests.forEach((request) => request.flush(alert));
    http.match((request) => request.url.endsWith('/monitoring/alerts')).forEach((request) => request.flush({
      items: [], page: 1, pageSize: 10, total: 0, totalPages: 0,
    }));

    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('DEMO-RAD-001');
    expect(element.textContent).toContain('Ouro Verde');
    expect(element.textContent).toContain('O equipamento foi marcado como indisponível.');
    expect(element.querySelector('.details-toggle')?.getAttribute('aria-expanded')).toBe('true');
    expect((element.querySelector('.action-button--resolve') as HTMLButtonElement).disabled).toBe(true);
    expect(element.textContent).toContain('Normalize a condição do recurso antes de encerrar o alerta.');
  });

  it('covers alert filters, labels, pagination, notes, and action failures', async () => {
    const api = TestBed.inject(InventoryApiService);
    const listMonitoringAlerts = vi.spyOn(api, 'listMonitoringAlerts')
      .mockReturnValue(of({ items: [alert], page: 1, pageSize: 10, total: 1, totalPages: 3 }));
    vi.spyOn(api, 'getMonitoringAlert').mockReturnValue(of(alert));
    const acknowledgeAlert = vi.spyOn(api, 'acknowledgeAlert')
      .mockReturnValue(throwError(() => ({ status: 503, error: { message: 'Serviço indisponível.' } })));
    const resolveAlert = vi.spyOn(api, 'resolveAlert').mockReturnValue(of(alert));
    const addAlertNote = vi.spyOn(api, 'addAlertNote').mockReturnValue(of(alert));

    const fixture = TestBed.createComponent(AlertsComponent);
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as AlertsHarness;

    component.setSeverity('high');
    component.setStatus('acknowledged');
    expect(listMonitoringAlerts).toHaveBeenLastCalledWith(expect.objectContaining({ severity: 'high', status: 'acknowledged' }));
    expect(component.severityLabel('low')).toBe('Baixo');
    expect(component.severityLabel('medium')).toBe('Médio');
    expect(component.statusLabel('resolved')).toBe('Resolvido');
    expect(component.actionLabel('created')).toBe('Ocorrência aberta');
    expect(component.actionLabel('custom')).toBe('custom');

    component.toggleDetails('another-alert');
    expect(component.isExpanded('another-alert')).toBe(true);
    component.toggleDetails('another-alert');
    expect(component.isExpanded('another-alert')).toBe(false);
    component.next();
    expect(component.currentPage()).toBe(2);
    component.prev();
    expect(component.currentPage()).toBe(1);
    component.prev();
    expect(component.currentPage()).toBe(1);

    component.addNote(alert);
    expect(component.error()).toContain('entre 2 e 500 caracteres');
    component.setNote(alert.id, '  Conferência realizada  ');
    component.addNote(alert);
    expect(addAlertNote).toHaveBeenCalledWith(alert.id, 'Conferência realizada');
    component.acknowledge(alert.id);
    expect(acknowledgeAlert).toHaveBeenCalledWith(alert.id);
    expect(component.error()).toContain('Serviço indisponível.');
    component.resolve(alert.id);
    expect(resolveAlert).toHaveBeenCalledWith(alert.id);
  });

  it('handles detail and list failures without exposing server messages', async () => {
    const api = TestBed.inject(InventoryApiService);
    const getMonitoringAlert = vi.spyOn(api, 'getMonitoringAlert')
      .mockReturnValue(throwError(() => new Error('private detail failure')));
    const listMonitoringAlerts = vi.spyOn(api, 'listMonitoringAlerts')
      .mockReturnValue(throwError(() => new Error('private list failure')));
    const fixture = TestBed.createComponent(AlertsComponent);
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as AlertsHarness;

    expect(getMonitoringAlert).toHaveBeenCalledWith(alertId);
    expect(component.displayItems()).toEqual([]);
    expect(component.error()).not.toContain('private detail failure');
    expect(component.error()).not.toContain('private list failure');
    const callsBeforeReload = listMonitoringAlerts.mock.calls.length;
    component.reload();
    expect(listMonitoringAlerts).toHaveBeenCalledTimes(callsBeforeReload + 1);
  });
});
