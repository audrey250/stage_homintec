// ============================================================
// FICHIER : src/app/conges/mes-demandes/mes-demandes.ts
// ============================================================

import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
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
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './mes-demandes.html',
  styleUrl: './mes-demandes.css'
})
export class MesDemandesComponent implements OnInit {

  filtreStatut = signal<string>('tous');

  erreurAnnulation  = signal('');
  annulationEnCours = signal<string | null>(null);

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

  // ---- Initiales ----
  initiales(d: Demande): string {
    const prenom = (d.utilisateur?.prenom ?? d.prenom ?? 'U').trim();
    const nom    = (d.utilisateur?.nom    ?? d.nom    ?? 'N').trim();
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
}