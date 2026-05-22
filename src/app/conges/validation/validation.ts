// ============================================================
// FICHIER : src/app/conges/validation/validation.ts
// ============================================================

import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { AuthService } from '../../services/auth.service';
import {
  DemandeService,
  Demande,
  DecisionDemande,
  StatutDemande
} from '../../services/demande.service';

@Component({
  selector: 'app-validation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './validation.html',
  styleUrl: './validation.scss'
})
export class ValidationComponent implements OnInit {

  // ---- Modal ----
  demandeSelectionnee = signal<Demande | null>(null);
  modeAction          = signal<'valide' | 'refuse' | null>(null);
  commentaireAction   = signal('');
  traitement          = signal(false);
  erreurAction        = signal('');

  // ---- Filtre ----
  filtreActif = signal<'en_attente' | 'traite'>('en_attente');

  constructor(
    public demandeService: DemandeService,
    public authService:    AuthService
  ) {}

  ngOnInit(): void {
    this.demandeService.chargerEnAttente();
  }

  get monRole(): string {

  const user: any = this.authService.currentUser();

  if (!user) return '';

  // role objet
  if (typeof user.role === 'object') {
    return (user.role.nom || '')
      .toString()
      .trim()
      .toUpperCase();
  }

  // role string
  return (user.role || '')
    .toString()
    .trim()
    .toUpperCase();
}

