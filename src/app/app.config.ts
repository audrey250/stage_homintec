// ============================================================
// FICHIER : src/app/app.config.ts
// RÔLE    : Configuration principale de l'application Angular
// ============================================================

import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    // Active le routeur avec nos routes
    provideRouter(routes),

    // Active HttpClient avec notre intercepteur JWT
    // withInterceptors([]) = liste des intercepteurs à appliquer
    provideHttpClient(withInterceptors([authInterceptor]))
  ]
};