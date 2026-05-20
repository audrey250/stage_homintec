// ============================================================
// FICHIER : src/app/services/demande.service.ts
// RÔLE    : Service UNIQUE pour toutes les demandes de congé
//           Remplace conge.service.ts ET validation.service.ts
//
// WORKFLOW HIÉRARCHIQUE :
//   Étape 1 → Manager valide EN PREMIER (obligatoire)
//   Étape 2 → RH peut valider SEULEMENT si Manager a validé
//   Étape 3 → Admin peut confirmer SEULEMENT si RH a validé
//
// Un seul signal _demandes partagé entre tous les composants
// ============================================================

import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';

const API_URL = 'http://192.168.1.142:8080/api';

// ============================================================
// INTERFACES
// ============================================================

// Statuts possibles d'une demande ou d'une étape
export type StatutDemande = 'en_attente' | 'valide' | 'refuse' | 'annule' | 'expire';

// Types de congé
export type TypeDemande =
  | 'conge_annuel'
  | 'conge_maladie'
  | 'conge_maternite'
  | 'permission'
  | 'autre';

// ---- Étape de validation dans le workflow hiérarchique ----
export interface EtapeValidation {
  ordre:        number;          // 1=Manager, 2=RH, 3=Admin
  role:         string;          // Rôle requis pour cette étape
  valideurId:   number | null;   // null = pas encore traité
  valideurNom:  string | null;
  statut:       'en_attente' | 'valide' | 'refuse';
  commentaire:  string | null;
  dateDecision: string | null;
}

// ---- Interface principale d'une demande ----
// Correspond exactement au JSON renvoyé par Spring Boot
export interface Demande {
  id:            number;
  employeId:     number;
  nom:    string;
  prenom: string;
  departement:   string;
  typeDemande:      TypeDemande;
  dateDebut:     string;       // Format ISO : "2024-02-01"
  dateFin:       string;
  nbJours:       number;
  motif:         string;
  urgence:       boolean;
  // Statut global de la demande (calculé depuis les étapes)
  statut:        StatutDemande;
  dateCreation:  string;
  // Étapes du workflow hiérarchique
  // [0] = Manager, [1] = RH, [2] = Admin (optionnel)
  etapes:        EtapeValidation[];
}

// ---- Ce qu'on envoie pour créer une demande ----
// On n'envoie pas id, statut, etapes (générés par Spring Boot)
export interface NouvelleDemande {
  type:      TypeDemande;
  dateDebut: string;
  dateFin:   string;
  nbJours:   number;
  motif:     string;
  urgence:   boolean;
}

// ---- Ce qu'on envoie pour valider ou rejeter ----
export interface DecisionDemande {
  statut:      'valide' | 'refuse';
  commentaire: string;
}

// ============================================================
// SERVICE
// ============================================================

@Injectable({ providedIn: 'root' })
export class DemandeService {

  // Signal unique partagé par TOUS les composants
  // nouvelle-demande, mes-demandes, validation, dashboard
  // lisent tous ce même signal → cohérence garantie
  private _demandes = signal<Demande[]>([]);
  demandes          = this._demandes.asReadonly();

  private _loading = signal(false);
  loading          = this._loading.asReadonly();

  private _erreur = signal('');
  erreur          = this._erreur.asReadonly();

  constructor(private http: HttpClient) {}

  // ============================================================
  // PARTIE 1 — EMPLOYÉ : soumettre et consulter ses demandes
  // ============================================================

  // Charger MES demandes (employé connecté)
  // GET /api/demandes/mes-demandes
  // Spring Boot filtre par le userId du token JWT
  chargerMesDemandes(): void {
    this._loading.set(true);
    this._erreur.set('');

    this.http
      .get<Demande[]>(`${API_URL}/demandes/mes-demandes`)
      .pipe(
        tap((data) => {
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

  // Soumettre une nouvelle demande
  // POST /api/demandes
  // Spring Boot crée automatiquement les étapes de validation
  soumettre(data: NouvelleDemande): Observable<Demande> {
    return this.http
      .post<Demande>(`${API_URL}/demandes`, data)
      .pipe(
        tap((nouvelle) => {
          // Ajoute au début de la liste — visible immédiatement
          this._demandes.update(liste => [nouvelle, ...liste]);
        }),
        catchError((err: HttpErrorResponse) => throwError(() => err))
      );
  }

  // Annuler une demande en attente (seulement si statut = en_attente)
  // DELETE /api/demandes/:id
  // Spring Boot vérifie que la demande appartient bien à cet employé
  annuler(id: number): Observable<void> {
    return this.http
      .delete<void>(`${API_URL}/demandes/${id}`)
      .pipe(
        tap(() => {
          // Retire du cache local sans recharger
          this._demandes.update(liste =>
            liste.filter(d => d.id !== id)
          );
        }),
        catchError((err: HttpErrorResponse) => throwError(() => err))
      );
  }

  // ============================================================
  // PARTIE 2 — MANAGER/RH/ADMIN : consulter et décider
  // ============================================================

  // Charger TOUTES les demandes en attente de validation
  // GET /api/demandes/en-attente
  // Spring Boot filtre selon le rôle du token JWT :
  //   - Manager → voit les demandes où l'étape 1 est en attente
  //   - RH → voit les demandes où l'étape 1 est validée ET étape 2 en attente
  //   - Admin → voit les demandes où étapes 1+2 sont validées
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
          this._erreur.set('Impossible de charger les demandes.');
          return throwError(() => err);
        })
      )
      .subscribe();
  }

