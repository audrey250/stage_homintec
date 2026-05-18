// ============================================================
// src/app/departements/departement-form/departement-form.ts
// RÔLE : Page dédiée création/édition d'un département
//        (alternative au modal — utile pour les cas complexes)
// ============================================================

import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import {
  DepartementService,
  DepartementForm
} from '../../services/departement.service';

@Component({
  selector: 'app-departement-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './ajout-departement.html',
  styleUrl:    './ajout-departement.scss'
})
export class DepartementFormComponent implements OnInit {

  // ---- Mode du formulaire ----
  // null = création / number = édition de ce département
  modeEditionId = signal<number | null>(null);

  // ---- États HTTP ----
  loading = signal(false);
  succes  = signal(false);
  erreur  = signal('');

  // ---- Données du formulaire ----
  form: DepartementForm = {
    nom:         '',
    description: ''
  };

  // ---- Erreurs par champ ----
  erreurs: Record<string, string> = {};

  constructor(
    private departementService: DepartementService,
    private router:             Router,
    private route:              ActivatedRoute
  ) {}

  // ---- Au chargement : détecter si on est en édition ----
  ngOnInit(): void {
    // ActivatedRoute permet de lire les paramètres de l'URL
    // Ex : /departements/3/modifier → id = 3
    const idParam = this.route.snapshot.paramMap.get('id');

    if (idParam) {
      // Mode édition : charger les données du département existant
      const id = parseInt(idParam, 10);
      this.modeEditionId.set(id);
      this.chargerDepartement(id);
    }
    // Sinon : mode création, le formulaire est déjà vide
  }

  // ---- Charger un département pour l'édition ----
  private chargerDepartement(id: number): void {
    this.loading.set(true);

    // GET /api/departements/:id
    this.departementService.getById(id).subscribe({
      next: (dept) => {
        // Pré-remplir le formulaire avec les données existantes
        this.form.nom         = dept.nom;
        this.form.description = dept.description;
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        if (err.status === 404) {
          this.erreur.set('Département introuvable.');
        } else {
          this.erreur.set('Impossible de charger ce département.');
        }
      }
    });
  }

  // ---- Validation des champs ----
  private valider(): boolean {
    this.erreurs = {};

    if (!this.form.nom.trim()) {
      this.erreurs['nom'] = 'Le nom est obligatoire.';
    } else if (this.form.nom.trim().length < 2) {
      this.erreurs['nom'] = 'Minimum 2 caractères.';
    } else if (
      this.departementService.nomExiste(
        this.form.nom.trim(),
        this.modeEditionId() ?? undefined
      )
    ) {
      this.erreurs['nom'] = 'Ce nom de département existe déjà.';
    }

    if (!this.form.description.trim()) {
      this.erreurs['description'] = 'La description est obligatoire.';
    } else if (this.form.description.trim().length < 10) {
      this.erreurs['description'] = 'Minimum 10 caractères.';
    }

    return Object.keys(this.erreurs).length === 0;
  }

  // ---- Soumission du formulaire ----
  soumettre(): void {
    if (!this.valider()) return;

    this.loading.set(true);
    this.erreur.set('');

    const data: DepartementForm = {
      nom:         this.form.nom.trim(),
      description: this.form.description.trim()
    };

    const idEdition = this.modeEditionId();

    // Si null → POST (création) / sinon → PUT (modification)
    const operation = idEdition === null
      ? this.departementService.creer(data)
      : this.departementService.modifier(idEdition, data);

    operation.subscribe({
      next: () => {
        this.loading.set(false);
        this.succes.set(true);
        // Redirection vers la liste après 1.5 secondes
        setTimeout(() => this.router.navigate(['/departements']), 1500);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);

        if (err.status === 409) {
          // Spring Boot renvoie 409 si le nom existe déjà côté serveur
          this.erreurs['nom'] = 'Ce nom de département existe déjà.';
        } else if (err.status === 0) {
          this.erreur.set(
            'Serveur inaccessible. Vérifiez que Spring Boot est démarré.'
          );
        } else {
          this.erreur.set(
            err.error?.message || `Erreur serveur (${err.status}).`
          );
        }
      }
    });
  }

  // ---- Annuler → retour à la liste ----
  annuler(): void {
    this.router.navigate(['/departements']);
  }

  // ---- Getters pour le HTML ----
  get titreFormulaire(): string {
    return this.modeEditionId() === null
      ? 'Nouveau département'
      : 'Modifier le département';
  }

  get labelBouton(): string {
    if (this.loading()) return 'Enregistrement...';
    return this.modeEditionId() === null ? 'Créer' : 'Enregistrer';
  }
}