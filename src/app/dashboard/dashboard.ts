// ============================================================
// src/app/dashboard/dashboard.ts
// ============================================================

import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { AuthService, User } from '../services/auth.service';
import { DemandeService, Demande } from '../services/demande.service';
import { environment } from '../../environments/environment';

const API_URL = environment.apiUrl;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit {

  // ---- Utilisateur connecté ----
  user = signal<User | null>(null);

  // ---- État de chargement ----
  loadingDemandes = signal(false);
  erreurDemandes  = signal('');

  // ---- Demandes récentes (5 dernières) ----
  // Dérivées directement du DemandeService (signal partagé)
  demandesRecentes = computed(() =>
    this.demandeService.demandes().slice(0, 5)
  );

  // ---- Stats calculées depuis les vraies données ----
  congesApprouves  = computed(() => this.demandeService.congesApprouves());
  demandesEnAttente = computed(() => this.demandeService.demandesEnAttente());
  soldeConges      = computed(() => this.demandeService.soldeConges());
  joursConsommes   = computed(() => this.demandeService.joursConsommes());

  // Pourcentage pour la barre de progression (base 30 jours)
  progressSolde = computed(() =>
    Math.round((this.soldeConges() / 30) * 100)
  );

  constructor(
    public  authService:    AuthService,
    public  demandeService: DemandeService,
    private http:           HttpClient
  ) {}

  ngOnInit(): void {
    this.user.set(this.authService.currentUser());
    this.chargerDemandes();
  }

  // ============================================================
  // Charge les demandes de l'utilisateur connecté.
  // Le DemandeService met à jour son signal interne → les computed
  // ci-dessus se recalculent automatiquement.
  // ============================================================
  chargerDemandes(): void {
    this.loadingDemandes.set(true);
    this.erreurDemandes.set('');

    this.http.get<Demande[]>(`${API_URL}/demandes/mes-demandes`).subscribe({
      next: (data) => {
        // On met à jour le signal partagé du service
        // (pas de méthode publique directe → on réutilise chargerMesDemandes)
        this.demandeService.chargerMesDemandes();
        this.loadingDemandes.set(false);
      },
      error: (err: HttpErrorResponse) => {
        // Fallback : tenter quand même via le service
        this.demandeService.chargerMesDemandes();
        this.loadingDemandes.set(false);
        if (err.status !== 0) {
          this.erreurDemandes.set('Impossible de charger les demandes récentes.');
        }
      }
    });
  }

  // ============================================================
  // APPROUVER une demande (rôles manager/rh/admin)
  // ============================================================
  approuver(id: string): void {
    this.http.put(`${API_URL}/mes-demandes/${id}/valide`, {}).subscribe({
      next: () => this.demandeService.chargerMesDemandes()
    });
  }

  // ============================================================
  // REJETER une demande
  // ============================================================
  rejeter(id: string): void {
    this.http.put(`${API_URL}/conges/${id}/rejeter`, {}).subscribe({
      next: () => this.demandeService.chargerMesDemandes(),
      error: (err: HttpErrorResponse) => console.error('Erreur rejet :', err)
    });
  }

  // ---- Helpers UI ----
  getBadgeClass(statut: string): string {
    const s = String(statut);
    if (s === 'APPROUVEE_RH')   return 'badge-success';
    if (s.includes('REFUSEE'))  return 'badge-danger';
    if (s === 'APPROUVEE_RESPONSABLE' || s === 'APPROUVEE_CHEF_DEPARTEMENT')
      return 'badge-info';
    if (s === 'EN_ATTENTE')     return 'badge-warning';
    return 'badge-secondary';
  }

  getStatutLabel(statut: string): string {
    return this.demandeService.libelleStatut(String(statut));
  }

  getTypeLabel(type: string): string {
    return this.demandeService.libelleType(type);
  }

  /** Initiales de l'employé pour l'avatar */
  initiales(d: Demande): string {
    const prenom = (d.utilisateur?.prenom ?? d.utilisateurPrenom ?? 'U').trim();
    const nom    = (d.utilisateur?.nom    ?? d.utilisateurNom    ?? 'N').trim();
    return (prenom.charAt(0) + nom.charAt(0)).toUpperCase();
  }

  nomComplet(d: Demande): string {
    const prenom = (d.utilisateur?.prenom ?? d.utilisateurPrenom ?? '').trim();
    const nom    = (d.utilisateur?.nom    ?? d.utilisateurNom   ?? '').trim();
    return `${prenom} ${nom}`.trim() || 'Utilisateur';
  }

  /** Nombre de jours de la demande affiché dans le tableau */
  joursDemandeLabel(d: Demande): string {
    const j = this.demandeService.calculerJours(d.dateDebut, d.dateFin);
    return j > 0 ? `${j}j` : '—';
  }

  estEnAttente(d: Demande): boolean {
    return d.statut === 'EN_ATTENTE';
  }
}