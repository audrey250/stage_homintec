// ============================================================
// src/app/dashboard/dashboard.ts
// ============================================================

import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { AuthService, User } from '../services/auth.service';

const API_URL = 'http://localhost:8080/api';

export interface Demande {
  id:        number;
  employe:   string;
  type:      'Congé annuel' | 'Permission' | 'Congé maladie';
  dateDebut: string;
  dateFin:   string;
  jours:     number;
  statut:    'en_attente' | 'approuve' | 'rejete';
}

export interface DashboardStats {
  demandesEnAttente: number;
  congesApprouves:   number;
  soldeConges:       number;
  soldePermissions:  number;
}

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

  // ---- Stats ----
  stats = signal<DashboardStats>({
    demandesEnAttente: 0,
    congesApprouves:   0,
    soldeConges:       0,
    soldePermissions:  0
  });

  // ---- Demandes récentes ----
  demandesRecentes = signal<Demande[]>([]);

  // ---- États de chargement ----
  loadingStats    = signal(false);
  loadingDemandes = signal(false);
  erreurStats     = signal('');
  erreurDemandes  = signal('');

  constructor(
    public authService: AuthService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    // 1. Récupère l'utilisateur connecté
    this.user.set(this.authService.currentUser());

    // 2. Charge les stats depuis Spring Boot
    this.chargerStats();

    // 3. Charge les demandes récentes
    this.chargerDemandes();
  }

  // ============================================================
  // GET /api/dashboard/stats
  // Spring Boot renvoie : { demandesEnAttente, congesApprouves,
  //                         soldeConges, soldePermissions }
  // ============================================================
  chargerStats(): void {
    this.loadingStats.set(true);
    this.erreurStats.set('');

    this.http.get<DashboardStats>(`${API_URL}/dashboard/stats`)
      .subscribe({
        next: (data) => {
          this.stats.set(data);
          this.loadingStats.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.loadingStats.set(false);

         /* // Fallback : si l'API échoue, on utilise les données
          // de l'utilisateur connecté pour au moins afficher les soldes
          const u = this.user();
          if (u) {
            this.stats.update(s => ({
              ...s,
              soldeConges:      u.soldeConges,
              soldePermissions: u.soldePermissions
            }));
          }*/

          if (err.status !== 0) {
            this.erreurStats.set('Impossible de charger les statistiques.');
          }
        }
      });
  }

  // ============================================================
  // GET /api/dashboard/demandes-recentes
  // Spring Boot renvoie : Demande[] (les 5 dernières)
  // ============================================================
  chargerDemandes(): void {
    this.loadingDemandes.set(true);
    this.erreurDemandes.set('');

    this.http.get<Demande[]>(`${API_URL}/dashboard/demandes-recentes`)
      .subscribe({
        next: (data) => {
          this.demandesRecentes.set(data);
          this.loadingDemandes.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.loadingDemandes.set(false);
          if (err.status !== 0) {
            this.erreurDemandes.set('Impossible de charger les demandes.');
          }
        }
      });
  }

  // ============================================================
  // APPROUVER une demande
  // PUT /api/conges/:id/approuver
  // ============================================================
  approuver(id: number): void {
    this.http.put(`${API_URL}/conges/${id}/approuver`, {})
      .subscribe({
        next: () => {
          // Met à jour localement sans recharger toute la liste
          this.demandesRecentes.update(liste =>
            liste.map(d =>
              d.id === id ? { ...d, statut: 'approuve' } : d
            )
          );
          // Recharge les stats pour mettre à jour le compteur
          this.chargerStats();
        },
        error: (err: HttpErrorResponse) => {
          console.error('Erreur approbation :', err);
        }
      });
  }

  // ============================================================
  // REJETER une demande
  // PUT /api/conges/:id/rejeter
  // ============================================================
  rejeter(id: number): void {
    this.http.put(`${API_URL}/conges/${id}/rejeter`, {})
      .subscribe({
        next: () => {
          this.demandesRecentes.update(liste =>
            liste.map(d =>
              d.id === id ? { ...d, statut: 'rejete' } : d
            )
          );
          this.chargerStats();
        },
        error: (err: HttpErrorResponse) => {
          console.error('Erreur rejet :', err);
        }
      });
  }

  // ---- Helpers ----

  getBadgeClass(statut: string): string {
    const classes: Record<string, string> = {
      'en_attente': 'badge-warning',
      'approuve':   'badge-success',
      'rejete':     'badge-danger'
    };
    return classes[statut] ?? 'badge-secondary';
  }

  getStatutLabel(statut: string): string {
    const labels: Record<string, string> = {
      'en_attente': 'En attente',
      'approuve':   'Approuvé',
      'rejete':     'Rejeté'
    };
    return labels[statut] ?? statut;
  }
}