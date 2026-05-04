import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Guard fonctionnel (nouvelle syntaxe Angular 17+)
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    return true; // ✅ Connecté → accès autorisé
  }

  // ❌ Pas connecté → redirige vers login
  router.navigate(['/login']);
  return false;
};