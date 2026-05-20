// ============================================================
// src/app/conges/mes-demandes/mes-demandes.ts
// VERSION SPRING BOOT
// ============================================================

import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { DemandeService, Demande } from '../../services/demande.service';

@Component({
  selector: 'app-mes-demandes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './mes-demandes.html',
  styleUrls: ['./mes-demandes.css']
})      
export class MesDemandesComponent implements OnInit {

  filtreStatut = signal<string>('tous');

  // États HTTP
  erreurAnnulation = signal('');
  annulationEnCours = signal<number | null>(null); // ID de la demande en cours

  // Computed filtrées depuis le cache du service
  demandesFiltrees = computed(() => {
    const filtre = this.filtreStatut();
    const toutes = this.congeService.demandes();
    if (filtre === 'tous') return toutes;
    return toutes.filter(d => this.normalizeStatut(d.statut) === filtre);
  });

  // Compteurs pour les onglets
  compte = computed(() => {
    const toutes = this.congeService.demandes();
    return {
      tous:       toutes.length,
      en_attente: toutes.filter(d => this.normalizeStatut(d.statut) === 'en_attente').length,
      valide:     toutes.filter(d => this.normalizeStatut(d.statut) === 'valide').length,
      refuse:     toutes.filter(d => this.normalizeStatut(d.statut) === 'refuse').length,
    };
  });

  // Normalise le statut retourné par le serveur (ex: "En attente", "EN_ATTENTE", "en attente")
  private normalizeStatut(statut: string | undefined): string {
    if (!statut) return '';
    return statut
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/-+/g, '_');
  }

  constructor(
    public authService:  AuthService,
    public congeService: DemandeService
  ) {}

  // ---- Au chargement : récupère les demandes de l'employé connecté ----
  ngOnInit(): void {
    this.congeService.chargerMesDemandes();
  }

  // ---- Annuler une demande en attente via HTTP ----
  annuler(id: number): void {
    if (!confirm('Confirmer l\'annulation de cette demande ?')) return;

    this.annulationEnCours.set(id);
    this.erreurAnnulation.set('');

    // DELETE /api/demandes/:id
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
        // Effacer le message après 4 secondes
        setTimeout(() => this.erreurAnnulation.set(''), 4000);
      }
    });
  }

  // ---- Helpers visuels ----
  getBadgeClass(statut: string): string {
    const map: Record<string, string> = {
      en_attente: 'badge-warning',
      valide:     'badge-success',
      refuse:     'badge-danger'
    };
    return map[statut] ?? 'badge-secondary';
  }

  getStatutLabel(statut: string): string {
    const map: Record<string, string> = {
      en_attente: 'En attente',
      valide:     'Approuvé',
      refuse:     'Rejeté'
    };
    return map[statut] ?? statut;
  }

  dernierCommentaire(demande: Demande): string {
    const done = demande.etapes?.filter(e => e.statut !== 'en_attente') ?? [];
    return done.length > 0 ? done[done.length - 1].commentaire ?? '—' : '—';
  }
}