  // Charger l'historique complet (toutes les demandes traitées)
  // GET /api/demandes
  // Accessible : RH, Admin
  chargerTout(): void {
    this._loading.set(true);
    this._erreur.set('');

    this.http
      .get<Demande[]>(`${API_URL}/demandes`)
      .pipe(
        tap((data) => {
          this._demandes.set(data);
          this._loading.set(false);
        }),
        catchError((err: HttpErrorResponse) => {
          this._loading.set(false);
          this._erreur.set('Impossible de charger les demandes.');
          return throwError(() => err);
        })
      )
      .subscribe();
  }

  // ---- VALIDER OU REJETER ----
  // PUT /api/demandes/:id/decision
  //
  // ⚠️ RÈGLE CRITIQUE gérée par Spring Boot :
  // - Vérifie que le rôle du token correspond à l'étape en cours
  // - Vérifie que toutes les étapes PRÉCÉDENTES sont validées
  // - Si Manager n'a pas validé → RH reçoit 403 Forbidden
  decider(
    id: number,
    decision: DecisionDemande
  ): Observable<Demande> {
    return this.http
      .put<Demande>(`${API_URL}/demandes/${id}/decision`, decision)
      .pipe(
        tap((updated) => {
          // Met à jour SEULEMENT cette demande dans le cache
          // tous les autres composants qui lisent demandes()
          // voient immédiatement le nouveau statut
          this._demandes.update(liste =>
            liste.map(d => d.id === id ? updated : d)
          );
        }),
        catchError((err: HttpErrorResponse) => throwError(() => err))
      );
  }

  // ============================================================
  // PARTIE 3 — LOGIQUE DU WORKFLOW (calculs locaux)
  // Pas d'appel HTTP — travaille sur le cache local
  // ============================================================

  // L'utilisateur peut-il agir sur cette demande ?
  // Vérifie : bon rôle + étapes précédentes validées
  peutDecider(demande: Demande, roleUtilisateur: string): boolean {

    // Demande déjà terminée → personne ne peut agir
    if (demande.statut !== 'en_attente') return false;

    // On cherche l'étape correspondant à ce rôle
    const monEtape = demande.etapes.find(
      e => e.role === roleUtilisateur
    );

    // Ce rôle n'est pas dans le workflow → ne peut pas agir
    if (!monEtape) return false;

    // Cette étape est déjà traitée → ne peut plus agir
    if (monEtape.statut !== 'en_attente') return false;

    // ⚠️ RÈGLE CLEF : toutes les étapes d'ordre inférieur
    // doivent être au statut 'valide' (pas 'en_attente', pas 'refuse')
    const etapesPrecedentes = demande.etapes.filter(
      e => e.ordre < monEtape.ordre
    );

    return etapesPrecedentes.every(e => e.statut === 'valide');
  }

  // Explication lisible du blocage
  raisonBlocage(demande: Demande, roleUtilisateur: string): string {

    if (demande.statut === 'refuse') return 'Demande rejetée.';
    if (demande.statut === 'valide') return 'Demande déjà approuvée.';
    if (demande.statut === 'annule') return 'Demande annulée par l\'employé.';

    const monEtape = demande.etapes.find(e => e.role === roleUtilisateur);
    if (!monEtape) return 'Vous n\'êtes pas concerné par cette validation.';
    if (monEtape.statut === 'valide') return 'Vous avez déjà approuvé.';
    if (monEtape.statut === 'refuse') return 'Vous avez déjà rejeté.';

    // Quelle étape précédente bloque ?
    const bloquante = demande.etapes
      .filter(e => e.ordre < monEtape.ordre)
      .find(e => e.statut === 'en_attente');

    if (bloquante) {
      const labels: Record<string, string> = {
        manager: 'le Manager',
        rh:      'le Responsable RH',
        admin:   'l\'Administrateur'
      };
      return `En attente de ${labels[bloquante.role] ?? bloquante.role}.`;
    }

    return 'En attente.';
  }

  // ============================================================
  // PARTIE 4 — HELPERS DE FILTRAGE ET AFFICHAGE
  // ============================================================

  // Filtre les demandes par statut global
  getParStatut(statut: string): Demande[] {
    if (statut === 'tous') return this._demandes();
    return this._demandes().filter(d => d.statut === statut);
  }

  // Demandes en attente de l'action d'un rôle spécifique
  getEnAttentePour(role: string): Demande[] {
    return this._demandes().filter(
      d => this.peutDecider(d, role)
    );
  }

  // Compte pour le badge dans la sidebar
  nbEnAttentePour(role: string): number {
    return this.getEnAttentePour(role).length;
  }

  // Statut de l'étape d'un rôle donné pour affichage
  statutEtapePour(demande: Demande, role: string): string {
    return demande.etapes.find(e => e.role === role)?.statut ?? 'non_concerne';
  }

  // Couleur Bootstrap selon statut
  couleurStatut(statut: string): string {
    const map: Record<string, string> = {
      en_attente:   'warning',
      valide:       'success',
      refuse:       'danger',
      annule:       'secondary',
      expire:       'dark',
      non_concerne: 'secondary'
    };
    return map[statut] ?? 'secondary';
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

  // Libellé lisible du statut global
  libelleStatut(statut: string): string {
    const map: Record<string, string> = {
      en_attente: 'En attente',
      valide:     'Approuvé',
      refuse:     'Rejeté',
      annule:     'Annulé',
      expire:     'Expiré'
    };
    return map[statut] ?? statut;
  }
}