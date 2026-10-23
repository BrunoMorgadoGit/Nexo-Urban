import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, inject, signal, ViewChild } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MonitoringRealtimeService } from './core/monitoring-realtime.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly menuOpen = signal(false);
  protected readonly sidebarCollapsed = signal(false);
  protected readonly connectionState = inject(MonitoringRealtimeService).state;
  private readonly realtime = inject(MonitoringRealtimeService);
  @ViewChild('mainNavigation') private navigation?: ElementRef<HTMLElement>;
  @ViewChild('menuToggle') private menuToggle?: ElementRef<HTMLButtonElement>;

  constructor() {
    this.realtime.acquire(inject(DestroyRef));
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
