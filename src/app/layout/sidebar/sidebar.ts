import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss'
})
export class SidebarComponent {

  // Contrôle si la sidebar est réduite ou non
  collapsed = signal(false);

  constructor(public authService: AuthService) {}

  toggle(): void {
    this.collapsed.set(!this.collapsed());
  }
}