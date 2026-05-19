// ============================================================
// src/app/services/departement.service.ts
// RÔLE : Gère les appels HTTP pour les départements
// ============================================================

import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

const API_URL = environment.apiUrl;

// Interface d'un département
// Correspond exactement à ce que Spring Boot renvoie
export interface Departement {
  id:          string;
  nom:         string;
  description: string;
  nbServices?: number;
  dateCreation?: string;
}

// Ce qu'on envoie pour créer/modifier un département
// On n'envoie pas id (généré par Spring Boot) ni nbEmployes (calculé)
export interface DepartementForm {
  nom:         string;
  description: string;
}

@Injectable({ providedIn: 'root' })
export class DepartementService {

  // Signal contenant la liste des départements
  // [] = vide au départ, sera rempli par chargerTout()
  private _departements = signal<Departement[]>([]);
  departements = this._departements.asReadonly();

  // Signal pour l'état de chargement
  private _loading = signal(false);
  loading = this._loading.asReadonly();

  // Signal pour les erreurs
  private _erreur = signal('');
  erreur = this._erreur.asReadonly();

  constructor(private http: HttpClient) {}

  // ──────────────────────────────────────────────────
  // GET /api/departements
  // Charge tous les départements depuis Spring Boot
  // Appelé au ngOnInit() du composant liste
  // ──────────────────────────────────────────────────
  chargerTout(): void {
    this._loading.set(true);
    this._erreur.set('');

    this.http.get<Departement[]>(`${API_URL}/departements`)
      .pipe(
        tap((data) => {
          // On met à jour le signal avec les données reçues
          this._departements.set(data);
          this._loading.set(false);
        }),
        catchError((err: HttpErrorResponse) => {
          this._loading.set(false);
          this._erreur.set('Impossible de charger les départements.');
          return throwError(() => err);
        })
      )
      .subscribe();
  }

  // ──────────────────────────────────────────────────
  // GET /api/departements/:id
  // Récupère un seul département (pour le formulaire d'édition)
  // Retourne un Observable car le composant doit réagir
  // ──────────────────────────────────────────────────
  getById(id: string): Observable<Departement> {
    return this.http.get<Departement>(`${API_URL}/departements/${id}`)
      .pipe(
        catchError((err: HttpErrorResponse) => throwError(() => err))
      );
  }

  // ──────────────────────────────────────────────────
  // POST /api/departements
  // Crée un nouveau département
  // Spring Boot renvoie le département créé avec son id
  // ──────────────────────────────────────────────────
  creer(data: DepartementForm): Observable<Departement> {
    return this.http.post<Departement>(`${API_URL}/departements`, data)
      .pipe(
        tap((nouveau) => {
          // On ajoute le nouveau département au signal sans recharger toute la liste
          this._departements.update(liste => [...liste, { ...nouveau, nbServices: 0 }]);
        }),
        catchError((err: HttpErrorResponse) => throwError(() => err))
      );
  }

  // ──────────────────────────────────────────────────
  // PUT /api/departements/:id
  // Modifie un département existant
  // ──────────────────────────────────────────────────
  modifier(id: string, data: DepartementForm): Observable<Departement> {
    return this.http.put<Departement>(`${API_URL}/departements/${id}`, data)
      .pipe(
        tap((modifie) => {
          // On remplace le département modifié dans le signal
          this._departements.update(liste =>
            liste.map((d: Departement) =>
              d.id === id ? { ...modifie, nbServices: d.nbServices ?? 0 } : d
            )
          );
        }),
        catchError((err: HttpErrorResponse) => throwError(() => err))
      );
  }

  // ──────────────────────────────────────────────────
  // DELETE /api/departements/:id
  // Supprime un département
  // ──────────────────────────────────────────────────
  supprimer(id: string): Observable<void> {
    return this.http.delete<void>(`${API_URL}/departements/${id}`)
      .pipe(
        tap(() => {
          // On retire le département supprimé du signal
          this._departements.update(liste =>
            liste.filter((d: Departement) => d.id !== id)
          );
        }),
        catchError((err: HttpErrorResponse) => throwError(() => err))
      );
  }

  // Vérifie si un nom de département existe déjà (validation locale)
  nomExiste(nom: string, idExclu?: string): boolean {
    return this._departements().some((d: Departement) =>
      d.nom.toLowerCase() === nom.toLowerCase() &&
      d.id !== idExclu
    );
  }
}