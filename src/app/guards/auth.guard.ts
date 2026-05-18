// ============================================================
// FICHIER : src/app/guards/auth.guard.ts
// RÔLE    : Protège les routes — vérifie si connecté
//           et si première connexion
// ============================================================

import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  // inject() = récupère le service sans constructeur (Angular 17+)
  const auth   = inject(AuthService);
  const router = inject(Router);

  // Cas 1 : pas connecté → page login
  if (!auth.isLoggedIn()) {
    router.navigate(['/login']);
    return false;
  }

  // Cas 2 : connecté mais première connexion
  // → oblige à changer le mot de passe avant d'accéder à l'app
  if (auth.currentUser()?.premiereCo) {
    router.navigate(['/changer-mot-de-passe']);
    return false;
  }

  // Cas 3 : tout est bon → accès autorisé
  return true;
};