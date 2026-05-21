// ============================================================
// FICHIER : src/app/services/demande.service.ts
// VERSION ADAPTÉE À TON BACKEND SPRING BOOT
// Workflow : Responsable → Chef département → RH
// ============================================================

import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

const API_URL = environment.apiUrl;

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

  utilisateurId?: string;
  utilisateurNom?: string;
  utilisateurPrenom?: string;

  nom?: string;
  prenom?: string;
}

export interface DecisionDemande {
  statut: 'APPROUVE' | 'REFUSE';
  commentaire: string;
  validateurId?: string;
}

export interface NouvelleDemandePayload {
  typeDemande: 'CONGE' | 'PERMISSION';
  dateDebut: string;
  dateFin: string;
  motif: string;
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
  // CRÉER UNE DEMANDE
  // POST /api/demandes
  // ============================================================

  creerDemande(payload: NouvelleDemandePayload): Observable<Demande> {
    return this.http
      .post<Demande>(`${API_URL}/demandes`, payload)
      .pipe(
        tap((created) => {
          this._demandes.update(liste => [created, ...liste]);
        }),
        catchError((err: HttpErrorResponse) => {
          return throwError(() => err);
        })
      );
  }

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

          this._demandes.set(data);

          this._loading.set(false);
        }),

        catchError((err: HttpErrorResponse) => {

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

    return this.http
      .put<Demande>(url, decision)
      .pipe(

        tap((updated) => {
          this._demandes.update(liste =>
            liste.map(d =>
              d.id === id ? updated : d
            )
          );
        }),

        catchError((err: HttpErrorResponse) => {
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
    const url = `${API_URL}/demandes/${id}/valider-chef-departement`;

    return this.http
      .put<Demande>(url, decision)
      .pipe(

        tap((updated) => {
          this._demandes.update(liste =>
            liste.map(d =>
              d.id === id ? updated : d
            )
          );
        }),

        catchError((err: HttpErrorResponse) => {
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
    const url = `${API_URL}/demandes/${id}/valider-rh`;

    return this.http
      .put<Demande>(url, decision)
      .pipe(

        tap((updated) => {
          this._demandes.update(liste =>
            liste.map(d =>
              d.id === id ? updated : d
            )
          );
        }),

        catchError((err: HttpErrorResponse) => {
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
  .toUpperCase()
  .trim();

    // ---------------- RESPONSABLE ----------------

    if (role === 'RESPONSABLE') {

      return demande.statut === 'EN_ATTENTE';
    }

    if (
      role === 'CHEF DÉPARTEMENT'
    ) {

      return (
        demande.statut === 'APPROUVEE_RESPONSABLE'
      );
    }

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
  .toUpperCase()
  .trim();
    // ---------------- RESPONSABLE ----------------

    if (
      role === 'RESPONSABLE'
      && demande.statut !== 'EN_ATTENTE'
    ) {

      return 'Déjà traitée.';
    }

    // ---------------- CHEF DEPARTEMENT ----------------

    if (
      (
        role === 'CHEF DÉPARTEMENT'
        
      )
      &&
      demande.statut !== 'APPROUVEE_RESPONSABLE'
    ) {

      return 'En attente du responsable.';
    }

    // ---------------- RH ----------------

    if (
      role === 'RH'
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