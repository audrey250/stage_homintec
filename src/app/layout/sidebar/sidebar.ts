import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { SidebarService } from '../../services/sidebar.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css'
})
export class SidebarComponent {

  constructor(
    public authService: AuthService,
    private readonly sidebarService: SidebarService
  ) {}

  onNavLinkClick(): void {
    if (!this.sidebarService.isMobileViewport()) {
      return;
    }

    // Close on next tick so RouterLink navigation completes first.
    setTimeout(() => this.sidebarService.closeMobile(), 0);
  }

}