  private roleNormalise(role: string): string {
    return (role || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();
  }

  // ---- Demandes en attente ----
  // Statuts intermédiaires = pas encore terminés
  demandesEnAttente = computed(() => {
    return this.demandeService.demandes().filter(d => {
      const s = String(d.statut);
      return (
        s === 'EN_ATTENTE' ||
        s === 'APPROUVEE_RESPONSABLE' ||
        s === 'APPROUVEE_CHEF_DEPARTEMENT'
      );
    });
  });

  // ---- Demandes traitées (historique) ----
  demandesTraitees = computed(() => {
    return this.demandeService.demandes().filter(d => {
      const s = String(d.statut);
      return (
        s === 'APPROUVEE_RH' ||
        s === 'REFUSEE_RESPONSABLE' ||
        s === 'REFUSEE_CHEF_DEPARTEMENT' ||
        s === 'REFUSEE_RH'
      );
    });
  });

  // ---- Peut-il agir sur cette demande ? ----
  peutAgir(d: Demande): boolean {
    return this.demandeService.peutDecider(d, this.monRole);
  }
  // Le RH peut-il télécharger le justificatif ?
    peutTelechargerJustificatif(d: Demande): boolean {
      return d.statut === 'APPROUVEE_RH' && !!d.justificatifPath;
    }

  // ---- Raison du blocage ----
  raisonBlocage(d: Demande): string {
    return this.demandeService.raisonBlocage(d, this.monRole);
  }

  // ---- Étape courante lisible ----
  etapeCourante(d: Demande): string {
    const s = String(d.statut);
    switch (s) {
      case 'EN_ATTENTE':                return 'Attend Responsable';
      case 'APPROUVEE_RESPONSABLE':     return 'Attend Chef Département';
      case 'APPROUVEE_CHEF_DEPARTEMENT':return 'Attend RH';
      case 'APPROUVEE_RH':              return 'Approuvée ✅';
      case 'REFUSEE_RESPONSABLE':       return 'Refusée par Responsable';
      case 'REFUSEE_CHEF_DEPARTEMENT':  return 'Refusée par Chef Département';
      case 'REFUSEE_RH':                return 'Refusée par RH';
      default:                          return s;
    }
  }

  // ---- Ouvrir le modal ----
  ouvrirAction(d: Demande, action: 'valide' | 'refuse'): void {
    this.demandeSelectionnee.set(d);
    this.modeAction.set(action);
    this.commentaireAction.set('');
    this.erreurAction.set('');
  }

  // ---- Fermer le modal ----
  fermerModal(): void {
    this.demandeSelectionnee.set(null);
    this.modeAction.set(null);
    this.erreurAction.set('');
  }

  // ---- Confirmer la décision ----
  confirmerAction(): void {
    const demande = this.demandeSelectionnee();
    const action  = this.modeAction();
    if (!demande || !action) return;

    // Commentaire obligatoire pour un refus
    if (action === 'refuse' && !this.commentaireAction().trim()) {
      this.erreurAction.set('Le commentaire est obligatoire pour un refus.');
      return;
    }

    this.traitement.set(true);
    this.erreurAction.set('');

    const decision: DecisionDemande = {
      statut:      action === 'valide' ? 'APPROUVE' : 'REFUSE',
      commentaire: this.commentaireAction().trim(),
      validateurId: String(this.authService.currentUser()?.id ?? '')
    };

    // ---- Routage selon le rôle ----
    let request$;
    const role = this.roleNormalise(this.monRole);

    if (!decision.validateurId) {
      this.erreurAction.set('Impossible d’identifier le validateur connecté.');
      this.traitement.set(false);
      return;
    }

    if (role === 'RESPONSABLE' ) {
      request$ = this.demandeService.validerParResponsable(demande.id, decision);
    } else if (role === 'CHEF DEPARTEMENT') {
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
        // Recharge pour avoir l'état à jour
        this.demandeService.chargerEnAttente();
        if (role === 'RH' && decision.statut === 'APPROUVE') {
  this.demandeService.telechargerPdf(demande.id).subscribe(blob => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `demande-${demande.id}.pdf`;
    a.click();
  });
  
}
      },
      error: (err: HttpErrorResponse) => {
        this.traitement.set(false);
        
        if (err.status === 403) {
          // 403 = Permissions insuffisantes
          const errMsg = err.error?.message || err.error?.detail || '';
          this.erreurAction.set(
            'Accès refusé. ' +
            (errMsg ? `(${errMsg})` : 'Vérifiez que vous êtes responsable de cette demande ou que votre session est valide.')
          );
        } else if (err.status === 409) {
          this.erreurAction.set('Cette demande a déjà été traitée.');
        } else if (err.status === 401) {
          this.erreurAction.set('Votre session a expiré. Veuillez vous reconnecter.');
        } else if (err.status === 0) {
          this.erreurAction.set('Erreur réseau. Vérifiez votre connexion.');
        } else {
          this.erreurAction.set(`Erreur serveur (${err.status} ${err.statusText}). Veuillez réessayer.`);
        }
      }
    });
  }

  // ---- Helpers d'affichage ----

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
    return (
      d.utilisateur?.prenom ??
      d.utilisateurPrenom ??
      d.prenom ??
      ''
    ).trim();
  }

  nomEmploye(d: Demande): string {
    return (
      d.utilisateur?.nom ??
      d.utilisateurNom ??
      d.nom ??
      ''
    ).trim();
  }

  nomCompletEmploye(d: Demande): string {
    const nomComplet = `${this.prenomEmploye(d)} ${this.nomEmploye(d)}`.trim();
    return nomComplet || 'Employé';
  }

  labelRole(role: string): string {

  const r = role?.toUpperCase().trim();

  const map: Record<string, string> = {

    'RESPONSABLE': 'RESPONSABLE',
    'CHEF DEPARTEMENT': 'CHEF DEPARTEMENT',
    'RH': 'RH'

  };

  return map[r] ?? role;
}
  initiales(d: Demande): string {
    const prenom = this.prenomEmploye(d) || 'U';
    const nom    = this.nomEmploye(d) || 'N';
    return (prenom.charAt(0) + nom.charAt(0)).toUpperCase();
  }

  // Dernier commentaire — le service ne stocke pas les étapes
  // donc on retourne le motif si pas de commentaire disponible
  dernierCommentaire(d: Demande): string {
    return d.motif ?? '—';
  }
}