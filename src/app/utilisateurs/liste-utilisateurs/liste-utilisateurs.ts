// ============================================================
// src/app/utilisateurs/liste-utilisateurs/liste-utilisateurs.ts
// ============================================================

import { Component, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import Swal from 'sweetalert2';

import { UtilisateurService } from '../../services/utilisateur.service';
import { User } from '../../services/auth.service';
import { RoleService } from '../../services/role.service';
import { ServiceRHService } from '../../services/service-rh.service';
import { DepartementService } from '../../services/departement.service';

type Poste = string;

@Component({
  selector: 'app-liste-utilisateurs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './liste-utilisateurs.html',
  styleUrl: './liste-utilisateurs.css'
})
export class ListeUtilisateursComponent implements OnInit {

  // ---- Filtres ----
  recherche  = signal('');
  filtreRole = signal('');
  filtreDept = signal('');

  // ---- Modal et formulaire ----
  modalOuvert = signal(false);
  formLoading = signal(false);
  formErreur = signal('');

  form = {
    prenom: '',
    nom: '',
    email: '',
    poste: '' as Poste | '',
    roleId: '',
    serviceId: '',
    departementId: '',
  };

  erreurs: Record<string, string> = {};

  // ---- Stats ----
  stats = computed(() => {
    const tous: User[] = this.utilisateurService.utilisateurs();
    return {
      total: tous.length,
      employes: tous.filter(u => this.getPoste(u) === 'employe').length,
      managers: tous.filter(u => this.getPoste(u) === 'manager').length,
      rh: tous.filter(u => this.getPoste(u) === 'rh').length,
      admins: tous.filter(u => this.getPoste(u) === 'admin').length,
    };
  });

  // ---- Départements uniques ----
  departements = computed(() => {
    const tous: User[] = this.utilisateurService.utilisateurs();
    return [...new Set(tous.map(u => this.getServiceId(u)))].sort();
  });

  // ---- Liste filtrée ----
  utilisateursFiltres = computed(() => {
    const q = this.recherche().toLowerCase().trim();
    const poste = this.filtreRole();
    const dept = this.filtreDept();
    const tous: User[] = this.utilisateurService.utilisateurs();

    return tous.filter((u: User) => {

      const matchTexte =
        !q ||
        u.nom.toLowerCase().includes(q) ||
        u.prenom.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q);

      const matchRole = !poste || this.getPoste(u) === poste;

      const matchDept =
        !dept || String(this.getServiceId(u)) === String(dept);

      return matchTexte && matchRole && matchDept;
    });
  });

  constructor(
    public utilisateurService: UtilisateurService,
    public roleService: RoleService,
    public serviceRHService: ServiceRHService,
    public departementService: DepartementService
  ) {}

  ngOnInit(): void {
    this.utilisateurService.chargerTout();
    this.roleService.chargerTout();
    this.serviceRHService.chargerTout();
    this.departementService.chargerTout();
  }

  // ---- Helpers ----

  getPoste(u: User): string {
    return ((u as unknown as { poste?: string }).poste ?? u.Poste ?? '').toLowerCase();
  }

  getServiceId(u: User): string | number {
    return (u as unknown as { serviceId?: string | number }).serviceId ?? u.departementId;
  }

  getServiceNom(serviceId: string | number): string {
    const service = this.serviceRHService.services().find(s => String(s.id) === String(serviceId));
    return service?.nom ?? '-';
  }

  getDepartementNom(departementId: number): string {
    const dept = this.departementService.departements().find(d => String(d.id) === String(departementId));
    return dept?.nom ?? '-';
  }

  demanderSuppression(u: User): void {
    Swal.fire({
      title: 'Confirmer la suppression',
      text: `Supprimer l'utilisateur "${u.prenom} ${u.nom}" ?`,
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

      this.utilisateurService.supprimer(u.id).subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Supprime',
            text: 'Utilisateur supprime avec succes',
            timer: 1400,
            showConfirmButton: false
          });
        },
        error: (err: HttpErrorResponse) => {
          Swal.fire({
            icon: 'error',
            title: 'Erreur',
            text: err.status === 403
              ? "Vous n'avez pas les droits pour supprimer cet utilisateur."
              : (err.error?.message || 'Erreur lors de la suppression.')
          });
        }
      });
    });
  }

  couleurRole(poste: string): string {
    const map: Record<string, string> = {
      admin: 'admin',
      rh: 'rh',
      manager: 'manager',
      employe: 'employe',
    };
    return map[(poste || '').toLowerCase()] || 'employe';
  }

  libelleRole(poste: string): string {
    const map: Record<string, string> = {
      admin: 'Admin',
      rh: 'RH',
      manager: 'Manager',
      employe: 'Employé',
    };
    return map[poste] || poste;
  }

  initiales(u: User): string {
    return (u.prenom.charAt(0) + u.nom.charAt(0)).toUpperCase();
  }

  couleurAvatar(poste: string): string {
    const map: Record<string, string> = {
      admin: '#e74c3b',
      rh: '#17a2b8',
      manager: '#1cc88a',
      employe: '#4e73df',
    };
    return map[poste] || '#4e73df';
  }

  ouvrirModal(): void {
    this.form = {
      prenom: '',
      nom: '',
      email: '',
      poste: '' as Poste | '',
      roleId: '',
      serviceId: '',
      departementId: '',
    };
    this.formErreur.set('');
    this.erreurs = {};
    this.modalOuvert.set(true);
  }

  fermerModal(): void {
    if (this.formLoading()) {
      return;
    }

    this.modalOuvert.set(false);
  }

  private validerForm(): boolean {
    this.erreurs = {};

    if (!this.form.prenom.trim()) {
      this.erreurs['prenom'] = 'Le prenom est obligatoire.';
    }

    if (!this.form.nom.trim()) {
      this.erreurs['nom'] = 'Le nom est obligatoire.';
    }

    if (!this.form.email.trim()) {
      this.erreurs['email'] = 'L\'email est obligatoire.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.form.email.trim())) {
      this.erreurs['email'] = 'Format d\'email invalide.';
    } else if (this.utilisateurService.emailExiste(this.form.email.trim())) {
      this.erreurs['email'] = 'Cet email est deja utilise.';
    }

    if (!this.form.poste) {
      this.erreurs['poste'] = 'Le poste est obligatoire.';
    }

    if (!this.form.roleId) {
      this.erreurs['roleId'] = 'Le role est obligatoire.';
    }

    if (!this.form.serviceId) {
      this.erreurs['serviceId'] = 'Le service est obligatoire.';
    }
if (!this.form.departementId) {
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

    this.utilisateurService.ajouter({
      prenom: this.form.prenom.trim(),
      nom: this.form.nom.trim(),
      email: this.form.email.trim(),
      poste: this.form.poste,
      roleId: this.form.roleId,
      serviceId: this.form.serviceId,
      departementId: this.form.departementId ? parseInt(this.form.departementId as string, 10) : undefined,
    }).subscribe({
      next: () => {
        this.formLoading.set(false);
        Swal.fire({
          icon: 'success',
          title: 'Utilisateur ajoute',
          text: 'Le compte a ete cree avec succes',
          timer: 1400,
          showConfirmButton: false
        });
        this.fermerModal();
      },
      error: (err: HttpErrorResponse) => {
        this.formLoading.set(false);
        if (err.status === 409) {
          this.erreurs['email'] = 'Cet email est deja utilise.';
          return;
        }

        if (err.status === 0) {
          this.formErreur.set('Serveur inaccessible.');
          return;
        }

        this.formErreur.set(err.error?.message || 'Erreur lors de la creation.');
      }
    });
  }
}