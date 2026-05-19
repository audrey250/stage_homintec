import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';
import { firstLoginGuard } from './guards/first-login.guard';

export const routes: Routes = [

  { path: '', redirectTo: 'login', pathMatch: 'full' },

  {
    path: 'login',
    loadComponent: () =>
      import('./auth/login/login').then(m => m.LoginComponent)
  },
  {
    path: 'mot-de-passe-oublie',
    loadComponent: () =>
      import('./auth/mot-de-passe-oublie/mot-de-passe-oublie')
      .then(m => m.MotDePasseOublieComponent)
  },
  {
    path: 'changer-mot-de-passe',
    canActivate: [firstLoginGuard],
    loadComponent: () =>
      import('./auth/changer-mot-de-passe/changer-mot-de-passe')
      .then(m => m.ChangerMotDePasseComponent)
  },

  {
    path: '',
    loadComponent: () =>
      import('./layout/main-layout/main-layout')
      .then(m => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./dashboard/dashboard').then(m => m.DashboardComponent)
      },
      {
        path: 'conges/nouvelle-demande',
        loadComponent: () =>
          import('./conges/nouvelle-demande/nouvelle-demande')
          .then(m => m.NouvelleDemandeComponent)
      },
      {
        path: 'conges/mes-demandes',
        loadComponent: () =>
          import('./conges/mes-demandes/mes-demandes')
          .then(m => m.MesDemandesComponent)
      },
      {
        path: 'conges/validation',
        loadComponent: () =>
          import('./conges/validation/validation')
          .then(m => m.ValidationComponent)
      },
      {
        path: 'messagerie',
        loadComponent: () =>
          import('./messagerie/messagerie').then(m => m.MessagerieComponent)
      },
      {
        path: 'profil',
        loadComponent: () =>
          import('./profil/profil').then(m => m.ProfilComponent)
      },

      // ✅ Les deux routes pointent vers utilisateurs/ (avec s)
      {
        path: 'utilisateurs',
        loadComponent: () =>
          import('./utilisateurs/liste-utilisateurs/liste-utilisateurs')
          .then(m => m.ListeUtilisateursComponent)
      },
      {
        path: 'utilisateurs/nouveau',
        loadComponent: () =>
          import('./utilisateurs/nouvel-utilisateurs/nouvel-utilisateur')
          .then(m => m.NouvelUtilisateurComponent)
      },

      {
        path: 'services',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'rh'] },
        loadComponent: () =>
          import('./services-rh/liste-services/liste-services')
          .then(m => m.ListeServices)
      },
      {
        path: 'services/nouveau',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'rh'] },
        loadComponent: () =>
          import('./services-rh/service-form/service-form')
          .then(m => m.ServiceFormComponent)
      },
      {
        path: 'services/:id/modifier',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'rh'] },
        loadComponent: () =>
          import('./services-rh/service-form/service-form')
          .then(m => m.ServiceFormComponent)
      },

      {
        path: 'roles',
        loadComponent: () =>
          import('./roles/liste-roles/liste-roles')
          .then(m => m.ListeRolesComponent)
      },
      {
        path: 'roles/nouveau',
        loadComponent: () =>
          import('./roles/role-form/role-form')
          .then(m => m.RoleFormComponent)
      },
      {
        path: 'roles/:id/modifier',
        loadComponent: () =>
          import('./roles/role-form/role-form')
          .then(m => m.RoleFormComponent)
      },

      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'departements',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'rh'] },
        loadComponent: () =>
          import('./departements/liste-departements/liste-departements')
          .then(m => m.ListeDepartementsComponent)
      },
      {
        path: 'departements/nouveau',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'rh'] },
        loadComponent: () =>
          import('./departements/ajout-departement/ajout-departement')
          .then(m => m.DepartementFormComponent)
      },
      {
        path: 'departements/:id/modifier',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'rh'] },
        loadComponent: () =>
          import('./departements/ajout-departement/ajout-departement')
          .then(m => m.DepartementFormComponent)
      }
    ]
  },

  { path: '**', redirectTo: 'login' }
];