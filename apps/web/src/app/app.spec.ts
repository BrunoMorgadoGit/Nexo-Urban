import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { MonitoringRealtimeService, type RealtimeConnectionState } from './core/monitoring-realtime.service';
import { App } from './app';

@Component({ standalone: true, template: '<p>Rota de teste</p>' })
class TestRouteComponent {}

const realtimeState = signal<RealtimeConnectionState>('connecting');

describe('App', () => {
  beforeEach(async () => {
    realtimeState.set('connecting');
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([{ path: 'alerts', component: TestRouteComponent }]),
        { provide: MonitoringRealtimeService, useValue: { state: realtimeState, acquire: () => undefined } },
      ],
    })
      .compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the project identity', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand')?.getAttribute('aria-label')).toContain('NEXO Urbano');
    expect(compiled.textContent).toContain('Central de Operações');
  });

  it('provides a keyboard skip link to the main content', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const link = compiled.querySelector<HTMLAnchorElement>('.skip-link');
    expect(link?.getAttribute('href')).toBe('#main-content');
    expect(compiled.querySelector('main#main-content')?.getAttribute('tabindex')).toBe('-1');
  });

  it('shows the active route title and the actual SSE state as the only page heading', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/alerts');
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('h1')).toHaveLength(1);
    expect(compiled.querySelector('.topbar__title')?.textContent?.trim()).toBe('Alertas e Incidentes');
    expect(compiled.querySelector('.topbar__subtitle')?.textContent?.trim()).toBe('Ocorrências e atendimento.');
    expect(compiled.querySelector('.topbar__badge')?.textContent).toContain('Conectando');

    realtimeState.set('connected');
    fixture.detectChanges();
    expect(compiled.querySelector('.topbar__badge')?.textContent).toContain('Conectado');
    expect(compiled.querySelector('.topbar__badge')?.classList.contains('topbar__badge--connected')).toBe(true);

    realtimeState.set('disconnected');
    fixture.detectChanges();
    expect(compiled.querySelector('.topbar__badge')?.textContent).toContain('Sem conexão');
  });
});
