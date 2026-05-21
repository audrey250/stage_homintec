// ============================================================
// FICHIER : src/app/conges/mes-demandes/mes-demandes.ts
// ============================================================

import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { AuthService } from '../../services/auth.service';
import {
  DemandeService,
  Demande,
  StatutDemande
} from '../../services/demande.service';

@Component({
  selector: 'app-mes-demandes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mes-demandes.html',
  styleUrl: './mes-demandes.css'
})
export class MesDemandesComponent implements OnInit {

  filtreStatut = signal<string>('tous');

  erreurAnnulation  = signal('');
  annulationEnCours = signal<string | null>(null);

  // ============================================================
  // MODAL FORMULAIRE NOUVELLE DEMANDE
  // ============================================================

  modalOuvert = signal(false);
  formLoading = signal(false);
  formErreur  = signal('');

  // Données du formulaire
  formData = signal({
    type: '',
    dateDebut: '',
    dateFin: '',
    motif: '',
    urgence: false
  });

  // Types disponibles
  types = [
    { value: 'conge_annuel',  label: 'Congé annuel',   icone: 'fa-umbrella-beach', couleur: 'text-primary' },
    { value: 'permission',    label: 'Permission',      icone: 'fa-clock',          couleur: 'text-warning' },
    { value: 'conge_maladie', label: 'Congé maladie',  icone: 'fa-heartbeat',      couleur: 'text-danger'  },
  ];

  // Calcul du nombre de jours
  nombreJours = computed(() => {
    const { dateDebut, dateFin } = this.formData();
    if (!dateDebut || !dateFin) return 0;
    const d1 = new Date(dateDebut);
    const d2 = new Date(dateFin);
    if (d2 < d1) return 0;
    const diff = (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24);
    return Math.round(diff) + 1;
  });

  // Date minimale = aujourd'hui
  dateMin = new Date().toISOString().split('T')[0];

  // ---- Liste filtrée ----
  demandesFiltrees = computed(() => {
    const filtre = this.filtreStatut();
    const toutes = this.congeService.demandes();
    if (filtre === 'tous') return toutes;
    return toutes.filter(d =>
      this.normaliserStatut(String(d.statut)) === filtre
    );
  });

  // ---- Compteurs pour les onglets ----
  compte = computed(() => {
    const toutes = this.congeService.demandes();
    return {
      tous:       toutes.length,
      en_attente: toutes.filter(d => {
        const s = String(d.statut);
        return (
          s === 'EN_ATTENTE' ||
          s === 'APPROUVEE_RESPONSABLE' ||
          s === 'APPROUVEE_CHEF_DEPARTEMENT'
        );
      }).length,
      valide: toutes.filter(d =>
        String(d.statut) === 'APPROUVEE_RH'
      ).length,
      refuse: toutes.filter(d =>
        String(d.statut).includes('REFUSEE')
      ).length
    };
  });

  constructor(
    public authService:  AuthService,
    public congeService: DemandeService
  ) {}

  ngOnInit(): void {
    this.congeService.chargerMesDemandes();
  }

  // ---- Normalise le statut pour le filtre ----
  private normaliserStatut(statut: string): string {
    if (statut === 'APPROUVEE_RH') return 'valide';
    if (statut.includes('REFUSEE'))  return 'refuse';
    if (
      statut === 'EN_ATTENTE' ||
      statut === 'APPROUVEE_RESPONSABLE' ||
      statut === 'APPROUVEE_CHEF_DEPARTEMENT'
    ) return 'en_attente';
    return statut.toLowerCase();
  }

  // ---- Annuler une demande ----
  annuler(id: string): void {
    if (!confirm('Confirmer l\'annulation de cette demande ?')) return;

    this.annulationEnCours.set(id);
    this.erreurAnnulation.set('');

    this.congeService.annuler(id).subscribe({
      next: () => {
        this.annulationEnCours.set(null);
      },
      error: (err: HttpErrorResponse) => {
        this.annulationEnCours.set(null);
        if (err.status === 403) {
          this.erreurAnnulation.set(
            'Vous ne pouvez pas annuler cette demande.'
          );
        } else if (err.status === 404) {
          this.erreurAnnulation.set('Demande introuvable.');
        } else {
          this.erreurAnnulation.set(
            `Erreur (${err.status}). Veuillez réessayer.`
          );
        }
        setTimeout(() => this.erreurAnnulation.set(''), 4000);
      }
    });
  }

