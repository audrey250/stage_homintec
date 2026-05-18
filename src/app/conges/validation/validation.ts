// ============================================================
// src/app/conges/validation/validation.ts
// VERSION SPRING BOOT
// ============================================================

import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import {
  CongeService,
  Demande,
  DecisionDemande
} from '../../services/conge.service';

@Component({
  selector: 'app-validation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './validation.html',
  styleUrl: './validation.css'
})
export class ValidationComponent implements OnInit {

  // Demande ouverte dans la modale
  demandeSelectionnee = signal<Demande | null>(null);
  modeAction          = signal<'approuver' | 'rejeter' | null>(null);
  commentaireAction   = signal('');

  // États HTTP
  traitement   = signal(false);
  erreurAction = signal('');

  // Computed depuis le cache du service (se met à jour automatiquement)
  demandesEnAttente = computed(() =>
    this.congeService.demandes().filter(d => d.statut === 'en_attente')
  );

  demandesTraitees = computed(() =>
    this.congeService.demandes().filter(d => d.statut !== 'en_attente')
  );

  constructor(
    public authService:  AuthService,
    public congeService: CongeService
  ) {}

  // ---- Au chargement : récupère toutes les demandes depuis Spring Boot ----
  ngOnInit(): void {
    this.congeService.chargerTout().subscribe({
      error: (err: HttpErrorResponse) => {
        console.error('Erreur chargement demandes', err);
      }
    });
  }

  // ---- Ouvrir la modale ----
  ouvrirAction(
    demande: Demande,
    action: 'approuver' | 'rejeter'
  ): void {
    this.demandeSelectionnee.set(demande);
    this.modeAction.set(action);
    this.commentaireAction.set('');
    this.erreurAction.set('');
  }

  fermerModal(): void {
    this.demandeSelectionnee.set(null);
    this.modeAction.set(null);
    this.erreurAction.set('');
  }

  // ---- Confirmer l'action via HTTP ----
  confirmerAction(): void {
    const demande = this.demandeSelectionnee();
    const action  = this.modeAction();
    if (!demande || !action) return;

    // Commentaire obligatoire pour un rejet
    if (action === 'rejeter' && !this.commentaireAction().trim()) {
      this.erreurAction.set(
        'Un commentaire est obligatoire pour rejeter une demande.'
      );
      return;
    }

    this.traitement.set(true);
    this.erreurAction.set('');

    const decision: DecisionDemande = {
      statut:      action === 'approuver' ? 'approuve' : 'rejete',
      commentaire: this.commentaireAction().trim()
    };

    // PUT /api/demandes/:id/decision
    this.congeService.decider(demande.id, decision).subscribe({
      next: () => {
        this.traitement.set(false);
        this.fermerModal();
      },
      error: (err: HttpErrorResponse) => {
        this.traitement.set(false);
        if (err.status === 403) {
          this.erreurAction.set(
            'Vous n\'avez pas les droits pour cette action.'
          );
        } else if (err.status === 404) {
          this.erreurAction.set('Demande introuvable.');
        } else {
          this.erreurAction.set(
            `Erreur serveur (${err.status}). Veuillez réessayer.`
          );
        }
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