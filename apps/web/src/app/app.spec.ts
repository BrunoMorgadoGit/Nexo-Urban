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
        provideRouter([{ path: 'alerts', component: TestRouteComponent }, { path: '**', component: TestRouteComponent }]),
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

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('h1')).toHaveLength(1);
    expect(compiled.querySelector('.topbar__title')?.textContent?.trim()).toBe('Alertas e Incidentes');
    expect(compiled.querySelector('.topbar__subtitle')?.textContent?.trim()).toBe('Ocorrências e atendimento.');
    expect(compiled.querySelector('.topbar__badge')?.textContent).toContain('Conectando');

    realtimeState.set('connected');
    await fixture.whenStable();
    expect(compiled.querySelector('.topbar__badge')?.textContent).toContain('Conectado');
    expect(compiled.querySelector('.topbar__badge')?.classList.contains('topbar__badge--connected')).toBe(true);

    realtimeState.set('disconnected');
    await fixture.whenStable();
    expect(compiled.querySelector('.topbar__badge')?.textContent).toContain('Sem conexão');
  });

  it('updates the shared heading for every primary route', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    const routes = [
      ['/intelligence', 'Análise Preventiva', 'Riscos pelo histórico.'],
      ['/live-map', 'Mapa Vivo', 'Localização dos recursos.'],
      ['/equipments/asset-1', 'Equipamentos', 'Situação dos ativos.'],
      ['/agents/agent-1', 'Agentes Operacionais', 'Profissionais de mobilidade e segurança.'],
      ['/maintenance', 'Manutenção', 'Agenda e serviços.'],
      ['/command', 'Central de Operações', 'Situação e prioridades.'],
    ] as const;

    for (const [url, title, subtitle] of routes) {
      await router.navigateByUrl(url);
      await fixture.whenStable();
      const root = fixture.nativeElement as HTMLElement;
      expect(root.querySelector('.topbar__title')?.textContent?.trim()).toBe(title);
      expect(root.querySelector('.topbar__subtitle')?.textContent?.trim()).toBe(subtitle);
    }
  });

  it('persists theme changes and exposes sidebar collapse state accessibly', async () => {
    localStorage.removeItem('fogo-color-theme');
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    root.querySelector<HTMLButtonElement>('.theme-toggle')?.click();
    root.querySelector<HTMLButtonElement>('.sidebar-toggle')?.click();
    await fixture.whenStable();

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('fogo-color-theme')).toBe('light');
    expect(root.querySelector<HTMLButtonElement>('.sidebar-toggle')?.getAttribute('aria-expanded')).toBe('false');
    expect(root.querySelector('.app-shell')?.classList.contains('app-shell--collapsed')).toBe(true);
  });

  it('opens mobile navigation and closes it when Escape is pressed', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const toggle = root.querySelector<HTMLButtonElement>('.menu-toggle');

    toggle?.click();
    await fixture.whenStable();
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect(root.querySelector('.sidebar')?.classList.contains('sidebar--open')).toBe(true);
    const firstLink = root.querySelector<HTMLAnchorElement>('.sidebar nav a');
    const linkFocus = firstLink ? vi.spyOn(firstLink, 'focus') : null;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(linkFocus).toHaveBeenCalled();

    const toggleFocus = toggle ? vi.spyOn(toggle, 'focus') : null;

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(toggleFocus).toHaveBeenCalled();

    const app = fixture.componentInstance as unknown as {
      menuOpen: { set(value: boolean): void };
      closeMenu(): void;
    };
    app.menuOpen.set(true);
    app.closeMenu();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(toggleFocus).toHaveBeenCalledTimes(2);
  });

  it('closes mobile navigation when its toggle is pressed again', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const toggle = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.menu-toggle');

    toggle?.click();
    await fixture.whenStable();
    toggle?.click();
    await fixture.whenStable();

    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps the dark theme usable when browser storage is unavailable', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('storage blocked'); });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage blocked'); });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    getItem.mockRestore();
    setItem.mockRestore();
  });
});
