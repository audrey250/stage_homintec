import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-nouvelle-demande',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './nouvelle-demande.html',
  styleUrl: './nouvelle-demande.scss'
})
export class NouvelleDemandeComponent {

  // Données du formulaire
  formData = signal({
    type: '',
    dateDebut: '',
    dateFin: '',
    motif: '',
    urgence: false
  });

  // États UI
  loading = signal(false);
  succes  = signal(false);
  erreur  = signal('');

  // Types disponibles
  types = [
    { value: 'conge_annuel',  label: 'Congé annuel',   icone: 'fa-umbrella-beach', couleur: 'text-primary' },
    { value: 'permission',    label: 'Permission',      icone: 'fa-clock',          couleur: 'text-warning' },
    { value: 'conge_maladie', label: 'Congé maladie',  icone: 'fa-heartbeat',      couleur: 'text-danger'  },
  ];

  // Calcul automatique du nombre de jours
  // computed() = recalcule automatiquement quand formData change
  nombreJours = computed(() => {
    const { dateDebut, dateFin } = this.formData();
    if (!dateDebut || !dateFin) return 0;
    const d1 = new Date(dateDebut);
    const d2 = new Date(dateFin);
    if (d2 < d1) return 0;
    // Différence en millisecondes → jours
    const diff = (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24);
    return Math.round(diff) + 1;
  });

  // Date minimale = aujourd'hui (empêche de choisir le passé)
  dateMin = new Date().toISOString().split('T')[0];

  constructor(
    public authService: AuthService,
    private router: Router
  ) {}

  // Met à jour un champ du formulaire
  // On utilise update() pour modifier partiellement le signal
  updateField(field: string, value: any): void {
    this.formData.update(f => ({ ...f, [field]: value }));
    this.erreur.set('');
  }

  onSubmit(): void {
    const f = this.formData();

    // Validations
    if (!f.type) {
      this.erreur.set('Veuillez choisir un type de demande.'); return;
    }
    if (!f.dateDebut || !f.dateFin) {
      this.erreur.set('Veuillez renseigner les dates.'); return;
    }
    if (new Date(f.dateFin) < new Date(f.dateDebut)) {
      this.erreur.set('La date de fin doit être après la date de début.'); return;
    }
    if (!f.motif.trim()) {
      this.erreur.set('Veuillez renseigner un motif.'); return;
    }

    // Vérifier solde suffisant
    const user = this.authService.currentUser();
    if (user && f.type === 'conge_annuel' && this.nombreJours() > user.soldeConges) {
      this.erreur.set(`Solde insuffisant. Vous avez ${user.soldeConges} jours disponibles.`);
      return;
    }

    this.loading.set(true);

    // Simulation envoi (800ms)
    setTimeout(() => {
      this.loading.set(false);
      this.succes.set(true);
      // Redirection vers mes-demandes après 2 secondes
      setTimeout(() => this.router.navigate(['/conges/mes-demandes']), 2000);
    }, 800);
  }

  reset(): void {
    this.formData.set({ type: '', dateDebut: '', dateFin: '', motif: '', urgence: false });
    this.succes.set(false);
    this.erreur.set('');
  }
}