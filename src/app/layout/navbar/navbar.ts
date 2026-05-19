import { Component, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { SidebarService } from '../../services/sidebar.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class NavbarComponent {

  dropdownOpen = false;

  constructor(
    private readonly elementRef: ElementRef<HTMLElement>,
    public authService: AuthService,
    public sidebarService: SidebarService
  ) {}

  toggleDropdown(event?: MouseEvent): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.dropdownOpen = !this.dropdownOpen;
  }

  closeDropdown(): void {
    this.dropdownOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.dropdownOpen) {
      return;
    }

    const target = event.target as Node | null;
    if (!target) {
      return;
    }

    const clickedInside = this.elementRef.nativeElement.contains(target);
    if (!clickedInside) {
      this.closeDropdown();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeDropdown();
  }

  toggle(): void {
    if (this.sidebarService.isMobileViewport()) {
      this.sidebarService.toggleMobile();
      return;
    }

    this.sidebarService.toggleDesktop();
  }

  logout(): void {
    this.authService.logout();
  }

  notifsOpen = false;

  toggleNotifs(): void {
    this.notifsOpen = !this.notifsOpen;
    this.dropdownOpen = false;
  }
}