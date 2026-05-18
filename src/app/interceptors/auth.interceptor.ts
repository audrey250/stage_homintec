import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  // Récupère le token dans localStorage (utilise la même clé que le service)
  const token = localStorage.getItem('homintec_token');

  // Ajoute le token dans le header Authorization de chaque requête
  const reqAvecToken = token
    ? req.clone({
        headers: req.headers.set('Authorization', `Bearer ${token}`)
      })
    : req;

  return next(reqAvecToken).pipe(
    catchError((err) => {
      if (err.status === 401) {
        // Token expiré ou invalide → retour au login
        localStorage.removeItem('homintec_token');
        localStorage.removeItem('homintec_user');
        router.navigate(['/login']);
      }
      if (err.status === 403) {
        // Accès refusé → retour au dashboard
        router.navigate(['/dashboard']);
      }
      return throwError(() => err);
    })
  );
};