// ============================================================
// FICHIER : src/app/services/demande.service.ts
// ============================================================

import { Injectable, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

const API_URL = environment.apiUrl;

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
  utilisateur?: { id: string; nom: string; prenom: string; email?: string; };
  utilisateurId?: string;
  utilisateurNom?: string;
  utilisateurPrenom?: string;
  nom?: string;
  prenom?: string;
  // ---- Justificatif ----
  justificatifPath?:        string;
  justificatifNom?:         string;
  justificatifType?:        string;
  justificatifDateDepot?:   string;
  justificatifTelecharge?:  boolean;
  dateRetour?:              string;
}

export interface DecisionDemande {
  statut: 'APPROUVE' | 'REFUSE';
  commentaire: string;
  validateurId?: string;
  envoyerNotification?: boolean;
}

export interface NouvelleDemandePayload {
  typeDemande: string;
  dateDebut: string;
  dateFin: string;
  motif: string;
}

export interface ModificationDemandePayload {
  typeDemande: string;
  dateDebut: string;
  dateFin: string;
  motif: string;
}

// Solde initial par défaut (peut être surchargé par l'API)
const SOLDE_INITIAL = 30;

@Injectable({ providedIn: 'root' })
export class DemandeService {

  private _demandes = signal<Demande[]>([]);
  demandes = this._demandes.asReadonly();

  private _loading = signal(false);
  loading = this._loading.asReadonly();

  private _erreur = signal('');
  erreur = this._erreur.asReadonly();

  // ============================================================
  // SOLDE CONGÉS — calculé automatiquement depuis les demandes
  // ============================================================

  /**
   * Nombre de jours consommés = somme des jours de toutes les
   * demandes de type CONGE avec statut APPROUVEE_RH.
   */
  joursConsommes = computed(() => {
    return this._demandes()
      .filter(d =>
        (d.typeDemande === 'CONGE' || d.typeDemande === 'CONGE') &&
        d.statut === 'APPROUVEE_RH'
      )
      .reduce((total, d) => total + this.calculerJours(d.dateDebut, d.dateFin), 0);
  });

  /** Solde restant = 30 - jours consommés (jamais négatif) */
  soldeConges = computed(() =>
    Math.max(0, SOLDE_INITIAL - this.joursConsommes())
  );

  /** Nombre de demandes entièrement approuvées (APPROUVEE_RH) */
  congesApprouves = computed(() =>
    this._demandes().filter(d => d.statut === 'APPROUVEE_RH').length
  );

  /** Demandes en attente (tous statuts intermédiaires) */
  demandesEnAttente = computed(() =>
    this._demandes().filter(d =>
      d.statut === 'EN_ATTENTE' ||
      d.statut === 'APPROUVEE_RESPONSABLE' ||
      d.statut === 'APPROUVEE_CHEF_DEPARTEMENT'
    ).length
  );

  constructor(private http: HttpClient) {}

  // ============================================================
  // HELPERS CALCUL DE JOURS
  // ============================================================

