import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AlertsComponent } from './alerts.component';
import { MonitoringRealtimeService } from '../core/monitoring-realtime.service';

const alertId = '3f175c06-783e-4ca1-9f79-fcf072c48de8';
const alert = {
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
    fixture.detectChanges();

    const detailRequests = http.match((request) => request.url.endsWith(`/monitoring/alerts/${alertId}`));
    expect(detailRequests.length).toBeGreaterThan(0);
    detailRequests.forEach((request) => request.flush(alert));
    http.match((request) => request.url.endsWith('/monitoring/alerts')).forEach((request) => request.flush({
      items: [], page: 1, pageSize: 10, total: 0, totalPages: 0,
    }));

    await fixture.whenStable();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('DEMO-RAD-001');
    expect(element.textContent).toContain('Ouro Verde');
    expect(element.textContent).toContain('O equipamento foi marcado como indisponível.');
    expect(element.querySelector('.details-toggle')?.getAttribute('aria-expanded')).toBe('true');
    expect((element.querySelector('.action-button--resolve') as HTMLButtonElement).disabled).toBe(true);
    expect(element.textContent).toContain('Normalize a condição do recurso antes de encerrar o alerta.');
  });
});
