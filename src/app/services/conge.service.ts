// ============================================================
// src/app/services/conge.service.ts
// VERSION SPRING BOOT — source unique de vérité pour les congés
// ============================================================

import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';

const API_URL = 'http://localhost:8080/api';

// ---- Types stricts ----
export type StatutDemande = 'en_attente' | 'approuve' | 'rejete';
export type TypeDemande   =
  | 'conge_annuel' | 'conge_maladie'
  | 'conge_maternite' | 'permission' | 'autre';

// ---- Interface principale : correspond au JSON Spring Boot ----
export interface Demande {
  id:                    number;
  employeId:             number;
  employe:               string;   // "Prénom Nom" formaté côté serveur
  departement:           string;
  type:                  string;
  dateDebut:             string;
  dateFin:               string;
  jours:                 number;
  motif:                 string;
  urgence:               boolean;
  statut:                StatutDemande;
  dateCreation:          string;
  commentaireValidateur?: string;
}

// ---- Corps envoyé pour soumettre une demande ----
export interface NouvelleDemande {
  type:      string;
  dateDebut: string;
  dateFin:   string;
  jours:     number;
  motif:     string;
  urgence:   boolean;
}

// ---- Corps envoyé pour valider/rejeter ----
export interface DecisionDemande {
  statut:      'approuve' | 'rejete';
  commentaire: string;
}

@Injectable({ providedIn: 'root' })
export class CongeService {

  // Cache local — partagé entre validation.ts et mes-demandes.ts
  private _demandes = signal<Demande[]>([]);
  demandes          = this._demandes.asReadonly();

  private _loading = signal(false);
  loading          = this._loading.asReadonly();

  private _erreur = signal('');
  erreur          = this._erreur.asReadonly();

  constructor(private http: HttpClient) {}

  // ============================================================
  // CHARGER TOUTES LES DEMANDES (manager / RH / admin)
  // GET /api/demandes
  // ============================================================
  chargerTout(): Observable<Demande[]> {
    this._loading.set(true);
    this._erreur.set('');
    return this.http.get<Demande[]>(`${API_URL}/demandes`).pipe(
      tap((data) => {
        this._demandes.set(data);
        this._loading.set(false);
      }),
      catchError((err) => {
        this._loading.set(false);
        this._erreur.set('Impossible de charger les demandes.');
        return throwError(() => err);
      })
    );
  }

  // ============================================================
  // CHARGER MES DEMANDES (employé connecté)
  // GET /api/demandes/mes-demandes
  // ============================================================
  chargerMesDemandes(): Observable<Demande[]> {
    this._loading.set(true);
    this._erreur.set('');
    return this.http
      .get<Demande[]>(`${API_URL}/demandes/mes-demandes`)
      .pipe(
        tap((data) => {
          this._demandes.set(data);
          this._loading.set(false);
        }),
        catchError((err) => {
          this._loading.set(false);
          this._erreur.set('Impossible de charger vos demandes.');
          return throwError(() => err);
        })
      );
  }

  // ============================================================
  // SOUMETTRE UNE DEMANDE
  // POST /api/demandes
  // ============================================================
  soumettre(data: NouvelleDemande): Observable<Demande> {
    return this.http
      .post<Demande>(`${API_URL}/demandes`, data)
      .pipe(
        tap((nouvelle) => {
          this._demandes.update(list => [nouvelle, ...list]);
        }),
        catchError((err) => throwError(() => err))
      );
  }

  // ============================================================
  // VALIDER OU REJETER (manager / RH / admin)
  // PUT /api/demandes/:id/decision
  // ============================================================
  decider(id: number, decision: DecisionDemande): Observable<Demande> {
    return this.http
      .put<Demande>(`${API_URL}/demandes/${id}/decision`, decision)
      .pipe(
        tap((updated) => {
          // Met à jour seulement cette demande dans le cache
          this._demandes.update(list =>
            list.map(d => d.id === id ? updated : d)
          );
        }),
        catchError((err) => throwError(() => err))
      );
  }

  // ============================================================
  // ANNULER UNE DEMANDE EN ATTENTE (employé)
  // DELETE /api/demandes/:id
  // ============================================================
  annuler(id: number): Observable<void> {
    return this.http
      .delete<void>(`${API_URL}/demandes/${id}`)
      .pipe(
        tap(() => {
          this._demandes.update(list =>
            list.filter(d => d.id !== id)
          );
        }),
        catchError((err) => throwError(() => err))
      );
  }

  // ---- Helpers sur le cache local ----
  getEnAttente(): Demande[] {
    return this._demandes().filter(d => d.statut === 'en_attente');
  }

  getTraitees(): Demande[] {
    return this._demandes().filter(d => d.statut !== 'en_attente');
  }
}