import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService, User } from '../services/auth.service';

// Interface pour une demande de congé
export interface Demande {
  id: number;
  employe: string;
  type: 'Congé annuel' | 'Permission' | 'Congé maladie';
  dateDebut: string;
  dateFin: string;
  jours: number;
  statut: 'en_attente' | 'approuve' | 'rejete';
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent implements OnInit {

  // L'utilisateur connecté
  user = signal<User | null>(null);

  // Statistiques affichées dans les cartes
  stats = signal({
    demandesEnAttente: 4,
    congesApprouves:   12,
    soldeConges:       18,
    soldePermissions:  3
  });

  // Fausses demandes récentes pour la démo
  demandesRecentes = signal<Demande[]>([
    {
      id: 1,
      employe: 'Ama Koudjo',
      type: 'Congé annuel',
      dateDebut: '2024-02-01',
      dateFin: '2024-02-10',
      jours: 8,
      statut: 'en_attente'
    },
    {
      id: 2,
      employe: 'Kofi Agossou',
      type: 'Permission',
      dateDebut: '2024-01-28',
      dateFin: '2024-01-28',
      jours: 1,
      statut: 'approuve'
    },
    {
      id: 3,
      employe: 'Adjoa Dossou',
      type: 'Congé maladie',
      dateDebut: '2024-01-20',
      dateFin: '2024-01-25',
      jours: 5,
      statut: 'approuve'
    },
    {
      id: 4,
      employe: 'Komi Gbénou',
      type: 'Congé annuel',
      dateDebut: '2024-01-15',
      dateFin: '2024-01-17',
      jours: 3,
      statut: 'rejete'
    },
  ]);

  constructor(public authService: AuthService) {}

  ngOnInit(): void {
    // On récupère l'utilisateur connecté au chargement
    this.user.set(this.authService.currentUser());

    // On met à jour le solde selon l'utilisateur réel
    const u = this.user();
    if (u) {
      this.stats.update(s => ({
        ...s, // On garde les autres valeurs
        soldeConges: u.soldeConges,
        soldePermissions: u.soldePermissions
      }));
    }
  }

  // Retourne la classe CSS selon le statut
  getBadgeClass(statut: string): string {
    const classes: Record<string, string> = {
      'en_attente': 'badge-warning',
      'approuve':   'badge-success',
      'rejete':     'badge-danger'
    };
    return classes[statut] ?? 'badge-secondary';
  }

  // Retourne le texte lisible du statut
  getStatutLabel(statut: string): string {
    const labels: Record<string, string> = {
      'en_attente': 'En attente',
      'approuve':   'Approuvé',
      'rejete':     'Rejeté'
    };
    return labels[statut] ?? statut;
  }
}