  /**
   * Calcule le nombre de jours entre deux dates (inclusif).
   * Supporte les formats date ("2024-06-01") et
   * datetime ("2024-06-01T08:00").
   */
  calculerJours(dateDebut: string, dateFin: string): number {
    if (!dateDebut || !dateFin) return 0;
    const d1 = new Date(dateDebut);
    const d2 = new Date(dateFin);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
    // Normaliser à minuit pour éviter les décalages horaires
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);
    const diff = d2.getTime() - d1.getTime();
    if (diff < 0) return 0;
    return Math.round(diff / (1000 * 60 * 60 * 24)) + 1;
  }

  // ============================================================
  // CRÉER UNE DEMANDE
  // ============================================================
  creerDemande(payload: NouvelleDemandePayload): Observable<Demande> {
    return this.http.post<Demande>(`${API_URL}/demandes`, payload).pipe(
      tap(created => {
        this._demandes.update(list => [created, ...list]);
      }),
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }

  // ============================================================
  // MODIFIER UNE DEMANDE
  // ============================================================
  modifierDemande(id: string, payload: ModificationDemandePayload): Observable<Demande> {
    return this.http.put<Demande>(`${API_URL}/demandes/${id}`, payload).pipe(
      tap(updated => {
        this._demandes.update(list =>
          list.map(d => d.id === id ? updated : d)
        );
      }),
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }

  // ============================================================
  // CHARGER MES DEMANDES (employé)
  // ============================================================
  chargerMesDemandes(): void {
    this._loading.set(true);
    this._erreur.set('');

    this.http.get<Demande[]>(`${API_URL}/demandes/mes-demandes`).pipe(
      tap(data => {
        this._demandes.set(data);
        this._loading.set(false);
      }),
      catchError((err: HttpErrorResponse) => {
        this._loading.set(false);
        this._erreur.set('Impossible de charger vos demandes.');
        return throwError(() => err);
      })
    ).subscribe();
  }

  // ============================================================
  // CHARGER TOUTES LES DEMANDES (validation)
  // ============================================================
  chargerEnAttente(): void {
    this._loading.set(true);
    this._erreur.set('');

    this.http.get<Demande[]>(`${API_URL}/demandes`).pipe(
      tap(data => {
        this._demandes.set(data);
        this._loading.set(false);
      }),
      catchError((err: HttpErrorResponse) => {
        this._loading.set(false);
        this._erreur.set('Impossible de charger les demandes.');
        return throwError(() => err);
      })
    ).subscribe();
  }

  // ============================================================
  // ANNULER UNE DEMANDE
  // ============================================================
  annuler(id: string): Observable<void> {
    return this.http.delete<void>(`${API_URL}/demandes/${id}`).pipe(
      tap(() => {
        this._demandes.update(list => list.filter(d => d.id !== id));
      }),
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }

  // ============================================================
  // VALIDATION RESPONSABLE
  // ============================================================
  validerParResponsable(id: string, decision: DecisionDemande): Observable<Demande> {
    return this.http.put<Demande>(
      `${API_URL}/demandes/${id}/valider-responsable`,
      { ...decision, envoyerNotification: decision.statut === 'REFUSE' }
    ).pipe(
      tap(updated => {
        this._demandes.update(list => list.map(d => d.id === id ? updated : d));
      }),
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }

  // ============================================================
  // VALIDATION CHEF DÉPARTEMENT
  // ============================================================
  validerParChefDepartement(id: string, decision: DecisionDemande): Observable<Demande> {
    return this.http.put<Demande>(
      `${API_URL}/demandes/${id}/valider-chef-departement`,
      { ...decision, envoyerNotification: decision.statut === 'REFUSE' }
    ).pipe(
      tap(updated => {
        this._demandes.update(list => list.map(d => d.id === id ? updated : d));
      }),
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }

  // ============================================================
  // VALIDATION RH
  // ============================================================
  validerParRH(id: string, decision: DecisionDemande): Observable<Demande> {
    return this.http.put<Demande>(
      `${API_URL}/demandes/${id}/valider-rh`,
      { ...decision, envoyerNotification: true }
    ).pipe(
      tap(updated => {
        this._demandes.update(list => list.map(d => d.id === id ? updated : d));
      }),
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }

  // ============================================================
  // PDF DE LA DEMANDE
  // ============================================================
  telechargerPdf(id: string): Observable<Blob> {
    return this.http.get(`${API_URL}/demandes/${id}/pdf`, { responseType: 'blob' });
  }

  downloadPdf(id: string): void {
    this.telechargerPdf(id).subscribe((blob: Blob) => {
      const url = window.URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `demande-${id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    });
  }

  // ============================================================
  // DÉPOSER UN JUSTIFICATIF
  // ============================================================
  deposerJustificatif(id: string, fichier: File): Observable<Demande> {
    const formData = new FormData();
    formData.append('fichier', fichier, fichier.name);
    return this.http.post<Demande>(`${API_URL}/justificatifs`, formData).pipe(
      tap(updated => {
        this._demandes.update(list => list.map(d => d.id === id ? updated : d));
      }),
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }

  // ============================================================
  // MODIFIER UN JUSTIFICATIF
  // ============================================================
  modifierJustificatif(id: string, fichier: File): Observable<Demande> {
    const formData = new FormData();
    formData.append('fichier', fichier, fichier.name);
    return this.http.put<Demande>(`${API_URL}/justificatifs/${id}`, formData).pipe(
      tap(updated => {
        this._demandes.update(list => list.map(d => d.id === id ? updated : d));
      }),
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }

  // ============================================================
  // TÉLÉCHARGER LE JUSTIFICATIF
  // ============================================================
  telechargerJustificatif(id: string): Observable<Blob> {
    return this.http.get(`${API_URL}/demandes/${id}/justificatif`, { responseType: 'blob' });
  }

  downloadJustificatif(id: string, nomFichier: string): void {
    this.telechargerJustificatif(id).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = nomFichier || `justificatif-${id}`;
        a.click();
        window.URL.revokeObjectURL(url);
        this._demandes.update(list =>
          list.map(d => d.id === id ? { ...d, justificatifTelecharge: true } : d)
        );
      }
    });
  }

  // ============================================================
  // SUPPRIMER UN JUSTIFICATIF
  // ============================================================
  supprimerJustificatif(id: string): Observable<Demande> {
    return this.http.delete<Demande>(`${API_URL}/demandes/${id}/justificatif`).pipe(
      tap(updated => {
        this._demandes.update(list => list.map(d => d.id === id ? updated : d));
      }),
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }

  // ============================================================
  // LOGIQUE MÉTIER
  // ============================================================
  peutDecider(d: Demande, role: string): boolean {
    const r = this.normaliserRole(role);
    if (r === 'RESPONSABLE')       return d.statut === 'EN_ATTENTE';
    if (r === 'CHEF_DEPARTEMENT')  return d.statut === 'APPROUVEE_RESPONSABLE';
    if (r === 'RH')                return d.statut === 'APPROUVEE_CHEF_DEPARTEMENT';
    return false;
  }

  raisonBlocage(d: Demande, role: string): string {
    const r = this.normaliserRole(role);
    if (r === 'RESPONSABLE' && d.statut !== 'EN_ATTENTE')
      return 'Déjà traitée';
    if (r === 'CHEF_DEPARTEMENT' && d.statut !== 'APPROUVEE_RESPONSABLE')
      return d.statut === 'EN_ATTENTE'
        ? '⏳ En attente du responsable'
        : 'Déjà traitée';
    if (r === 'RH' && d.statut !== 'APPROUVEE_CHEF_DEPARTEMENT')
      return d.statut === 'EN_ATTENTE'
        ? '⏳ En attente du responsable'
        : d.statut === 'APPROUVEE_RESPONSABLE'
          ? '⏳ En attente du chef département'
          : 'Déjà traitée';
    return '';
  }

  peutGererJustificatif(d: Demande): boolean {
    if (d.statut !== 'APPROUVEE_RH') return false;
    const dateFin = new Date(d.dateFin);
    const aujourd = new Date();
    return dateFin < aujourd;
  }

  peutTelechargerJustificatif(d: Demande): boolean {
    return d.statut === 'APPROUVEE_RH' && !!d.justificatifPath;
  }

  private normaliserRole(role: string): string {
    return (role || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim()
      .replace(/\s+/g, '_');
  }

  // ============================================================
  // HELPERS UI
  // ============================================================
  libelleType(type: string): string {
    const map: Record<string, string> = {
      CONGE: 'Congé', PERMISSION: 'Permission',
     
    };
    return map[type] ?? type;
  }

  libelleStatut(statut: string): string {
    const map: Record<string, string> = {
      EN_ATTENTE: 'En attente',
      APPROUVEE_RESPONSABLE: 'Approuvée (Responsable)',
      REFUSEE_RESPONSABLE: 'Refusée (Responsable)',
      APPROUVEE_CHEF_DEPARTEMENT: 'Approuvée (Chef Dépt.)',
      REFUSEE_CHEF_DEPARTEMENT: 'Refusée (Chef Dépt.)',
      APPROUVEE_RH: 'Approuvée (RH) ✅',
      REFUSEE_RH: 'Refusée (RH)'
    };
    return map[statut] ?? statut;
  }

  couleurStatut(statut: string): string {
    const map: Record<string, string> = {
      EN_ATTENTE: 'warning', APPROUVEE_RESPONSABLE: 'info',
      APPROUVEE_CHEF_DEPARTEMENT: 'primary', APPROUVEE_RH: 'success',
      REFUSEE_RESPONSABLE: 'danger', REFUSEE_CHEF_DEPARTEMENT: 'danger',
      REFUSEE_RH: 'danger'
    };
    return map[statut] ?? 'secondary';
  }
}