// ============================================================
// src/app/utilisateurs/liste-utilisateurs/liste-utilisateurs.ts
// ============================================================

import { Component, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { UtilisateurService } from '../../services/utilisateur.service';
import { User } from '../../services/auth.service';

type Poste = 'employe' | 'manager' | 'rh' | 'admin';

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

  // ---- Suppression ----
  confirmSupprId = signal<number | null>(null);
  suppressionErr  = signal('');

  // ---- Stats ----
  stats = computed(() => {
    const tous: User[] = this.utilisateurService.utilisateurs();
    return {
      total: tous.length,
      employes: tous.filter(u => u.Poste === 'employe').length,
      managers: tous.filter(u => u.Poste === 'manager').length,
      rh: tous.filter(u => u.Poste === 'rh').length,
      admins: tous.filter(u => u.Poste === 'admin').length,
    };
  });

  // ---- Départements uniques ----
  departements = computed(() => {
    const tous: User[] = this.utilisateurService.utilisateurs();
    return [...new Set(tous.map(u => u.departementId))].sort();
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

      const matchRole = !poste || u.Poste === poste;

      const matchDept =
        !dept || u.departementId === Number(dept);

      return matchTexte && matchRole && matchDept;
    });
  });

  constructor(public utilisateurService: UtilisateurService) {}

  ngOnInit(): void {
    this.utilisateurService.chargerTout();
  }

  // ---- Suppression ----

  demanderSuppression(id: number): void {
    this.confirmSupprId.set(id);
    this.suppressionErr.set('');
  }

  annulerSuppression(): void {
    this.confirmSupprId.set(null);
  }

  confirmerSuppression(): void {
    const id = this.confirmSupprId();
    if (id === null) return;

    this.utilisateurService.supprimer(id).subscribe({
      next: () => this.confirmSupprId.set(null),
      error: (err: HttpErrorResponse) => {
        this.suppressionErr.set(
          err.status === 403
            ? "Vous n'avez pas les droits pour supprimer cet utilisateur."
            : "Erreur lors de la suppression."
        );
      }
    });
  }

  get nomASupprimer(): string {
    const id = this.confirmSupprId();
    if (id === null) return '';

    const u = this.utilisateurService.utilisateurs()
      .find(u => u.id === id);

    return u ? `${u.prenom} ${u.nom}` : '';
  }

  // ---- Helpers ----

  couleurRole(poste: string): string {
    const map: Record<string, string> = {
      admin: 'badge-admin',
      rh: 'badge-rh',
      manager: 'badge-manager',
      employe: 'badge-employe',
    };
    return map[poste] || 'badge-employe';
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

  // ---- MODAL ----

  modalOuvert = signal(false);

  ouvrirModal(): void {
    this.modalOuvert.set(true);
  }

  fermerModal(): void {
    this.modalOuvert.set(false);
  }

  // ---- FORMULAIRE ----

  messageSucces = signal('');
  messageErreur = signal('');

  form = {
    prenom: '',
    nom: '',
    email: '',
    poste: '' as Poste,
    departementId: 0,
  };

  soumettre(): void {
    this.messageSucces.set('');
    this.messageErreur.set('');

    if (!this.form.prenom || !this.form.nom || !this.form.email) {
      this.messageErreur.set('Veuillez remplir les champs obligatoires.');
      return;
    }

    this.utilisateurService.ajouter({
      prenom: this.form.prenom,
      nom: this.form.nom,
      email: this.form.email,
      poste: this.form.poste,
      departementId: Number(this.form.departementId),
    }).subscribe({
      next: () => {
        this.messageSucces.set('Utilisateur ajouté avec succès ✅');

        this.form = {
          prenom: '',
          nom: '',
          email: '',
          poste: '' as Poste,
          departementId: 0,
        };

        this.fermerModal();
      },
      error: (err: HttpErrorResponse) => {
        this.messageErreur.set(
          err.error?.message || 'Erreur lors de la création.'
        );
      }
    });
  }
}