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
        localStorage.removeItem('homintec_token');
        localStorage.removeItem('homintec_user');
        router.navigate(['/login']);
      } else if (!isAuthEndpoint && err.status === 403) {
        console.error('❌ Erreur 403 - Accès refusé:', err.url);
        console.error('   Vérifier les permissions utilisateur pour cette action');
        console.log('Token =', token);
console.log('Authorization =', reqAvecToken.headers.get('Authorization'));
      }
      return throwError(() => err);
    })
  );
};