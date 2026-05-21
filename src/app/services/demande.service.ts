// ============================================================
// FICHIER : src/app/services/demande.service.ts
// VERSION ADAPTÉE À TON BACKEND SPRING BOOT
// Workflow : Responsable → Chef département → RH
// ============================================================

import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';

const API_URL = 'http://192.168.1.142:8080/api';

// ============================================================
// TYPES
// ============================================================

export type StatutDemande =
  | 'EN_ATTENTE'
  | 'APPROUVEE_RESPONSABLE'
  | 'REFUSEE_RESPONSABLE'
  | 'APPROUVEE_CHEF_DEPARTEMENT'
  | 'REFUSEE_CHEF_DEPARTEMENT'
  | 'APPROUVEE_RH'
  | 'REFUSEE_RH';

export interface Demande {

  id: string;

  typeDemande: string;

  dateDebut: string;
  dateFin: string;

  motif: string;

  dateDemande: string;

  statut: StatutDemande;

  utilisateur?: {
    id: string;
    nom: string;
    prenom: string;
    email?: string;
  };

  nom?: string;
  prenom?: string;
}

export interface DecisionDemande {
  statut: 'APPROUVE' | 'REFUSE';
  commentaire: string;
}

@Injectable({
  providedIn: 'root'
})

export class DemandeService {

  // ============================================================
  // SIGNALS
  // ============================================================

  private _demandes = signal<Demande[]>([]);
  demandes = this._demandes.asReadonly();

  private _loading = signal(false);
  loading = this._loading.asReadonly();

  private _erreur = signal('');
  erreur = this._erreur.asReadonly();

  constructor(private http: HttpClient) {}

  // ============================================================
  // CHARGER LES DEMANDES EN ATTENTE
  // ============================================================

  chargerEnAttente(): void {

    this._loading.set(true);
    this._erreur.set('');

    this.http
      .get<Demande[]>(`${API_URL}/demandes/en-attente`)
      .pipe(

        tap((data) => {

          console.log('Demandes reçues :', data);

          this._demandes.set(data);

          this._loading.set(false);
        }),

        catchError((err: HttpErrorResponse) => {

          console.error('Erreur chargement :', err);

          this._loading.set(false);

          this._erreur.set(
            'Impossible de charger les demandes.'
          );

          return throwError(() => err);
        })
      )
      .subscribe();
  }

  // ============================================================
  // RESPONSABLE
  // PUT /api/demandes/{id}/responsable
  // ============================================================

  validerParResponsable(
    id: string,
    decision: DecisionDemande
  ): Observable<Demande> {
    const url = `${API_URL}/demandes/${id}/valider-responsable`;
    console.log('📤 PUT vers:', url);
    console.log('📋 Body:', decision);

    return this.http
      .put<Demande>(url, decision)
      .pipe(

        tap((updated) => {
          console.log('✅ Validation responsable réussie');
          this._demandes.update(liste =>
            liste.map(d =>
              d.id === id ? updated : d
            )
          );
        }),

        catchError((err: HttpErrorResponse) => {
          console.error('❌ Erreur validation responsable :', {
            status: err.status,
            statusText: err.statusText,
            url: err.url,
            message: err.error?.message || err.error?.detail || 'Erreur inconnue',
            fullError: err
          });
          return throwError(() => err);
        })
      );
  }

  // ============================================================
  // CHEF DEPARTEMENT
  // PUT /api/demandes/{id}/chef-departement
  // ============================================================

  validerParChefDepartement(
    id: string,
    decision: DecisionDemande
  ): Observable<Demande> {
    const url = `${API_URL}/demandes/${id}/chef-departement`;
    console.log('📤 PUT vers:', url);
    console.log('📋 Body:', decision);

    return this.http
      .put<Demande>(url, decision)
      .pipe(

        tap((updated) => {
          console.log('✅ Validation chef département réussie');
          this._demandes.update(liste =>
            liste.map(d =>
              d.id === id ? updated : d
            )
          );
        }),

        catchError((err: HttpErrorResponse) => {
          console.error('❌ Erreur validation département :', {
            status: err.status,
            statusText: err.statusText,
            url: err.url,
            message: err.error?.message || err.error?.detail || 'Erreur inconnue'
          });
          return throwError(() => err);
        })
      );
  }

  // ============================================================
  // RH
  // PUT /api/demandes/{id}/rh
  // ============================================================

  validerParRH(
    id: string,
    decision: DecisionDemande
  ): Observable<Demande> {
    const url = `${API_URL}/demandes/${id}/rh`;
    console.log('📤 PUT vers:', url);
    console.log('📋 Body:', decision);

    return this.http
      .put<Demande>(url, decision)
      .pipe(

        tap((updated) => {
          console.log('✅ Validation RH réussie');
          this._demandes.update(liste =>
            liste.map(d =>
              d.id === id ? updated : d
            )
          );
        }),

        catchError((err: HttpErrorResponse) => {
          console.error('❌ Erreur validation RH :', {
            status: err.status,
            statusText: err.statusText,
            url: err.url,
            message: err.error?.message || err.error?.detail || 'Erreur inconnue'
          });
          return throwError(() => err);
        })
      );
  }

