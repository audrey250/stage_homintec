import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const firstLoginGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) {
    router.navigate(['/login']);
    return false;
  }

  if (!auth.currentUser()?.premiereCo) {
    router.navigate(['/dashboard']);
    return false;
  }

  return true;
};
