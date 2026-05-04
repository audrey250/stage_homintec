// ============================================================
// auth.interceptor.ts
// RÔLE : Ajoute automatiquement le token JWT dans TOUTES
//        les requêtes HTTP envoyées à Spring Boot
// ============================================================

// HttpInterceptorFn = type Angular 17+ pour les intercepteurs fonctionnels
// HttpRequest = une requête HTTP (avant d'être envoyée)
// HttpHandlerFn = fonction qui passe la requête au suivant
import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {

  // inject() = récupérer un service sans constructeur (style Angular 17+)
  const authService = inject(AuthService);
  const router = inject(Router);

  // Récupérer le token JWT depuis le localStorage
  const token = authService.getToken();

  // Si un token existe, on crée une COPIE de la requête
  // avec l'en-tête Authorization ajouté
  // On ne modifie JAMAIS la requête originale (immuabilité)
  if (token) {
    req = req.clone({
      setHeaders: {
        // Format standard JWT : "Bearer <token>"
        // Spring Boot lit cet en-tête pour valider l'identité
        Authorization: `Bearer ${token}`
      }
    });
  }

  // On passe la requête (modifiée ou non) au handler suivant
  return next(req).pipe(
    catchError((erreur) => {

      if (erreur.status === 401) {
        // Token expiré ou invalide → on déconnecte et redirige
        authService.logout();
        router.navigate(['/login']);
      }

      // On propage l'erreur pour que le composant puisse la gérer
      return throwError(() => erreur);
    })
  );
};