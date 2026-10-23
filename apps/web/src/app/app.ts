import { ChangeDetectionStrategy, Component, ElementRef, HostListener, signal, ViewChild } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly menuOpen = signal(false);
  @ViewChild('mainNavigation') private navigation?: ElementRef<HTMLElement>;
  @ViewChild('menuToggle') private menuToggle?: ElementRef<HTMLButtonElement>;

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
