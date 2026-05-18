// ============================================================
// src/app/auth/mot-de-passe-oublie/mot-de-passe-oublie.ts
// ============================================================

import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';

const API_URL = 'http://localhost:8080/api';

@Component({
  selector: 'app-mot-de-passe-oublie',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './mot-de-passe-oublie.html',
  styleUrl: './mot-de-passe-oublie.css'
})
export class MotDePasseOublieComponent {

  email   = '';
  loading = signal(false);
  envoye  = signal(false);
  erreur  = signal('');

  // ✅ HttpClient injecté directement
  constructor(private http: HttpClient) {}

  envoyer(): void {
    if (!this.email.trim()) {
      this.erreur.set('Veuillez entrer votre adresse email.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email)) {
      this.erreur.set('Format d\'email invalide.');
      return;
    }

    this.erreur.set('');
    this.loading.set(true);

    // ✅ POST /api/auth/mot-de-passe-oublie
    this.http.post(`${API_URL}/auth/mot-de-passe-oublie`, {
      email: this.email
    }).subscribe({
      next: () => {
        this.loading.set(false);
        this.envoye.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        if (err.status === 0) {
          this.erreur.set('Serveur inaccessible.');
        } else if (err.status === 404) {
          // On ne dit pas si l'email existe ou non (sécurité)
          this.envoye.set(true);
        } else {
          this.erreur.set('Une erreur est survenue. Réessayez.');
        }
      }
    });
  }
}