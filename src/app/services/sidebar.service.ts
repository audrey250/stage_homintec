import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SidebarService {
  private readonly mobileBreakpoint = 992;

  // Desktop only: collapse to icon rail
  desktopCollapsed = signal(false);

  // Mobile only: offcanvas open/close
  mobileOpen = signal(false);

  isMobileViewport(): boolean {
    return window.matchMedia(`(max-width: ${this.mobileBreakpoint - 0.02}px)`).matches;
  }

  toggle(): void {
    if (this.isMobileViewport()) {
      this.toggleMobile();
      return;
    }

    this.toggleDesktop();
  }

  toggleMobile(): void {
    this.mobileOpen.set(!this.mobileOpen());
  }

  toggleDesktop(): void {
    this.desktopCollapsed.set(!this.desktopCollapsed());
  }

  closeMobile(): void {
    this.mobileOpen.set(false);
  }

  openMobile(): void {
    this.mobileOpen.set(true);
  }

  syncWithViewport(): void {
    // Never keep the mobile drawer open when switching to desktop
    if (!this.isMobileViewport()) {
      this.mobileOpen.set(false);
    }
  }
}
