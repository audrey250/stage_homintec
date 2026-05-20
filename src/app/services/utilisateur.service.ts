// ============================================================
// src/app/services/utilisateur.service.ts
// ============================================================

import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { User } from './auth.service';

const API_URL = 'http://192.168.1.142:8080/api';

// Omit<User, 'id' | 'premiereCo'> = tous les champs sauf id et premiereCo
// Spring Boot génère l'id et met premiereCo à true automatiquement
export type NouvelUtilisateur = {
  prenom: string;
  nom: string;
  email: string;
  poste: string;
  serviceId?: string | number;
  roleId?: string | number;
  departementId?: number;

};

@Injectable({ providedIn: 'root' })
export class UtilisateurService {

  private _utilisateurs = signal<User[]>([]);
  utilisateurs          = this._utilisateurs.asReadonly();

  private _loading = signal(false);
  loading          = this._loading.asReadonly();

  private _erreur = signal('');
  erreur          = this._erreur.asReadonly();

  constructor(private http: HttpClient) {}

  // ---- GET /api/utilisateurs ----
  chargerTout(): void {
    this._loading.set(true);
    this._erreur.set('');

    this.http.get<User[]>(`${API_URL}/utilisateurs`).pipe(
      tap((data) => {
        this._utilisateurs.set(data);
        this._loading.set(false);
      }),
      catchError((err) => {
        this._loading.set(false);
        this._erreur.set('Impossible de charger les utilisateurs.');
        return throwError(() => err);
      })
    ).subscribe();
  }

  // ---- POST /api/utilisateurs ----
  ajouter(data: NouvelUtilisateur): Observable<User> {
    const payload = {
      prenom: data.prenom,
      nom: data.nom,
      email: data.email,
      poste: data.poste,
      serviceId: data.serviceId ?? data.departementId,
      roleId: data.roleId
    };

    return this.http.post<User>(`${API_URL}/utilisateurs`, payload).pipe(
      tap((nouveau) => {
        // Spring Boot renvoie l'utilisateur créé avec son vrai id
        this._utilisateurs.update(liste => [...liste, nouveau]);
      }),
      catchError((err) => throwError(() => err))
    );
  }

  // ---- DELETE /api/utilisateurs/:id ----
  supprimer(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/utilisateurs/${id}`).pipe(
      tap(() => {
        this._utilisateurs.update(liste =>
          liste.filter((u: User) => u.id !== id)
        );
      }),
      catchError((err) => throwError(() => err))
    );
  }

  // ---- GET /api/utilisateurs/:id ----
  // Récupère un utilisateur par son ID (utile pour enrichir les demandes)
  getParId(id: number): Observable<User> {
    return this.http.get<User>(`${API_URL}/utilisateurs/${id}`).pipe(
      catchError((err) => {
        console.error(`Impossible de récupérer l'utilisateur ${id}:`, err);
        return throwError(() => err);
      })
    );
  }

  // ---- Vérification email locale (sur les données déjà chargées) ----
  // Pas besoin d'un appel HTTP séparé si la liste est déjà chargée
  emailExiste(email: string): boolean {
    return this._utilisateurs().some((u: User) => u.email === email);
  }
}