  // ============================================================
  // PEUT DÉCIDER ?
  // ============================================================

  peutDecider(
    demande: Demande,
    roleUtilisateur: string
  ): boolean {

    const role = roleUtilisateur
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

    // ---------------- RESPONSABLE ----------------

    if (role === 'responsable') {

      return demande.statut === 'EN_ATTENTE';
    }

    // ---------------- CHEF DEPARTEMENT ----------------

    if (
      role === 'chef département'
    ) {

      return (
        demande.statut === 'APPROUVEE_RESPONSABLE'
      );
    }

    // ---------------- RH ----------------

    if (role === 'RH') {

      return (
        demande.statut ===
        'APPROUVEE_CHEF_DEPARTEMENT'
      );
    }

    return false;
  }

  // ============================================================
  // MESSAGE SI BLOQUÉ
  // ============================================================

  raisonBlocage(
    demande: Demande,
    roleUtilisateur: string
  ): string {

 const role = roleUtilisateur
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();
    // ---------------- RESPONSABLE ----------------

    if (
      role === 'responsable'
      && demande.statut !== 'EN_ATTENTE'
    ) {

      return 'Déjà traitée.';
    }

    // ---------------- CHEF DEPARTEMENT ----------------

    if (
      (
        role === 'chef département'
        
      )
      &&
      demande.statut !== 'APPROUVEE_RESPONSABLE'
    ) {

      return 'En attente du responsable.';
    }

    // ---------------- RH ----------------

    if (
      role === 'rh'
      &&
      demande.statut !==
      'APPROUVEE_CHEF_DEPARTEMENT'
    ) {

      return 'En attente du chef département.';
    }

    return '';
  }

  // ============================================================
  // HELPERS UI
  // ============================================================

  libelleStatut(statut: string): string {

    const map: Record<string, string> = {

      EN_ATTENTE:
        'En attente',

      APPROUVEE_RESPONSABLE:
        'Approuvée par Responsable',

      REFUSEE_RESPONSABLE:
        'Refusée par Responsable',

      APPROUVEE_CHEF_DEPARTEMENT:
        'Approuvée par Chef Département',

      REFUSEE_CHEF_DEPARTEMENT:
        'Refusée par Chef Département',

      APPROUVEE_RH:
        'Approuvée par RH',

      REFUSEE_RH:
        'Refusée par RH'
    };

    return map[statut] ?? statut;
  }

  // ============================================================
  // COULEUR BADGE
  // ============================================================

  couleurStatut(statut: string): string {

    const map: Record<string, string> = {

      EN_ATTENTE:
        'warning',

      APPROUVEE_RESPONSABLE:
        'info',

      APPROUVEE_CHEF_DEPARTEMENT:
        'primary',

      APPROUVEE_RH:
        'success',

      REFUSEE_RESPONSABLE:
        'danger',

      REFUSEE_CHEF_DEPARTEMENT:
        'danger',

      REFUSEE_RH:
        'danger'
    };

    return map[statut] ?? 'secondary';
  }
  // ============================================================
// MÉTHODES MANQUANTES — à ajouter dans DemandeService
// ============================================================

// Charger les demandes de l'employé connecté
// GET /api/demandes/mes-demandes
chargerMesDemandes(): void {
  this._loading.set(true);
  this._erreur.set('');

  this.http
    .get<Demande[]>(`${API_URL}/demandes/mes-demandes`)
    .pipe(
      tap((data) => {
        console.log('Mes demandes :', data);
        this._demandes.set(data);
        this._loading.set(false);
      }),
      catchError((err: HttpErrorResponse) => {
        this._loading.set(false);
        this._erreur.set('Impossible de charger vos demandes.');
        return throwError(() => err);
      })
    )
    .subscribe();
}

// Annuler une demande
// DELETE /api/demandes/:id
annuler(id: string): Observable<void> {
  return this.http
    .delete<void>(`${API_URL}/demandes/${id}`)
    .pipe(
      tap(() => {
        this._demandes.update(liste =>
          liste.filter(d => d.id !== id)
        );
      }),
      catchError((err: HttpErrorResponse) =>
        throwError(() => err)
      )
    );
}

// Libellé lisible du type de demande
libelleType(type: string): string {
  const map: Record<string, string> = {
    conge_annuel:    'Congé annuel',
    conge_maladie:   'Congé maladie',
    conge_maternite: 'Congé maternité',
    permission:      'Permission',
    autre:           'Autre'
  };
  return map[type] ?? type;
}


}