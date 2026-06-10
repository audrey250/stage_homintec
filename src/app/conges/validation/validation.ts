// ============================================================
// FICHIER : src/app/conges/validation/validation.ts
// ============================================================

import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';

import { AuthService } from '../../services/auth.service';
import {
  DemandeService,
  Demande,
  DecisionDemande,
  StatutDemande
} from '../../services/demande.service';
import { environment } from '../../../environments/environment';

const API_URL = environment.apiUrl;

// Données saisies dans le formulaire de vérifications RH
export interface VerificationsRH {
  // Vérifications obligatoires
  nomRemplacant:              string;
  absenceDroitConges:         boolean;
  absenceDeduitePaie:         boolean;
  demandeReglementaire:       boolean;

  // Informations complémentaires
  debutCollaboration:         string;   // date ISO
  nombreJoursConsommes:       string;
  dateDerniersConges:         string;   // date ISO
  nombreJoursDisponibles:     string;

  // Observation générale
  observation:                string;
}

@Component({
  selector: 'app-validation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './validation.html',
  styleUrl: './validation.scss'
})
export class ValidationComponent implements OnInit {

  // ---- Modal validation / refus (workflow) ----
  demandeSelectionnee = signal<Demande | null>(null);
  modeAction          = signal<'valide' | 'refuse' | null>(null);
  commentaireAction   = signal('');
  traitement          = signal(false);
  erreurAction        = signal('');

  // ---- Modal vérifications RH ----
  modalVerifOuvert      = signal(false);
  demandeVerif          = signal<Demande | null>(null);
  verifLoading          = signal(false);
  verifErreur           = signal('');
  verifData             = signal<VerificationsRH>({
    nomRemplacant:          '',
    absenceDroitConges:     false,
    absenceDeduitePaie:     false,
    demandeReglementaire:   false,
    debutCollaboration:     '',
    nombreJoursConsommes:   '',
    dateDerniersConges:     '',
    nombreJoursDisponibles: '',
    observation:            ''
  });

  // ---- Filtre ----
  filtreActif = signal<'en_attente' | 'traite'>('en_attente');

  constructor(
    public  demandeService: DemandeService,
    public  authService:    AuthService,
    private http:           HttpClient
  ) {}

  ngOnInit(): void {
    this.demandeService.chargerEnAttente();
  }

  get monRole(): string {
    const user: any = this.authService.currentUser();
    if (!user) return '';
    if (typeof user.role === 'object') {
      return (user.role.nom || '').toString().trim().toUpperCase();
    }
    return (user.role || '').toString().trim().toUpperCase();
  }

  /** Accessible depuis le template HTML */
  get estRH(): boolean {
    return this.roleNormalise(this.monRole) === 'RH';
  }

