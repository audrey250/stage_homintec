import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const isAuthEndpoint = req.url.includes('/auth/login') || req.url.includes('/auth/logout');

  // Récupère le token dans localStorage (utilise la même clé que le service)
  const token = localStorage.getItem('homintec_token');

  // Ajoute le token dans le header Authorization de chaque requête
  const reqAvecToken = token && !isAuthEndpoint
    ? req.clone({
        headers: req.headers.set('Authorization', `Bearer ${token}`)
      })
    : req;

  return next(reqAvecToken).pipe(
    catchError((err) => {
      if (!isAuthEndpoint && err.status === 401) {
        // Token expiré ou invalide → retour au login
        localStorage.removeItem('homintec_token');
        localStorage.removeItem('homintec_user');
        router.navigate(['/login']);
      }
      // Ne redirige pas globalement sur 403 ici.
      // La gestion d'autorisation de navigation est déjà faite par les guards.
      // Sinon, un 403 d'une simple requête API peut forcer une redirection inattendue.
      return throwError(() => err);
    })
  );
};