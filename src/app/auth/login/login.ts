// ============================================================
// src/app/auth/login/login.ts
// ============================================================

import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent {

  email = '';
  motDePasse = '';

  loading = signal(false);
  errorMessage = signal('');
  showmotDePasse = signal(false);

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    // Redirection si déjà connecté
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/dashboard']);
    }
  }

  onSubmit(): void {

    // 🔒 Empêche double clic
    if (this.loading()) return;

    // 🔍 Validation simple
    if (!this.email.trim()) {
      this.errorMessage.set('Veuillez entrer votre adresse email.');
      return;
    }

    if (!this.motDePasse.trim()) {
      this.errorMessage.set('Veuillez entrer votre mot de passe.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    this.authService.login(this.email, this.motDePasse).subscribe({

      next: () => {
        this.loading.set(false);

        const user = this.authService.currentUser();

        //  Redirection intelligente
        if (user?.premiereCo) {
          this.router.navigate(['/changer-mot-de-passe']);
        } else {
          this.router.navigate(['/dashboard']);
        }
      },

      error: (err: HttpErrorResponse) => {
        this.loading.set(false);

        console.error('Erreur login :', err);

        // 🔌 Backend OFF
        if (err.status === 0) {
          this.errorMessage.set(
            'Serveur inaccessible. Vérifiez que le backend est démarré.'
          );

        // Mauvais identifiants
        } else if (err.status === 401) {
          this.errorMessage.set('Email ou mot de passe incorrect.');

        // Compte désactivé (vient du backend)
        } else if (err.status === 403) {
          this.errorMessage.set(
            err.error?.message ||
            'Votre compte est désactivé. Contactez l\'administrateur.'
          );

        //  Autres erreurs
        } else {
          this.errorMessage.set(
            err.error?.message ||
            `Erreur serveur (${err.status}). Veuillez réessayer.`
          );
        }
      }
    });
  }

  //  Toggle mot de passe
  togglemotDePasse(): void {
    this.showmotDePasse.set(!this.showmotDePasse());
  }
}