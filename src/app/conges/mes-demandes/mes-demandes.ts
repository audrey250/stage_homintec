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
import { CongeService, Demande } from '../../services/conge.service';

@Component({
  selector: 'app-mes-demandes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './mes-demandes.html',
  styleUrl: './mes-demandes.css'
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
    return toutes.filter(d => d.statut === filtre);
  });

  // Compteurs pour les onglets
  compte = computed(() => {
    const toutes = this.congeService.demandes();
    return {
      tous:       toutes.length,
      en_attente: toutes.filter(d => d.statut === 'en_attente').length,
      approuve:   toutes.filter(d => d.statut === 'approuve').length,
      rejete:     toutes.filter(d => d.statut === 'rejete').length,
    };
  });

  constructor(
    public authService:  AuthService,
    public congeService: CongeService
  ) {}

  // ---- Au chargement : récupère les demandes de l'employé connecté ----
  ngOnInit(): void {
    this.congeService.chargerMesDemandes().subscribe({
      error: (err: HttpErrorResponse) => {
        console.error('Erreur chargement mes demandes', err);
      }
    });
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
      approuve:   'badge-success',
      rejete:     'badge-danger'
    };
    return map[statut] ?? 'badge-secondary';
  }

  getStatutLabel(statut: string): string {
    const map: Record<string, string> = {
      en_attente: 'En attente',
      approuve:   'Approuvé',
      rejete:     'Rejeté'
    };
    return map[statut] ?? statut;
  }
}