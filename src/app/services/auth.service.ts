import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';

export interface User {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  role: 'employe' | 'manager' | 'rh' | 'admin';
  departement: string;
  poste: string;
  soldeConges: number;
  soldePermissions: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {

  private _currentUser = signal<User | null>(null);
  currentUser = this._currentUser.asReadonly();

  // ---- Données temporaires (à remplacer par HTTP Spring Boot) ----
  private mockUsers: User[] = [
    {
      id: 1, nom: 'Koudjo', prenom: 'Ama',
      email: 'ama.koudjo@homintec.com',
      role: 'employe', departement: 'Technique',
      poste: 'Ingénieure', soldeConges: 18, soldePermissions: 3
    },
    {
      id: 2, nom: 'Agossou', prenom: 'Kofi',
      email: 'kofi.agossou@homintec.com',
      role: 'manager', departement: 'Technique',
      poste: 'Chef de projet', soldeConges: 20, soldePermissions: 5
    },
    {
      id: 3, nom: 'Dossou', prenom: 'Adjoa',
      email: 'adjoa.dossou@homintec.com',
      role: 'rh', departement: 'RH',
      poste: 'Responsable RH', soldeConges: 20, soldePermissions: 5
    },
    {
      id: 4, nom: 'Gbénou', prenom: 'Komi',
      email: 'komi.gbenou@homintec.com',
      role: 'admin', departement: 'Direction',
      poste: 'Directeur Général', soldeConges: 25, soldePermissions: 10
    },
    {
      id: 5, nom: 'Gbénou', prenom: 'Audrey',
      email: 'audrey.gbenou@homintec.com',
      role: 'employe', departement: 'Direction',
      poste: 'Secrétaire de Direction', soldeConges: 18, soldePermissions: 3
    },
  ];

  constructor(private router: Router) {
    const stored = localStorage.getItem('homintec_user');
    if (stored) {
      try {
        this._currentUser.set(JSON.parse(stored));
      } catch {
        localStorage.removeItem('homintec_user');
      }
    }
  }

  // Mot de passe commun pour tous les comptes de démo : homintec2024
  login(email: string, password: string): boolean {
    const user = this.mockUsers.find(u => u.email === email);
    if (user && password === 'homintec2024') {
      this._currentUser.set(user);
      localStorage.setItem('homintec_user', JSON.stringify(user));
      return true;
    }
    return false;
  }

  logout(): void {
    this._currentUser.set(null);
    localStorage.removeItem('homintec_user');
    this.router.navigate(['/login']);
  }

  isLoggedIn(): boolean { return !!this._currentUser(); }

  getToken(): string | null { return null; } // Sera le vrai JWT avec Spring Boot

  hasRole(...roles: string[]): boolean {
    const u = this._currentUser();
    return !!u && roles.includes(u.role);
  }
}