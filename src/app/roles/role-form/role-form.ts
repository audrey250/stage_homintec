import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { RoleForm, RoleService } from '../../services/role.service';

@Component({
  selector: 'app-role-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './role-form.html',
  styleUrl: './role-form.scss'
})
export class RoleFormComponent implements OnInit {
  modeEditionId = signal<number | null>(null);
  loading = signal(false);
  succes = signal(false);
  erreur = signal('');

  form: RoleForm = {
    nom: '',
    description: ''
  };

  erreurs: Record<string, string> = {};

  constructor(
    private roleService: RoleService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.roleService.chargerTout();

    const idParam = this.route.snapshot.paramMap.get('id');
    if (!idParam) {
      return;
    }

    const id = parseInt(idParam, 10);
    this.modeEditionId.set(id);
    this.chargerRole(id);
  }

  private chargerRole(id: number): void {
    this.loading.set(true);

    this.roleService.getById(id).subscribe({
      next: (role) => {
        this.form = {
          nom: role.nom,
          description: role.description ?? ''
        };
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        if (err.status === 404) {
          this.erreur.set('Role introuvable.');
          return;
        }

        this.erreur.set('Impossible de charger ce role.');
      }
    });
  }

  private valider(): boolean {
    this.erreurs = {};

    if (!this.form.nom.trim()) {
      this.erreurs['nom'] = 'Le nom est obligatoire.';
    } else if (this.form.nom.trim().length < 2) {
      this.erreurs['nom'] = 'Minimum 2 caracteres.';
    } else if (this.roleService.nomExiste(this.form.nom.trim(), this.modeEditionId() ?? undefined)) {
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
    if (!this.valider()) {
      return;
    }

    this.loading.set(true);
    this.erreur.set('');

    const data: RoleForm = {
      nom: this.form.nom.trim(),
      description: (this.form.description ?? '').trim()
    };

    const id = this.modeEditionId();
    const operation = id === null
      ? this.roleService.creer(data)
      : this.roleService.modifier(id, data);

    operation.subscribe({
      next: () => {
        this.loading.set(false);
        this.succes.set(true);
        setTimeout(() => this.router.navigate(['/roles']), 1400);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);

        if (err.status === 409) {
          this.erreurs['nom'] = 'Ce role existe deja.';
          return;
        }

        if (err.status === 0) {
          this.erreur.set('Serveur inaccessible.');
          return;
        }

        this.erreur.set(err.error?.message || 'Erreur lors de l\'enregistrement.');
      }
    });
  }

  annuler(): void {
    this.router.navigate(['/roles']);
  }

  get titreFormulaire(): string {
    return this.modeEditionId() === null ? 'Nouveau role' : 'Modifier le role';
  }

  get labelBouton(): string {
    if (this.loading()) {
      return 'Enregistrement...';
    }

    return this.modeEditionId() === null ? 'Creer' : 'Enregistrer';
  }
}
