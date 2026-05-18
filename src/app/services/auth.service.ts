// ============================================================
// src/app/services/auth.service.ts
// ============================================================

import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { Observable, tap, catchError, throwError } from 'rxjs';
  
    const API_URL = environment.apiUrl;

export interface Role{
  id: number;
  nom:string;
}

export interface User {
  id:               number;
  nom:              string;
  prenom:           string;
  email:            string;
  Poste:             string;
  departementId:      number;
 statut_compte:'  innactif'|'actif'|'supprimer'|'en_attente';
telephone:number;
  premiereCo?:       boolean;
  role:Role;

}

export interface Notification {
  id:      number;
  contenu:string;
  date_envoi:    Date ;
  statut:    'lu' | 'non_lu' | 'envoyer'|'archive' | 'echec';
}

export interface LoginResponse {
  token: string;
  id:               number;
  nom:              string;
  prenom:           string;
  email:            string;
  Poste:             string;
  departementId:      number;
  telephone:number;
  statut_compte?:'  innactif'|'actif'|'supprimer'|'en_attente';
  premiereCo?:       boolean;
  role:Role;
}

@Injectable({ providedIn: 'root' })
export class AuthService {

  private _currentUser   = signal<User | null>(null);
  currentUser            = this._currentUser.asReadonly();

  private _notifications = signal<Notification[]>([]);
  notifications          = this._notifications.asReadonly();

  notifsNonLues          = signal(0);

  constructor(
    private http:   HttpClient,
    private router: Router
  ) {
    this.restaurerSession();
  }

  // ---- Restaurer la session au démarrage ----
  private restaurerSession(): void {
    const token   = localStorage.getItem('homintec_token');
    const userStr = localStorage.getItem('homintec_user');
    if (token && userStr) {
      try {
        this._currentUser.set(JSON.parse(userStr));
        this.chargerNotifications().subscribe();
      } catch {
        this.viderSession();
      }
    }
  }

  // ---- POST /api/auth/login ----
  login(email: string, motDePasse: string): Observable<any> {
    return this.http
      .post<any>(`${API_URL}/auth/login`, { email, motDePasse: motDePasse })
      .pipe(
        tap((res: LoginResponse) => {

          console.log("ok",res);
          
          const user: User = {
            id: res.id,
            nom: res.nom,
            prenom: res.prenom,
            email: res.email,
            Poste: res.Poste,
            departementId: res.departementId || 0,
            telephone:res.telephone,
            statut_compte:res.statut_compte||'actif',
            premiereCo: res.premiereCo || false,
            role:res.role,
          };

          localStorage.setItem('homintec_token', res.token);
          localStorage.setItem('homintec_user', JSON.stringify(user));
          this._currentUser.set(user);
          this.chargerNotifications().subscribe();
        }),
        catchError((err) => throwError(() => err))
      );
  }

  // ---- Déconnexion ----
  logout(): void {
    this.http.post(`${API_URL}/auth/logout`, {}).subscribe({
      error: () => {}
    });
    this.viderSession();
    this.router.navigate(['/login']);
  }

  private viderSession(): void {
    localStorage.removeItem('homintec_token');
    localStorage.removeItem('homintec_user');
    this._currentUser.set(null);
    this._notifications.set([]);
    this.notifsNonLues.set(0);
  }

  // ---- PUT /api/auth/changer-mot-de-passe ----
  changerMotDePasse(nouveauMdp: string): Observable<void> {
    return this.http
      .put<void>(`${API_URL}/auth/changer-mot-de-passe`, {
        nouveauMotDePasse: nouveauMdp
      })
      .pipe(
        tap(() => {
          const user = this._currentUser();
          if (user) {
            const updated = { ...user, premiereCo: false };
            this._currentUser.set(updated);
            localStorage.setItem('homintec_user', JSON.stringify(updated));
          }
        }),
        catchError((err) => throwError(() => err))
      );
  }

  // ---- GET /api/notifications ----
  chargerNotifications(): Observable<Notification[]> {
    return this.http
      .get<Notification[]>(`${API_URL}/notifications`)
      .pipe(
        tap((data) => {
          this._notifications.set(data);
          this.calculerNotifsNonLues();
        }),
        catchError((err) => throwError(() => err))
      );
  }

  // ---- PUT /api/notifications/:id/lu ----
  marquerLu(id: number): void {
    this.http.put(`${API_URL}/notifications/${id}/lu`, {}).subscribe(() => {
      this._notifications.update(liste =>
        liste.map(n => n.id === id ? { ...n, lu: true } : n)
      );
      this.calculerNotifsNonLues();
    });
  }

  // ---- PUT /api/notifications/tout-lire ----
  toutMarquerLu(): void {
    this.http.put(`${API_URL}/notifications/tout-lire`, {}).subscribe(() => {
      this._notifications.update(liste =>
        liste.map(n => ({ ...n, lu: true }))
      );
      this.notifsNonLues.set(0);
    });
  }

 private calculerNotifsNonLues(): void {
  this.notifsNonLues.set(
    this._notifications().filter(n => n.statut === 'non_lu' ).length
  );
}
  isLoggedIn(): boolean     { return !!this._currentUser(); }
  getToken(): string | null { return localStorage.getItem('homintec_token'); }

  hasRole(...roles: string[]): boolean {
    const u = this._currentUser();
    return !!u && roles.includes(u.role.nom);
  }
}