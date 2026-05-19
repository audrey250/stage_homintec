import { Component, computed, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import Swal from 'sweetalert2';

import {
  ServiceRH,
  ServiceRHForm,
  ServiceRHService
} from '../../services/service-rh.service';
import { DepartementService } from '../../services/departement.service';

@Component({
  selector: 'app-liste-services',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './liste-services.html',
  styleUrl: './liste-services.scss',
})
export class ListeServices implements OnInit {
  recherche = signal('');

  modalOuvert = signal(false);
  modeEditionId = signal<string | number | null>(null);
  formLoading = signal(false);
  formErreur = signal('');

  form: ServiceRHForm = {
    nom: '',
    description: '',
    departementId: ''
  };

  erreurs: Record<string, string> = {};

  servicesFiltres = computed(() => {
    const q = this.recherche().toLowerCase().trim();
    const tous = this.serviceRHService.services();

    if (!q) {
      return tous;
    }

    return tous.filter((s: ServiceRH) =>
      s.nom.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q)
    );
  });

  stats = computed(() => {
    const tous = this.serviceRHService.services();
    return {
      total: tous.length,
      totalEmployes: this.serviceRHService.totalEmployes
    };
  });

  constructor(
    public serviceRHService: ServiceRHService,
    public departementService: DepartementService
  ) {}

  ngOnInit(): void {
    this.serviceRHService.chargerTout();
    this.departementService.chargerTout();
  }

  demanderSuppression(id: string | number, nom: string): void {
    Swal.fire({
      title: 'Confirmer la suppression',
      text: `Supprimer le service "${nom}" ?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Oui, supprimer',
      cancelButtonText: 'Annuler',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.serviceRHService.supprimer(id).subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Supprime',
            text: 'Service supprime avec succes',
            timer: 1400,
            showConfirmButton: false
          });
        },
        error: (err: HttpErrorResponse) => {
          if (err.status === 409) {
            Swal.fire({
              icon: 'error',
              title: 'Suppression refusee',
              text: 'Impossible de supprimer: ce service contient des employes.'
            });
            return;
          }

          Swal.fire({
            icon: 'error',
            title: 'Erreur',
            text: err.error?.message || 'Erreur lors de la suppression.'
          });
        }
      });
    });
  }

  ouvrirCreation(): void {
    this.modeEditionId.set(null);
    this.form = {
      nom: '',
      description: '',
      departementId: ''
    };
    this.erreurs = {};
    this.formErreur.set('');
    this.modalOuvert.set(true);
  }

  ouvrirEdition(service: ServiceRH): void {
    this.modeEditionId.set(service.id);
    this.form = {
      nom: service.nom,
      description: service.description,
      departementId: service.departementId
    };
    this.erreurs = {};
    this.formErreur.set('');
    this.modalOuvert.set(true);
  }

  fermerModal(): void {
    if (this.formLoading()) {
      return;
    }
    this.modalOuvert.set(false);
    this.formErreur.set('');
    this.erreurs = {};
  }

  private validerForm(): boolean {
    this.erreurs = {};

    if (!this.form.nom.trim()) {
      this.erreurs['nom'] = 'Le nom du service est obligatoire.';
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

    if (!this.form.departementId || String(this.form.departementId).trim() === '') {
      this.erreurs['departementId'] = 'Le département est obligatoire.';
    }

    return Object.keys(this.erreurs).length === 0;
  }

  soumettre(): void {
    if (!this.validerForm()) {
      return;
    }

    this.formLoading.set(true);
    this.formErreur.set('');

    const payload: ServiceRHForm = {
      nom: this.form.nom.trim(),
      description: this.form.description.trim(),
      departementId: this.form.departementId
    };

    const idEdition = this.modeEditionId();
    const operation = idEdition === null
      ? this.serviceRHService.creer(payload)
      : this.serviceRHService.modifier(idEdition, payload);

    operation.subscribe({
      next: () => {
        this.formLoading.set(false);
        this.modalOuvert.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.formLoading.set(false);
        if (err.status === 409) {
          this.erreurs['nom'] = 'Ce nom de service existe déjà.';
          return;
        }
        if (err.status === 0) {
          this.formErreur.set('Serveur inaccessible.');
          return;
        }
        this.formErreur.set(err.error?.message || `Erreur (${err.status}).`);
      }
    });
  }

  getDepartementNom(departementId: string | number): string {
    const departement = this.departementService.departements()
      .find(d => String(d.id) === String(departementId));

    return departement?.nom ?? '-';
  }

  get titreModal(): string {
    return this.modeEditionId() === null
      ? 'Nouveau service'
      : 'Modifier le service';
  }
}
