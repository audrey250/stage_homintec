import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [

  // redirect login
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  // LOGIN
  {
    path: 'login',
    loadComponent: () =>
      import('./auth/login/login').then(m => m.LoginComponent)
  },

  // LAYOUT (protégé)
  {
    path: '',
    loadComponent: () =>
      import('./layout/main-layout/main-layout').then(m => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: [

      { path: 'dashboard', loadComponent: () =>
          import('./dashboard/dashboard').then(m => m.DashboardComponent)
      },

      { path: 'conges/nouvelle-demande', loadComponent: () =>
          import('./conges/nouvelle-demande/nouvelle-demande').then(m => m.NouvelleDemandeComponent)
      },

      { path: 'conges/mes-demandes', loadComponent: () =>
          import('./conges/mes-demandes/mes-demandes').then(m => m.MesDemandesComponent)
      },

      { path: 'conges/validation', loadComponent: () =>
          import('./conges/validation/validation').then(m => m.ValidationComponent)
      },

      { path: 'messagerie', loadComponent: () =>
          import('./messagerie/messagerie').then(m => m.MessagerieComponent)
      },

      { path: 'profil', loadComponent: () =>
          import('./profil/profil').then(m => m.ProfilComponent)
      },

      // optionnel (bonne pratique)
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },

  // fallback
  { path: '**', redirectTo: 'login' }
];