// ============================================================
// src/app/departements/liste-departements/liste-departements.ts
// RÔLE : Affiche la liste des départements avec recherche
//        et actions CRUD
// ============================================================

import { Component, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

// On importe le service et les interfaces
import {
  DepartementService,
  Departement
} from '../../services/departement.service';

@Component({
  selector: 'app-liste-departements',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './liste-departements.html',
  styleUrl:    './liste-departements.scss'
})
export class ListeDepartementsComponent implements OnInit {

  // ---- Recherche ----
  // signal('') = texte vide au départ
  recherche = signal('');

  // ---- Suppression ----
  // signal<number | null>(null) = aucun département sélectionné pour suppression
  confirmSupprId = signal<number | null>(null);
  erreurSuppr    = signal('');

  // ---- Formulaire d'ajout/édition (modal) ----
  modalOuvert    = signal(false);
  // null = création, number = édition de ce département
  modeEditionId  = signal<number | null>(null);
  formLoading    = signal(false);
  formErreur     = signal('');

  // Données du formulaire
  form = {
    nom:         '',
    description: ''
  };

  erreurs: Record<string, string> = {};

  // ---- Liste filtrée ----
  // computed() se recalcule automatiquement quand recherche() ou
  // departementService.departements() changent
  departementsFiltres = computed(() => {
    const q = this.recherche().toLowerCase().trim();
    const tous: Departement[] = this.departementService.departements();

    if (!q) return tous;
    return tous.filter((d: Departement) =>
      d.nom.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q)
    );
  });

  // ---- Statistiques ----
  stats = computed(() => {
    const tous: Departement[] = this.departementService.departements();
    return {
      total:        tous.length,
      totalEmployes: tous.reduce((sum, d) => sum + d.nbEmployes, 0)
    };
  });

  // public → le HTML peut accéder à departementService.loading()
  constructor(public departementService: DepartementService) {}

  // ngOnInit → appelé automatiquement quand le composant s'affiche
  ngOnInit(): void {
    // Charge la liste depuis Spring Boot
    this.departementService.chargerTout();
  }

  // ============================================================
  // MODAL FORMULAIRE
  // ============================================================

  // Ouvrir le modal en mode CRÉATION
  ouvrirCreation(): void {
    this.modeEditionId.set(null);
    this.form = { nom: '', description: '' };
    this.erreurs = {};
    this.formErreur.set('');
    this.modalOuvert.set(true);
  }

  // Ouvrir le modal en mode ÉDITION
  // On charge les données du département sélectionné
  ouvrirEdition(dept: Departement): void {
    this.modeEditionId.set(dept.id);
    // On pré-remplit le formulaire avec les données existantes
    this.form = {
      nom:         dept.nom,
      description: dept.description
    };
    this.erreurs = {};
    this.formErreur.set('');
    this.modalOuvert.set(true);
  }

  fermerModal(): void {
    this.modalOuvert.set(false);
    this.formLoading.set(false);
  }

  // ============================================================
  // VALIDATION DU FORMULAIRE
  // ============================================================
  private valider(): boolean {
    this.erreurs = {};

    if (!this.form.nom.trim()) {
      this.erreurs['nom'] = 'Le nom est obligatoire.';
    } else if (this.form.nom.trim().length < 2) {
      this.erreurs['nom'] = 'Le nom doit contenir au moins 2 caractères.';
    } else if (
      this.departementService.nomExiste(
        this.form.nom.trim(),
        this.modeEditionId() ?? undefined
      )
    ) {
      // On exclut le département en cours d'édition de la vérification
      this.erreurs['nom'] = 'Ce nom de département existe déjà.';
    }

    if (!this.form.description.trim()) {
      this.erreurs['description'] = 'La description est obligatoire.';
    }

    return Object.keys(this.erreurs).length === 0;
  }

  // ============================================================
  // SOUMISSION (création ou édition selon modeEditionId)
  // ============================================================
  soumettre(): void {
    if (!this.valider()) return;

    this.formLoading.set(true);
    this.formErreur.set('');

    const data = {
      nom:         this.form.nom.trim(),
      description: this.form.description.trim()
    };

    const idEdition = this.modeEditionId();

    // Si modeEditionId est null → création
    // Sinon → modification
    const operation = idEdition === null
      ? this.departementService.creer(data)
      : this.departementService.modifier(idEdition, data);

    operation.subscribe({
      next: () => {
        this.formLoading.set(false);
        this.fermerModal();
      },
      error: (err: HttpErrorResponse) => {
        this.formLoading.set(false);
        if (err.status === 409) {
          this.erreurs['nom'] = 'Ce nom de département existe déjà.';
        } else if (err.status === 0) {
          this.formErreur.set('Serveur inaccessible.');
        } else {
          this.formErreur.set(
            err.error?.message || 'Une erreur est survenue.'
          );
        }
      }
    });
  }

  // ============================================================
  // SUPPRESSION
  // ============================================================
  demanderSuppression(id: number): void {
    this.confirmSupprId.set(id);
    this.erreurSuppr.set('');
  }

  annulerSuppression(): void {
    this.confirmSupprId.set(null);
  }

  confirmerSuppression(): void {
    const id = this.confirmSupprId();
    if (id === null) return;

    this.departementService.supprimer(id).subscribe({
      next: () => {
        this.confirmSupprId.set(null);
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 409) {
          // Spring Boot refuse si des employés sont encore dans ce département
          this.erreurSuppr.set(
            'Impossible de supprimer : ce département contient des employés.'
          );
        } else {
          this.erreurSuppr.set('Erreur lors de la suppression.');
        }
      }
    });
  }

  get nomASupprimer(): string {
    const id = this.confirmSupprId();
    if (id === null) return '';
    const d = this.departementService.departements()
      .find((d: Departement) => d.id === id);
    return d?.nom ?? '';
  }

  get titreModal(): string {
    return this.modeEditionId() === null
      ? 'Nouveau département'
      : 'Modifier le département';
  }
}