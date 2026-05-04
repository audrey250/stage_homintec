import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

export interface DemandeComplete {
  id: number;
  type: string;
  dateDebut: string;
  dateFin: string;
  jours: number;
  motif: string;
  statut: 'en_attente' | 'approuve' | 'rejete';
  dateCreation: string;
  commentaireRH?: string;
}

@Component({
  selector: 'app-mes-demandes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './mes-demandes.html',
  styleUrl: './mes-demandes.scss'
})
export class MesDemandesComponent {

  // Filtre actif
  filtreStatut = signal<string>('tous');

  // Toutes les demandes
  toutesLesDemandes = signal<DemandeComplete[]>([
    {
      id: 1, type: 'Congé annuel',
      dateDebut: '2024-02-01', dateFin: '2024-02-10', jours: 8,
      motif: 'Vacances en famille',
      statut: 'en_attente', dateCreation: '2024-01-20'
    },
    {
      id: 2, type: 'Permission',
      dateDebut: '2024-01-28', dateFin: '2024-01-28', jours: 1,
      motif: 'Rendez-vous médical',
      statut: 'approuve', dateCreation: '2024-01-15',
      commentaireRH: 'Approuvé par le manager.'
    },
    {
      id: 3, type: 'Congé annuel',
      dateDebut: '2023-12-24', dateFin: '2023-12-31', jours: 6,
      motif: 'Fêtes de fin d\'année',
      statut: 'approuve', dateCreation: '2023-12-01',
      commentaireRH: 'Bon repos !'
    },
    {
      id: 4, type: 'Congé maladie',
      dateDebut: '2023-11-10', dateFin: '2023-11-12', jours: 3,
      motif: 'Grippe',
      statut: 'rejete', dateCreation: '2023-11-10',
      commentaireRH: 'Justificatif médical requis.'
    },
  ]);

  // Demandes filtrées selon le filtre actif
  // computed recalcule automatiquement quand filtreStatut ou toutesLesDemandes change
  demandesFiltrees = computed(() => {
    const filtre = this.filtreStatut();
    const toutes = this.toutesLesDemandes();
    if (filtre === 'tous') return toutes;
    return toutes.filter(d => d.statut === filtre);
  });

  // Compteurs pour les onglets
  compte = computed(() => ({
    tous:       this.toutesLesDemandes().length,
    en_attente: this.toutesLesDemandes().filter(d => d.statut === 'en_attente').length,
    approuve:   this.toutesLesDemandes().filter(d => d.statut === 'approuve').length,
    rejete:     this.toutesLesDemandes().filter(d => d.statut === 'rejete').length,
  }));

  constructor(public authService: AuthService) {}

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

  // Annuler une demande en attente
  annuler(id: number): void {
    this.toutesLesDemandes.update(list =>
      list.filter(d => d.id !== id)
    );
  }
}