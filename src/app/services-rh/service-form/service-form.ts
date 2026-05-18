// ============================================================
// src/app/services-rh/service-form/service-form.ts
// RÔLE : Page dédiée création/édition d'un service RH
// ============================================================

import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import {
  ServiceRHService,
  ServiceRHForm,
  
} from '../../services/service-rh.service';
import {
  DepartementService,
  Departement
} from '../../services/departement.service';
import { UtilisateurService } from '../../services/utilisateur.service';
import { User } from '../../services/auth.service';

@Component({
  selector: 'app-service-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './service-form.html',
  styleUrl:    './service-form.scss'
})
export class ServiceFormComponent implements OnInit {

  modeEditionId = signal<number | null>(null);
  loading       = signal(false);
  succes        = signal(false);
  erreur        = signal('');

  form: ServiceRHForm = {
    nom:           '',
    description:   '',
    departementId: 0,
    responsableId: 0
  };

  erreurs: Record<string, string> = {};

  constructor(
    private serviceRHService:   ServiceRHService,
    private departementService: DepartementService,
    private utilisateurService: UtilisateurService,
    private router:             Router,
    private route:              ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Charger les listes pour les <select>
    this.departementService.chargerTout();
    this.utilisateurService.chargerTout();

    // Détecter le mode édition via l'URL
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      const id = parseInt(idParam, 10);
      this.modeEditionId.set(id);
      this.chargerService(id);
    }
  }

  private chargerService(id: number): void {
    this.loading.set(true);
    this.serviceRHService.getById(id).subscribe({
      next: (service) => {
        this.form = {
          nom:           service.nom,
          description:   service.description,
          departementId: service.departementId,
          responsableId: service.responsableId
        };
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.erreur.set(
          err.status === 404
            ? 'Service introuvable.'
            : 'Impossible de charger ce service.'
        );
      }
    });
  }

  // ---- Accesseurs pour le HTML ----
  get departements(): Departement[] {
    return this.departementService.departements();
  }

  get responsablesPossibles(): User[] {
    return this.utilisateurService.utilisateurs().filter((u: User) =>
      ['manager', 'rh', 'admin'].includes(u.role.nom)
    );
  }

  // ---- Validation ----
  private valider(): boolean {
    this.erreurs = {};

    if (!this.form.nom.trim()) {
      this.erreurs['nom'] = 'Le nom est obligatoire.';
    } else if (this.form.nom.trim().length < 2) {
      this.erreurs['nom'] = 'Minimum 2 caractères.';
    } else if (
      this.serviceRHService.nomExiste(
        this.form.nom.trim(),
        this.modeEditionId() ?? undefined
      )
    ) {
      this.erreurs['nom'] = 'Ce nom de service existe déjà.';
    }

    if (!this.form.description.trim()) {
      this.erreurs['description'] = 'La description est obligatoire.';
    } else if (this.form.description.trim().length < 10) {
      this.erreurs['description'] = 'Minimum 10 caractères.';
    }

    if (!this.form.departementId || this.form.departementId === 0) {
      this.erreurs['departementId'] = 'Le département est obligatoire.';
    }

    if (!this.form.responsableId || this.form.responsableId === 0) {
      this.erreurs['responsableId'] = 'Le responsable est obligatoire.';
    }

    return Object.keys(this.erreurs).length === 0;
  }

  // ---- Soumission ----
  soumettre(): void {
    if (!this.valider()) return;

    this.loading.set(true);
    this.erreur.set('');

    const data: ServiceRHForm = {
      nom:           this.form.nom.trim(),
      description:   this.form.description.trim(),
      departementId: Number(this.form.departementId),
      responsableId: Number(this.form.responsableId)
    };

    const idEdition = this.modeEditionId();

    const operation = idEdition === null
      ? this.serviceRHService.creer(data)
      : this.serviceRHService.modifier(idEdition, data);

    operation.subscribe({
      next: () => {
        this.loading.set(false);
        this.succes.set(true);
        setTimeout(() => this.router.navigate(['/services-rh']), 1500);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        if (err.status === 409) {
          this.erreurs['nom'] = 'Ce nom de service existe déjà.';
        } else if (err.status === 0) {
          this.erreur.set('Serveur inaccessible.');
        } else {
          this.erreur.set(err.error?.message || `Erreur (${err.status}).`);
        }
      }
    });
  }

  annuler(): void {
    this.router.navigate(['/services-rh']);
  }

  get titreFormulaire(): string {
    return this.modeEditionId() === null
      ? 'Nouveau service'
      : 'Modifier le service';
  }

  get labelBouton(): string {
    if (this.loading()) return 'Enregistrement...';
    return this.modeEditionId() === null ? 'Créer' : 'Enregistrer';
  }
}