  roleNormalise(role: string): string {
    return (role || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();
  }

  // ---- Demandes en attente de workflow ----
  demandesEnAttente = computed(() =>
    this.demandeService.demandes().filter(d => {
      const s = String(d.statut);
      return (
        s === 'EN_ATTENTE' ||
        s === 'APPROUVEE_RESPONSABLE' ||
        s === 'APPROUVEE_CHEF_DEPARTEMENT'
      );
    })
  );

  // ---- Demandes traitées : APPROUVEE_RH + toutes les REFUSEE ----
  demandesTraitees = computed(() =>
    this.demandeService.demandes().filter(d => {
      const s = String(d.statut);
      return (
        s === 'APPROUVEE_RH' ||
        s === 'REFUSEE_RESPONSABLE' ||
        s === 'REFUSEE_CHEF_DEPARTEMENT' ||
        s === 'REFUSEE_RH'
      );
    })
  );

  peutAgir(d: Demande): boolean {
    return this.demandeService.peutDecider(d, this.monRole);
  }

  peutTelechargerJustificatif(d: Demande): boolean {
    return d.statut === 'APPROUVEE_RH' && !!d.justificatifPath;
  }

  /** Le bouton Vérifications RH s'affiche uniquement pour le rôle RH
   *  sur une demande APPROUVEE_RH */
  peutFaireVerificationsRH(d: Demande): boolean {
    const role = this.roleNormalise(this.monRole);
    return role === 'RH' && String(d.statut) === 'APPROUVEE_RH';
  }

  raisonBlocage(d: Demande): string {
    return this.demandeService.raisonBlocage(d, this.monRole);
  }

  etapeCourante(d: Demande): string {
    const s = String(d.statut);
    switch (s) {
      case 'EN_ATTENTE':                 return 'Attend Responsable';
      case 'APPROUVEE_RESPONSABLE':      return 'Attend Chef Département';
      case 'APPROUVEE_CHEF_DEPARTEMENT': return 'Attend RH';
      case 'APPROUVEE_RH':               return 'Approuvée ✅';
      case 'REFUSEE_RESPONSABLE':        return 'Refusée par Responsable';
      case 'REFUSEE_CHEF_DEPARTEMENT':   return 'Refusée par Chef Département';
      case 'REFUSEE_RH':                 return 'Refusée par RH';
      default:                           return s;
    }
  }

  // ============================================================
  // MODAL WORKFLOW (approuver / rejeter)
  // ============================================================
  ouvrirAction(d: Demande, action: 'valide' | 'refuse'): void {
    this.demandeSelectionnee.set(d);
    this.modeAction.set(action);
    this.commentaireAction.set('');
    this.erreurAction.set('');
  }

  fermerModal(): void {
    this.demandeSelectionnee.set(null);
    this.modeAction.set(null);
    this.erreurAction.set('');
  }

  confirmerAction(): void {
    const demande = this.demandeSelectionnee();
    const action  = this.modeAction();
    if (!demande || !action) return;

    if (action === 'refuse' && !this.commentaireAction().trim()) {
      this.erreurAction.set('Le commentaire est obligatoire pour un refus.');
      return;
    }

    this.traitement.set(true);
    this.erreurAction.set('');

    const decision: DecisionDemande = {
      statut:       action === 'valide' ? 'APPROUVE' : 'REFUSE',
      commentaire:  this.commentaireAction().trim(),
      validateurId: String(this.authService.currentUser()?.id ?? '')
    };

    if (!decision.validateurId) {
      this.erreurAction.set("Impossible d'identifier le validateur connect\u00e9.");
      this.traitement.set(false);
      return;
    }

    const role = this.roleNormalise(this.monRole);
    let request$;

    if (role === 'RESPONSABLE') {
      request$ = this.demandeService.validerParResponsable(demande.id, decision);
    } else if (role === 'CHEF DEPARTEMENT' || role === 'CHEF_DEPARTEMENT') {
      request$ = this.demandeService.validerParChefDepartement(demande.id, decision);
    } else if (role === 'RH') {
      request$ = this.demandeService.validerParRH(demande.id, decision);
    } else {
      this.erreurAction.set('Rôle non autorisé : ' + role);
      this.traitement.set(false);
      return;
    }

    request$.subscribe({
      next: () => {
        this.traitement.set(false);
        this.fermerModal();
        this.demandeService.chargerEnAttente();
      },
      error: (err: HttpErrorResponse) => {
        this.traitement.set(false);
        if (err.status === 403) {
          this.erreurAction.set('Accès refusé. Vérifiez vos permissions.');
        } else if (err.status === 409) {
          this.erreurAction.set('Cette demande a déjà été traitée.');
        } else if (err.status === 401) {
          this.erreurAction.set('Session expirée. Veuillez vous reconnecter.');
        } else if (err.status === 0) {
          this.erreurAction.set('Erreur réseau. Vérifiez votre connexion.');
        } else {
          this.erreurAction.set(`Erreur serveur (${err.status}). Réessayez.`);
        }
      }
    });
  }

  // ============================================================
  // MODAL VÉRIFICATIONS RH
  // ============================================================
  ouvrirVerificationsRH(d: Demande): void {
    this.demandeVerif.set(d);
    this.verifErreur.set('');

    // Pré-remplir les jours calculés depuis le service
    const jours = this.demandeService.calculerJours(d.dateDebut, d.dateFin);
    const solde = this.demandeService.soldeConges();

    this.verifData.set({
      nomRemplacant:          '',
      absenceDroitConges:     false,
      absenceDeduitePaie:     false,
      demandeReglementaire:   false,
      debutCollaboration:     '',
      nombreJoursConsommes:   jours > 0 ? String(jours) : '',
      dateDerniersConges:     '',
      nombreJoursDisponibles: solde > 0 ? String(solde) : '',
      observation:            ''
    });

    this.modalVerifOuvert.set(true);
  }

  fermerVerificationsRH(): void {
    this.modalVerifOuvert.set(false);
    this.demandeVerif.set(null);
    this.verifErreur.set('');
  }

  updateVerif(field: keyof VerificationsRH, value: any): void {
    this.verifData.update(v => ({ ...v, [field]: value }));
  }

 validerEtGenererPDF(): void {
  const demande = this.demandeVerif();
  if (!demande) return;

  // Vérification : la demande doit être APPROUVEE_RH
  if (String(demande.statut) !== 'APPROUVEE_RH') {
    this.verifErreur.set('Le PDF n\'est disponible qu\'après approbation complète (RH).');
    return;
  }

  this.verifLoading.set(true);
  this.verifErreur.set('');

  // ✅ On utilise la méthode existante du DemandeService
  this.demandeService.telechargerPdf(demande.id).subscribe({
    next: (blob: Blob) => {
      this.verifLoading.set(false);
      const url = window.URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `validation-rh-${demande.id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      this.fermerVerificationsRH();
    },
    error: (err: HttpErrorResponse) => {
      this.verifLoading.set(false);

      // ✅ err.error est un Blob → lecture correcte
      if (err.error instanceof Blob) {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const json = JSON.parse(reader.result as string);
            this.verifErreur.set(json.message || `Erreur ${err.status}`);
          } catch {
            this.verifErreur.set(`Erreur génération PDF (${err.status}).`);
          }
        };
        reader.readAsText(err.error);
      } else {
        this.verifErreur.set(`Erreur (${err.status}).`);
      }
    }
  });
}

  // ---- Rejeter depuis le modal vérifications ----
  rejeterDepuisVerif(): void {
    const demande = this.demandeVerif();
    if (!demande) return;
    this.fermerVerificationsRH();
    this.ouvrirAction(demande, 'refuse');
  }

  // ============================================================
  // HELPERS D'AFFICHAGE
  // ============================================================
  getBadgeClass(statut: any): string {
    const s = String(statut);
    const map: Record<string, string> = {
      EN_ATTENTE:                  'badge-warning',
      APPROUVEE_RESPONSABLE:       'badge-info',
      APPROUVEE_CHEF_DEPARTEMENT:  'badge-primary',
      APPROUVEE_RH:                'badge-success',
      REFUSEE_RESPONSABLE:         'badge-danger',
      REFUSEE_CHEF_DEPARTEMENT:    'badge-danger',
      REFUSEE_RH:                  'badge-danger'
    };
    return map[s] ?? 'badge-secondary';
  }

  getStatutLabel(statut: any): string {
    return this.demandeService.libelleStatut(String(statut));
  }

  prenomEmploye(d: Demande): string {
    return (d.utilisateur?.prenom ?? d.utilisateurPrenom ?? d.prenom ?? '').trim();
  }

  nomEmploye(d: Demande): string {
    return (d.utilisateur?.nom ?? d.utilisateurNom ?? d.nom ?? '').trim();
  }

  nomCompletEmploye(d: Demande): string {
    return `${this.prenomEmploye(d)} ${this.nomEmploye(d)}`.trim() || 'Employé';
  }

  labelRole(role: string): string {
    const r = role?.toUpperCase().trim();
    const map: Record<string, string> = {
      'RESPONSABLE':       'RESPONSABLE',
      'CHEF DEPARTEMENT':  'CHEF DÉPARTEMENT',
      'CHEF_DEPARTEMENT':  'CHEF DÉPARTEMENT',
      'RH':                'RH'
    };
    return map[r] ?? role;
  }

  initiales(d: Demande): string {
    const prenom = this.prenomEmploye(d) || 'U';
    const nom    = this.nomEmploye(d) || 'N';
    return (prenom.charAt(0) + nom.charAt(0)).toUpperCase();
  }

  dernierCommentaire(d: Demande): string {
    return d.motif ?? '—';
  }

  nomValidateur(): string {
    const u = this.authService.currentUser();
    if (!u) return '—';
    return `${u.prenom ?? ''} ${u.nom ?? ''}`.trim() || u.Poste || '—';
  }
}