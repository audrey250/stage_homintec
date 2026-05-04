import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

export interface DemandeValidation {
  id: number;
  employe: string;
  departement: string;
  type: string;
  dateDebut: string;
  dateFin: string;
  jours: number;
  motif: string;
  urgence: boolean;
  statut: 'en_attente' | 'approuve' | 'rejete';
  commentaire: string; // Commentaire du validateur
}

@Component({
  selector: 'app-validation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './validation.html',
  styleUrl: './validation.scss'
})
export class ValidationComponent {

  // Demande actuellement sélectionnée pour modale
  demandeSelectionnee = signal<DemandeValidation | null>(null);
  modeAction = signal<'approuver' | 'rejeter' | null>(null);
  commentaireAction = signal('');
  traitement = signal(false);

  demandes = signal<DemandeValidation[]>([
    {
      id: 1, employe: 'Ama Koudjo', departement: 'Technique',
      type: 'Congé annuel',
      dateDebut: '2024-02-01', dateFin: '2024-02-10', jours: 8,
      motif: 'Vacances en famille pour les fêtes.',
      urgence: false, statut: 'en_attente', commentaire: ''
    },
    {
      id: 2, employe: 'Yao Mensah', departement: 'Commercial',
      type: 'Permission',
      dateDebut: '2024-01-30', dateFin: '2024-01-30', jours: 1,
      motif: 'Rendez-vous administratif urgent.',
      urgence: true, statut: 'en_attente', commentaire: ''
    },
    {
      id: 3, employe: 'Akosua Fiagbé', departement: 'Finance',
      type: 'Congé maladie',
      dateDebut: '2024-01-25', dateFin: '2024-01-27', jours: 3,
      motif: 'Grippe avec fièvre.',
      urgence: false, statut: 'en_attente', commentaire: ''
    },
  ]);

  // Seulement les demandes en attente
  demandesEnAttente = computed(() =>
    this.demandes().filter(d => d.statut === 'en_attente')
  );

  // Demandes déjà traitées
  demandesTraitees = computed(() =>
    this.demandes().filter(d => d.statut !== 'en_attente')
  );

  constructor(public authService: AuthService) {}

  // Ouvre la modale d'action
  ouvrirAction(demande: DemandeValidation, action: 'approuver' | 'rejeter'): void {
    this.demandeSelectionnee.set(demande);
    this.modeAction.set(action);
    this.commentaireAction.set('');
  }

  fermerModal(): void {
    this.demandeSelectionnee.set(null);
    this.modeAction.set(null);
  }

  // Confirme l'action (approuver ou rejeter)
  confirmerAction(): void {
    const demande = this.demandeSelectionnee();
    const action  = this.modeAction();
    if (!demande || !action) return;

    if (action === 'rejeter' && !this.commentaireAction().trim()) {
      alert('Un commentaire est obligatoire pour rejeter.');
      return;
    }

    this.traitement.set(true);

    setTimeout(() => {
      // On met à jour le statut dans le signal
      this.demandes.update(list =>
        list.map(d => d.id === demande.id
          ? {
              ...d,
              statut: action === 'approuver' ? 'approuve' : 'rejete',
              commentaire: this.commentaireAction()
            }
          : d
        )
      );
      this.traitement.set(false);
      this.fermerModal();
    }, 700);
  }

  getBadgeClass(statut: string): string {
    const map: Record<string, string> = {
      en_attente: 'badge-warning',
      approuve:   'badge-success',
      rejete:     'badge-danger'
    };
    return map[statut] ?? 'badge-secondary';
  }
}