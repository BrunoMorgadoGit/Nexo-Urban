import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, inject, signal, ViewChild } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MonitoringRealtimeService } from './core/monitoring-realtime.service';

type ColorTheme = 'dark' | 'light';
const themeStorageKey = 'fogo-color-theme';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  private readonly document = inject(DOCUMENT);
  protected readonly theme = signal<ColorTheme>(this.readTheme());
  protected readonly menuOpen = signal(false);
  protected readonly sidebarCollapsed = signal(false);
  private readonly router = inject(Router);
  private readonly realtime = inject(MonitoringRealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly pageTitle = signal(this.titleFor(this.router.url));
  protected readonly connectionState = this.realtime.state;
  @ViewChild('mainNavigation') private navigation?: ElementRef<HTMLElement>;
  @ViewChild('menuToggle') private menuToggle?: ElementRef<HTMLButtonElement>;

  constructor() {
    this.applyTheme(this.theme());
    this.realtime.acquire(this.destroyRef);
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((event) => this.pageTitle.set(this.titleFor(event.urlAfterRedirects)));
  }

  private readTheme(): ColorTheme {
    try {
      return this.document.defaultView?.localStorage.getItem(themeStorageKey) === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  }

  private applyTheme(theme: ColorTheme): void {
    this.document.documentElement.setAttribute('data-theme', theme);
    try {
      this.document.defaultView?.localStorage.setItem(themeStorageKey, theme);
    } catch {
      // The theme remains usable for this session when browser storage is unavailable.
    }
  }

  protected toggleTheme(): void {
    const nextTheme = this.theme() === 'dark' ? 'light' : 'dark';
    this.theme.set(nextTheme);
    this.applyTheme(nextTheme);
  }

  private titleFor(url: string): string {
    const path = url.split(/[?#]/, 1)[0];
    if (path.startsWith('/intelligence')) return 'Inteligência Preditiva';
    if (path.startsWith('/live-map')) return 'Mapa Vivo';
    if (path.startsWith('/alerts')) return 'Alertas e incidentes';
    if (path.startsWith('/equipments')) return 'Equipamentos';
    if (path.startsWith('/agents')) return 'Agentes';
    if (path.startsWith('/maintenance')) return 'Manutenção';
    return 'Central de Operações';
  }

  protected toggleSidebar(): void {
    this.sidebarCollapsed.update((collapsed) => !collapsed);
  }

  protected connectionLabel(): string {
    const state = this.connectionState();
    return state === 'connected' ? 'Tempo real conectado' : state === 'connecting' ? 'Conectando' : 'Reconectando';
  }

  protected closeMenu(): void {
    const wasOpen = this.menuOpen();
    this.menuOpen.set(false);
    if (wasOpen) setTimeout(() => this.menuToggle?.nativeElement.focus());
  }

  protected toggleMenu(): void {
    if (this.menuOpen()) {
      this.closeMenu();
      return;
    }
    this.menuOpen.set(true);
    setTimeout(() => this.navigation?.nativeElement.querySelector('a')?.focus());
  }

  @HostListener('document:keydown.escape')
  protected closeOnEscape(): void {
    if (this.menuOpen()) this.closeMenu();
  }
}
