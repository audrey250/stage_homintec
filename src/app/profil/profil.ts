import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-profil',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profil.html',
  styleUrl: './profil.css'
})
export class ProfilComponent {
  constructor(
    public authService: AuthService,
    private readonly router: Router
  ) {}

  goTo(path: string): void {
    this.router.navigate([path]);
  }

  get user() {
    return this.authService.currentUser();
  }

  get fullName(): string {
    const prenom = this.user?.prenom ?? '';
    const nom = this.user?.nom ?? '';
    return `${prenom} ${nom}`.trim();
  }

  get initials(): string {
    const prenom = this.user?.prenom?.charAt(0) ?? '';
    const nom = this.user?.nom?.charAt(0) ?? '';
    const value = `${prenom}${nom}`.trim().toUpperCase();
    return value || 'U';
  }

  get roleLabel(): string {
    const role = (this.user?.Poste ?? '').toLowerCase();
    const labels: Record<string, string> = {
      admin: 'Administrateur',
      rh: 'Ressources Humaines',
      Responsable: 'Responsable',
      employe: 'Employe'
    };

    return labels[role] ?? (this.user?.Poste || 'Utilisateur');
  }

  get roleClass(): string {
    const role = (this.user?.Poste ?? '').toLowerCase();
    const classes: Record<string, string> = {
      admin: 'role-chip role-chip--admin',
      rh: 'role-chip role-chip--rh',
      manager: 'role-chip role-chip--manager',
      employe: 'role-chip role-chip--employe'
    };

    return classes[role] ?? 'role-chip role-chip--default';
  }
}