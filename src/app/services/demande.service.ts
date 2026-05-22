// ============================================================
// FICHIER : src/app/services/demande.service.ts
// ============================================================

import { Injectable, signal } from '@angular/core';
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
  justificatifPath?:        string;   // URL fichier sur le serveur
  justificatifNom?:         string;   // Nom original du fichier
  justificatifType?:        string;   // "PDF" | "IMAGE"
  justificatifDateDepot?:   string;   // Date de dépôt ISO
  justificatifTelecharge?:  boolean;  // true = RH a téléchargé
  dateRetour?:              string;   // Date de retour réelle
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

@Injectable({ providedIn: 'root' })
export class DemandeService {

  private _demandes = signal<Demande[]>([]);
  demandes = this._demandes.asReadonly();

  private _loading = signal(false);
  loading = this._loading.asReadonly();

  private _erreur = signal('');
  erreur = this._erreur.asReadonly();

  constructor(private http: HttpClient) {}

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
  // PDF DE LA DEMANDE (généré par Spring Boot)
  // GET /api/demandes/:id/pdf
  // ============================================================
  telechargerPdf(id: string): Observable<Blob> {
    return this.http.get(`${API_URL}/demandes/${id}/pdf`, {
      responseType: 'blob'
    });
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
  // DÉPOSER UN JUSTIFICATIF (employé après retour)
  // POST /api/demandes/:id/justificatif
  // Accepte : PDF ou image (jpg, png)
  // ============================================================
  deposerJustificatif(id: string, fichier: File): Observable<Demande> {
    const formData = new FormData();
    // "fichier" doit correspondre au @RequestParam("fichier") dans Spring Boot
    formData.append('fichier', fichier, fichier.name);

    return this.http.post<Demande>(
      `${API_URL}/justificatifs`,
      formData
    ).pipe(
      tap(updated => {
        // Mettre à jour la demande dans le cache avec les infos du justificatif
        this._demandes.update(list =>
          list.map(d => d.id === id ? updated : d)
        );
      }),
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }

  // ============================================================
  // MODIFIER UN JUSTIFICATIF (employé — tant que RH n'a pas téléchargé)
  // PUT /api/demandes/:id/justificatif
  // ============================================================
  modifierJustificatif(id: string, fichier: File): Observable<Demande> {
    const formData = new FormData();
    formData.append('fichier', fichier, fichier.name);

    return this.http.put<Demande>(
      `${API_URL}/justificatifs/${id}`,
      formData
    ).pipe(
      tap(updated => {
        this._demandes.update(list =>
          list.map(d => d.id === id ? updated : d)
        );
      }),
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }

  // ============================================================
  // TÉLÉCHARGER LE JUSTIFICATIF (RH ou employé)
  // GET /api/demandes/:id/justificatif
  // ============================================================
  telechargerJustificatif(id: string): Observable<Blob> {
    return this.http.get(`${API_URL}/demandes/${id}/justificatif`, {
      responseType: 'blob'
    });
  }

  // Téléchargement direct avec création du lien
  downloadJustificatif(id: string, nomFichier: string): void {
    this.telechargerJustificatif(id).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = nomFichier || `justificatif-${id}`;
        a.click();
        window.URL.revokeObjectURL(url);

        // Marquer comme téléchargé dans le cache local
        this._demandes.update(list =>
          list.map(d => d.id === id
            ? { ...d, justificatifTelecharge: true }
            : d
          )
        );
      }
    });
  }

  // ============================================================
  // SUPPRIMER UN JUSTIFICATIF (employé — tant que RH n'a pas téléchargé)
  // DELETE /api/demandes/:id/justificatif
  // ============================================================
  supprimerJustificatif(id: string): Observable<Demande> {
    return this.http.delete<Demande>(
      `${API_URL}/demandes/${id}/justificatif`
    ).pipe(
      tap(updated => {
        this._demandes.update(list =>
          list.map(d => d.id === id ? updated : d)
        );
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

  // L'employé peut-il déposer/modifier son justificatif ?
  // Règle : demande APPROUVEE_RH + date de fin dépassée + RH n'a pas encore téléchargé
  peutGererJustificatif(d: Demande): boolean {
    if (d.statut !== 'APPROUVEE_RH') return false;
    const dateFin = new Date(d.dateFin);
    const aujourd = new Date();
    return dateFin < aujourd;
  }

  // Le RH peut-il télécharger le justificatif ?
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
      CONGE_ANNUEL: 'Congé annuel', CONGE_MALADIE: 'Congé maladie',
      CONGE_MATERNITE: 'Congé maternité', AUTRE: 'Autre',
      conge_annuel: 'Congé annuel', conge_maladie: 'Congé maladie',
      conge_maternite: 'Congé maternité', permission: 'Permission', autre: 'Autre'
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