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
  DemandeService,
  Demande,
  DecisionDemande
} from '../../services/demande.service';

@Component({
  selector: 'app-validation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './validation.html',
  styleUrls: ['./validation.css']
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
  demandesEnAttente = computed(() => {
    const role = this.currentRole();
    if (!role) return [];
    return this.congeService.getEnAttentePour(role);
  });

  demandesTraitees = computed(() =>
    this.congeService.demandes().filter(d => d.statut !== 'en_attente')
  );

  constructor(
    public authService:  AuthService,
    public congeService: DemandeService
  ) {}

  currentRole(): string {
    const user = this.authService.currentUser();
    if (!user) return '';
    return (user.role?.nom || user.Poste || '')
      .toString()
      .trim()
      .toLowerCase();
  }

  // ---- Au chargement : récupère toutes les demandes depuis Spring Boot ----
  ngOnInit(): void {
    this.congeService.chargerTout();
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
      statut:      action === 'approuver' ? 'valide' : 'refuse',
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
    const done = demande.etapes.filter(e => e.statut !== 'en_attente');
    return done.length > 0 ? done[done.length - 1].commentaire ?? '—' : '—';
  }

  // Affiche le nom complet avec fallback sur un champ `employe` si présent
  displayNom(demande: any): string {
    if (!demande) return '—';
    const prenom = demande.utilisateurPrenom ?? demande.prenom;
    const nom = demande.utilisateurNom ?? demande.nom;
    if (prenom) return `${prenom} ${nom ?? ''}`.trim();
    return demande['employe'] ?? '—';
  }

  // Calcule des initiales en évitant les erreurs si les champs manquent
  initiales(demande: any): string {
    if (!demande) return '?';
    const p = demande.utilisateurPrenom ?? demande.prenom ?? demande['employe'] ?? '';
    const n = demande.utilisateurNom ?? demande.nom ?? '';
    const a = (p && p.charAt(0)) || '';
    const b = (n && n.charAt(0)) || (p && p.charAt(1)) || '';
    const res = (a + b).toUpperCase();
    return res || '?';
  }
}