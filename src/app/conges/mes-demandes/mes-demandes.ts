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
  Demande
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

  erreurAnnulation   = signal('');
  annulationEnCours  = signal<string | null>(null);
  erreurModification = signal('');

  // ---- Modal nouvelle demande ----
  modalOuvert = signal(false);
  formLoading = signal(false);
  formErreur  = signal('');
  formData = signal({
    type: '', dateDebut: '', dateFin: '', motif: ''
  });

  // ---- Modal modification ----
  modalModifOuvert = signal(false);
  modifLoading     = signal(false);
  modifErreur      = signal('');
  demandeAModifier = signal<Demande | null>(null);
  modifData = signal({
    typeDemande: '', dateDebut: '', dateFin: '', motif: ''
  });

  // ---- Modal justificatif (dépôt / remplacement) ----
  modalJustifOuvert   = signal(false);
  justifLoading       = signal(false);
  justifErreur        = signal('');
  justifSucces        = signal('');
  demandeJustif       = signal<Demande | null>(null);
  // Fichier sélectionné par l'utilisateur
  fichierSelectionne: File | null = null;
  // Mode : 'depot' (premier dépôt) ou 'remplacement' (modifier)
  modeJustif = signal<'depot' | 'remplacement'>('depot');

 types = [
  { value: 'PERMISSION',    label: 'Permission',      icon: '🕐' },
  { value: 'CONGE_MALADIE', label: 'Congé ',  icon: '🏝' },
];

  dateMin = new Date(
  Date.now() - new Date().getTimezoneOffset() * 60000
).toISOString().slice(0, 16);

  nombreJours = computed(() => {
    const { dateDebut, dateFin } = this.formData();
    if (!dateDebut || !dateFin) return 0;
    const d1 = new Date(dateDebut);
    const d2 = new Date(dateFin);
    if (d2 < d1) return 0;
    return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  });

  nombreJoursModif = computed(() => {
    const { dateDebut, dateFin } = this.modifData();
    if (!dateDebut || !dateFin) return 0;
    const d1 = new Date(dateDebut);
    const d2 = new Date(dateFin);
    if (d2 < d1) return 0;
    return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  });

  demandesFiltrees = computed(() => {
    const filtre = this.filtreStatut();
    const toutes = this.congeService.demandes();
    if (filtre === 'tous') return toutes;
    return toutes.filter(d =>
      this.normaliserStatut(String(d.statut)) === filtre
    );
  });

  compte = computed(() => {
    const toutes = this.congeService.demandes();
    return {
      tous:       toutes.length,
      en_attente: toutes.filter(d => {
        const s = String(d.statut);
        return s === 'EN_ATTENTE' || s === 'APPROUVEE_RESPONSABLE' || s === 'APPROUVEE_CHEF_DEPARTEMENT';
      }).length,
      valide: toutes.filter(d => String(d.statut) === 'APPROUVEE_RH').length,
      refuse: toutes.filter(d => String(d.statut).includes('REFUSEE')).length
    };
  });

  constructor(
    public authService:  AuthService,
    public congeService: DemandeService
  ) {}

  ngOnInit(): void {
    this.congeService.chargerMesDemandes();
  }

  private normaliserStatut(statut: string): string {
    if (statut === 'APPROUVEE_RH')   return 'valide';
    if (statut.includes('REFUSEE'))  return 'refuse';
    if (['EN_ATTENTE', 'APPROUVEE_RESPONSABLE', 'APPROUVEE_CHEF_DEPARTEMENT'].includes(statut))
      return 'en_attente';
    return statut.toLowerCase();
  }

  // ============================================================
  // MODAL NOUVELLE DEMANDE
  // ============================================================
  ouvrirModal(): void {
    this.formData.set({ type: '', dateDebut: '', dateFin: '', motif: '' });
    this.formErreur.set('');
    this.modalOuvert.set(true);
  }

  fermerModal(): void {
    this.modalOuvert.set(false);
    this.formErreur.set('');
  }

  updateField(field: string, value: any): void {
    this.formData.update(f => ({ ...f, [field]: value }));
    this.formErreur.set('');
  }

  soumettre(): void {
    const f = this.formData();
    if (!f.type)          { this.formErreur.set('Choisissez un type.'); return; }
    if (!f.dateDebut || !f.dateFin) { this.formErreur.set('Renseignez les dates.'); return; }
    if (new Date(f.dateFin) < new Date(f.dateDebut))
      { this.formErreur.set('La date de fin doit être après le début.'); return; }
    if (!f.motif.trim())  { this.formErreur.set('Renseignez un motif.'); return; }

    this.formLoading.set(true);
    this.congeService.creerDemande({
      typeDemande: f.type, dateDebut: f.dateDebut, dateFin: f.dateFin, motif: f.motif.trim()
    }).subscribe({
      next: () => {
        this.formLoading.set(false);
        this.fermerModal();
        this.congeService.chargerMesDemandes();
      },
      error: (err: HttpErrorResponse) => {
        this.formLoading.set(false);
        this.formErreur.set(err.error?.message || 'Erreur lors de la création.');
      }
    });
  }

  // ============================================================
  // MODAL MODIFICATION DE DEMANDE
  // ============================================================
  ouvrirModification(d: Demande): void {
    this.demandeAModifier.set(d);
    this.modifData.set({
      typeDemande: d.typeDemande ?? '',
      dateDebut:   d.dateDebut   ?? '',
      dateFin:     d.dateFin     ?? '',
      motif:       d.motif       ?? ''
    });
    this.modifErreur.set('');
    this.modalModifOuvert.set(true);
  }

  fermerModalModif(): void {
    this.modalModifOuvert.set(false);
    this.demandeAModifier.set(null);
    this.modifErreur.set('');
  }

  updateModifField(field: string, value: any): void {
    this.modifData.update(f => ({ ...f, [field]: value }));
    this.modifErreur.set('');
  }

  soumettreModification(): void {
    const demande = this.demandeAModifier();
    if (!demande) return;
    const f = this.modifData();
    if (!f.typeDemande) { this.modifErreur.set('Choisissez un type.'); return; }
    if (!f.dateDebut || !f.dateFin) { this.modifErreur.set('Renseignez les dates.'); return; }
    if (new Date(f.dateFin) < new Date(f.dateDebut))
      { this.modifErreur.set('Date de fin invalide.'); return; }
    if (!f.motif.trim()) { this.modifErreur.set('Renseignez un motif.'); return; }

    this.modifLoading.set(true);
    this.congeService.modifierDemande(demande.id, {
      typeDemande: f.typeDemande, dateDebut: f.dateDebut, dateFin: f.dateFin, motif: f.motif.trim()
    }).subscribe({
      next: () => {
        this.modifLoading.set(false);
        this.fermerModalModif();
        this.congeService.chargerMesDemandes();
      },
      error: (err: HttpErrorResponse) => {
        this.modifLoading.set(false);
        this.modifErreur.set(err.error?.message || 'Erreur lors de la modification.');
      }
    });
  }

  // ============================================================
  // ANNULER UNE DEMANDE
  // ============================================================
  annuler(id: string): void {
    if (!confirm('Confirmer l\'annulation ?')) return;
    this.annulationEnCours.set(id);
    this.congeService.annuler(id).subscribe({
      next: () => this.annulationEnCours.set(null),
      error: (err: HttpErrorResponse) => {
        this.annulationEnCours.set(null);
        this.erreurAnnulation.set(err.error?.message || `Erreur (${err.status}).`);
        setTimeout(() => this.erreurAnnulation.set(''), 4000);
      }
    });
  }

  // ============================================================
  // TÉLÉCHARGER LE PDF DE LA DEMANDE
  // ============================================================
  telechargerPdf(d: Demande): void {
    this.congeService.downloadPdf(d.id);
  }

  // ============================================================
  // MODAL JUSTIFICATIF
  // ============================================================

  // Ouvrir le modal pour déposer ou remplacer un justificatif
  ouvrirModalJustif(d: Demande): void {
    this.demandeJustif.set(d);
    this.fichierSelectionne = null;
    this.justifErreur.set('');
    this.justifSucces.set('');
    // Si un justificatif existe déjà → mode remplacement
    this.modeJustif.set(d.justificatifPath ? 'remplacement' : 'depot');
    this.modalJustifOuvert.set(true);
  }

  fermerModalJustif(): void {
    this.modalJustifOuvert.set(false);
    this.demandeJustif.set(null);
    this.fichierSelectionne = null;
    this.justifErreur.set('');
    this.justifSucces.set('');
  }

  // Appelé quand l'utilisateur sélectionne un fichier
  onFichierSelectionne(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const fichier = input.files[0];
    this.justifErreur.set('');

    // Vérification du type : PDF ou image seulement
    const typesAcceptes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!typesAcceptes.includes(fichier.type)) {
      this.justifErreur.set('Format non accepté. Utilisez PDF, JPG ou PNG.');
      this.fichierSelectionne = null;
      return;
    }

    // Vérification de la taille : max 10 Mo
    const tailleMo = fichier.size / (1024 * 1024);
    if (tailleMo > 10) {
      this.justifErreur.set('Fichier trop volumineux. Maximum 10 Mo.');
      this.fichierSelectionne = null;
      return;
    }

    this.fichierSelectionne = fichier;
  }

  // Déposer ou remplacer le justificatif
  soumettreJustificatif(): void {
    const demande = this.demandeJustif();
    if (!demande || !this.fichierSelectionne) {
      this.justifErreur.set('Veuillez sélectionner un fichier.');
      return;
    }

    this.justifLoading.set(true);
    this.justifErreur.set('');

    // Choisir la bonne méthode selon le mode
    const operation$ = this.modeJustif() === 'depot'
      ? this.congeService.deposerJustificatif(demande.id, this.fichierSelectionne)
      : this.congeService.modifierJustificatif(demande.id, this.fichierSelectionne);

    operation$.subscribe({
      next: (updated) => {
        this.justifLoading.set(false);
        this.justifSucces.set(
          this.modeJustif() === 'depot'
            ? 'Justificatif déposé avec succès !'
            : 'Justificatif remplacé avec succès !'
        );
        this.fichierSelectionne = null;
        // Fermer automatiquement après 2 secondes
        setTimeout(() => this.fermerModalJustif(), 2000);
      },
      error: (err: HttpErrorResponse) => {
        this.justifLoading.set(false);
        if (err.status === 403) {
          this.justifErreur.set(
            'Modification impossible : le RH a déjà téléchargé ce justificatif.'
          );
        } else {
          this.justifErreur.set(err.error?.message || 'Erreur lors de l\'envoi.');
        }
      }
    });
  }

  // Télécharger son propre justificatif déposé
  voirJustificatif(d: Demande): void {
    if (!d.justificatifPath) return;
    this.congeService.downloadJustificatif(d.id, d.justificatifNom ?? `justificatif-${d.id}`);
  }

  // ============================================================
  // HELPERS
  // ============================================================
  estAnnulable(d: Demande): boolean {
    return String(d.statut) === 'EN_ATTENTE';
  }

  estModifiable(d: Demande): boolean {
    return String(d.statut) === 'EN_ATTENTE';
  }

  // Peut déposer un justificatif : APPROUVEE_RH + date passée
  peutDeposerJustificatif(d: Demande): boolean {
    return this.congeService.peutGererJustificatif(d) && !d.justificatifTelecharge;
  }

  // Peut remplacer son justificatif : a déposé + RH n'a pas encore téléchargé
  peutRemplacerJustificatif(d: Demande): boolean {
    return this.congeService.peutGererJustificatif(d)
      && !!d.justificatifPath
      && !d.justificatifTelecharge;
  }

  // Le justificatif a été téléchargé par le RH → plus modifiable
  justificatifVerrouille(d: Demande): boolean {
    return !!d.justificatifTelecharge;
  }

  // Libellé du fichier pour l'aperçu
  libelleFichier(fichier: File): string {
    const tailleMo = (fichier.size / (1024 * 1024)).toFixed(2);
    return `${fichier.name} (${tailleMo} Mo)`;
  }

  getBadgeClass(statut: string): string {
    const s = String(statut);
    if (s === 'APPROUVEE_RH')           return 'badge-success';
    if (s.includes('REFUSEE'))          return 'badge-danger';
    if (['APPROUVEE_RESPONSABLE', 'APPROUVEE_CHEF_DEPARTEMENT'].includes(s)) return 'badge-info';
    if (s === 'EN_ATTENTE')             return 'badge-warning';
    return 'badge-secondary';
  }

  getStatutLabel(statut: string): string {
    return this.congeService.libelleStatut(String(statut));
  }

  prenomEmploye(d: Demande): string {
    return (d.utilisateur?.prenom ?? d.utilisateurPrenom ?? d.prenom ?? '').trim();
  }

  nomEmploye(d: Demande): string {
    return (d.utilisateur?.nom ?? d.utilisateurNom ?? d.nom ?? '').trim();
  }

  initiales(d: Demande): string {
    const p = this.prenomEmploye(d) || 'U';
    const n = this.nomEmploye(d)    || 'N';
    return (p.charAt(0) + n.charAt(0)).toUpperCase();
  }
 
}