  // ---- Helpers visuels ----

  getBadgeClass(statut: string): string {
    const s = String(statut);
    if (s === 'APPROUVEE_RH')      return 'badge-success';
    if (s.includes('REFUSEE'))     return 'badge-danger';
    if (s === 'APPROUVEE_RESPONSABLE' ||
        s === 'APPROUVEE_CHEF_DEPARTEMENT') return 'badge-info';
    if (s === 'EN_ATTENTE')        return 'badge-warning';
    return 'badge-secondary';
  }

  getStatutLabel(statut: string): string {
    return this.congeService.libelleStatut(String(statut));
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

  // ---- Initiales ----
  initiales(d: Demande): string {
    const prenom = this.prenomEmploye(d) || 'U';
    const nom    = this.nomEmploye(d) || 'N';
    return (prenom.charAt(0) + nom.charAt(0)).toUpperCase();
  }

  // ---- Dernier commentaire ----
  // Le nouveau service ne stocke pas d'étapes
  // on retourne le motif comme fallback
  dernierCommentaire(d: Demande): string {
    return d.motif ?? '—';
  }

  // ---- Est annulable ? ----
  // Seulement si en attente du premier niveau
  estAnnulable(d: Demande): boolean {
    return String(d.statut) === 'EN_ATTENTE';
  }

  // ============================================================
  // MODAL - GESTION OUVERTURE/FERMETURE
  // ============================================================

  ouvrirModal(): void {
    this.formData.set({
      type: '',
      dateDebut: '',
      dateFin: '',
      motif: '',
      urgence: false
    });
    this.formErreur.set('');
    this.modalOuvert.set(true);
  }

  fermerModal(): void {
    this.modalOuvert.set(false);
    this.reset();
  }

  // ============================================================
  // MODAL - LOGIQUE FORMULAIRE
  // ============================================================

  updateField(field: string, value: any): void {
    this.formData.update(f => ({ ...f, [field]: value }));
    this.formErreur.set('');
  }

  soumettre(): void {
    const f = this.formData();

    // Validations
    if (!f.type) {
      this.formErreur.set('Veuillez choisir un type de demande.');
      return;
    }
    if (!f.dateDebut || !f.dateFin) {
      this.formErreur.set('Veuillez renseigner les dates.');
      return;
    }
    if (new Date(f.dateFin) < new Date(f.dateDebut)) {
      this.formErreur.set('La date de fin doit être après la date de début.');
      return;
    }
    if (!f.motif.trim()) {
      this.formErreur.set('Veuillez renseigner un motif.');
      return;
    }

    this.formLoading.set(true);
    this.formErreur.set('');

    const typeDemande = f.type === 'permission' ? 'PERMISSION' : 'CONGE';

    this.congeService.creerDemande({
      typeDemande,
      dateDebut: f.dateDebut,
      dateFin: f.dateFin,
      motif: f.motif.trim()
    }).subscribe({
      next: () => {
        this.formLoading.set(false);
        this.fermerModal();
        this.congeService.chargerMesDemandes();
      },
      error: (err: HttpErrorResponse) => {
        this.formLoading.set(false);
        if (err.status === 400) {
          this.formErreur.set('Données invalides. Vérifie le type et les dates.');
        } else if (err.status === 401) {
          this.formErreur.set('Session expirée. Veuillez vous reconnecter.');
        } else if (err.status === 403) {
          this.formErreur.set('Accès refusé pour créer une demande.');
        } else if (err.status === 0) {
          this.formErreur.set('Serveur inaccessible. Vérifie que le backend est démarré.');
        } else {
          this.formErreur.set(err.error?.message || 'Erreur lors de la création de la demande.');
        }
      }
    });
  }

  reset(): void {
    this.formData.set({
      type: '',
      dateDebut: '',
      dateFin: '',
      motif: '',
      urgence: false
    });
    this.formErreur.set('');
  }
}