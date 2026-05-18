import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class NavbarComponent {

  dropdownOpen = false;

  // Signal pour réduire/agrandir la sidebar
  collapsed = signal(false);

  constructor(public authService: AuthService) {}

  toggleDropdown(): void {
    this.dropdownOpen = !this.dropdownOpen;
  }

  // Ferme le dropdown si on clique ailleurs
  closeDropdown(): void {
    this.dropdownOpen = false;
  }

  toggle(): void {
    this.collapsed.update(v => !v);

    // SB Admin 2 attend la classe toggled sur #wrapper
    const wrapper = document.getElementById('wrapper');
    if (wrapper) {
      wrapper.classList.toggle('toggled');
    }
  }

  logout(): void {
    this.authService.logout();
  }

  notifsOpen = false;

toggleNotifs(): void {
  this.notifsOpen = !this.notifsOpen;
  this.dropdownOpen = false; // ferme l'autre dropdown
}
}