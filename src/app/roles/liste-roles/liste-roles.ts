import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import Swal from 'sweetalert2';

import { RoleForm, RoleModel, RoleService } from '../../services/role.service';

@Component({
  selector: 'app-liste-roles',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './liste-roles.html',
  styleUrl: './liste-roles.scss'
})
export class ListeRolesComponent implements OnInit {
  recherche = signal('');

  modalOuvert = signal(false);
  modeEditionId = signal<number | null>(null);
  formLoading = signal(false);
  formErreur = signal('');

  form: RoleForm = {
    nom: '',
    description: ''
  };

  erreurs: Record<string, string> = {};

  stats = computed(() => ({
    total: this.roleService.roles().length
  }));

  rolesFiltres = computed(() => {
    const q = this.recherche().toLowerCase().trim();
    const tous = this.roleService.roles();

    if (!q) {
      return tous;
    }

    return tous.filter((r: RoleModel) =>
      r.nom.toLowerCase().includes(q) ||
      (r.description ?? '').toLowerCase().includes(q)
    );
  });

  constructor(public roleService: RoleService) {}

  ngOnInit(): void {
    this.roleService.chargerTout();
  }

  ouvrirCreation(): void {
    this.modeEditionId.set(null);
    this.form = {
      nom: '',
      description: ''
    };
    this.erreurs = {};
    this.formErreur.set('');
    this.modalOuvert.set(true);
  }

  ouvrirEdition(role: RoleModel): void {
    this.modeEditionId.set(role.id);
    this.form = {
      nom: role.nom,
      description: role.description ?? ''
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
      this.erreurs['nom'] = 'Le nom du role est obligatoire.';
    } else if (this.form.nom.trim().length < 2) {
      this.erreurs['nom'] = 'Minimum 2 caracteres.';
    } else if (
      this.roleService.nomExiste(
        this.form.nom.trim(),
        this.modeEditionId() ?? undefined
      )
    ) {
      this.erreurs['nom'] = 'Ce role existe deja.';
    }

    if (!(this.form.description ?? '').trim()) {
      this.erreurs['description'] = 'La description est obligatoire.';
    } else if ((this.form.description ?? '').trim().length < 10) {
      this.erreurs['description'] = 'Minimum 10 caracteres.';
    }

    return Object.keys(this.erreurs).length === 0;
  }

  soumettre(): void {
    if (!this.validerForm()) {
      return;
    }

    this.formLoading.set(true);
    this.formErreur.set('');

    const payload: RoleForm = {
      nom: this.form.nom.trim(),
      description: (this.form.description ?? '').trim()
    };

    const idEdition = this.modeEditionId();
    const operation = idEdition === null
      ? this.roleService.creer(payload)
      : this.roleService.modifier(idEdition, payload);

    operation.subscribe({
      next: () => {
        this.formLoading.set(false);
        this.modalOuvert.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.formLoading.set(false);

        if (err.status === 409) {
          this.erreurs['nom'] = 'Ce role existe deja.';
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

  demanderSuppression(id: number, nom: string): void {
    Swal.fire({
      title: 'Confirmer la suppression',
      text: `Supprimer le role "${nom}" ?`,
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

      this.roleService.supprimer(id).subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Supprime',
            text: 'Role supprime avec succes',
            timer: 1400,
            showConfirmButton: false
          });
        },
        error: (err: HttpErrorResponse) => {
        if (err.status === 409) {
          Swal.fire({
            icon: 'error',
            title: 'Suppression refusee',
            text: 'Impossible de supprimer: ce role est utilise par des utilisateurs.'
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

  get titreModal(): string {
    return this.modeEditionId() === null
      ? 'Nouveau role'
      : 'Modifier le role';
  }
}
