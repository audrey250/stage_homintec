import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-changer-mot-de-passe',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './changer-mot-de-passe.html',
  styleUrl: './changer-mot-de-passe.css'
})
export class ChangerMotDePasseComponent {
user: any = null; 
  // =====================
  // FORM DATA
  // =====================
  nouveaumotDePasse = '';
  confirmmotDePasse = '';
  erreurs: Record<string, string> = {};

  // =====================
  // SIGNALS
  // =====================
  erreurGlobal = signal('');
  loading = signal(false);
  showmotDePasse = signal(false);
  showConfirm = signal(false);

  // =====================
  // AUTH SERVICE (IMPORTANT FIX)
  // =====================
  constructor(
    public authService: AuthService,
    private router: Router
  ) {}

  // =====================
  // PASSWORD STRENGTH
  // =====================
  get forcemotDePasse(): number {
    const p = this.nouveaumotDePasse;
    if (!p) return 0;

    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(p)) score++;

    return score;
  }

  get forceLabel(): string {
    return ['', 'Faible', 'Moyen', 'Fort', 'Très fort'][this.forcemotDePasse];
  }

  // =====================
  // SUBMIT
  // =====================
  soumettre(): void {

    this.erreurs = {};
    this.erreurGlobal.set('');

    // validation password
    if (!this.nouveaumotDePasse) {
      this.erreurs['password'] = 'Le mot de passe est obligatoire.';
    } else if (this.nouveaumotDePasse.length < 8) {
      this.erreurs['password'] = 'Minimum 8 caractères.';
    } else if (
      !/[A-Z]/.test(this.nouveaumotDePasse) ||
      !/[0-9]/.test(this.nouveaumotDePasse) ||
      !/[!@#$%^&*(),.?":{}|<>]/.test(this.nouveaumotDePasse)
    ) {
      this.erreurs['password'] =
        'Doit contenir une majuscule, un chiffre et un caractère spécial.';
    }

    // confirmation
    if (this.nouveaumotDePasse !== this.confirmmotDePasse) {
      this.erreurs['confirm'] = 'Les mots de passe ne correspondent pas.';
    }

    if (Object.keys(this.erreurs).length > 0) return;

    // loading start
    this.loading.set(true);
this.authService.changerMotDePasse(this.nouveaumotDePasse).subscribe({
  next: () => {
    this.loading.set(false);

    // 🔥 sécurité : petit délai pour éviter blocage guard
    setTimeout(() => {
      this.router.navigate(['/dashboard']);
    }, 50);
  },
  error: (err: HttpErrorResponse) => {
    this.loading.set(false);

    if (err.status === 0) {
      this.erreurGlobal.set('Serveur inaccessible.');
    } else {
      this.erreurGlobal.set(err.error?.message || 'Une erreur est survenue.');
    }
  }
});
   
  }
}