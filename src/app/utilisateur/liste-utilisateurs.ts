/*import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UtilisateurService, NouvelUtilisateur } from '../services/utilisateur.service';
import { User } from '../services/auth.service';

@Component({
  selector: 'app-liste-utilisateurs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './liste-utilisateurs.html',
  styleUrl: './liste-utilisateurs.scss'
})
export class ListeUtilisateursComponent {

  // Contrôle affichage du modal
  modalOuvert = signal(false);

  // Message de succès/erreur
  messageSucces = signal('');
  messageErreur = signal('');

  // Recherche
  recherche = '';

  // Formulaire vide par défaut
  form: NouvelUtilisateur = this.formVide();

  constructor(public utilisateurService: UtilisateurService) {}

  // Retourne un formulaire vide
  formVide(): NouvelUtilisateur {
    return {
      nom: '', prenom: '', email: '',
      role: 'employe', departement: '', poste: '',
      soldeConges: 18, soldePermissions: 3,
      password: ''
    };
  }

  // Utilisateurs filtrés par la recherche
  get utilisateursFiltres(): User[] {
    const q = this.recherche.toLowerCase();
    if (!q) return this.utilisateurService.utilisateurs();
    return this.utilisateurService.utilisateurs().filter(u =>
      u.nom.toLowerCase().includes(q) ||
      u.prenom.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.departement.toLowerCase().includes(q)
    );
  }

  // Ouvrir le modal
  ouvrirModal(): void {
    this.form = this.formVide();
    this.messageErreur.set('');
    this.modalOuvert.set(true);
  }

  // Fermer le modal
  fermerModal(): void {
    this.modalOuvert.set(false);
  }

  // Soumettre le formulaire
  soumettre(): void {
    this.messageErreur.set('');

    // Validations
    if (!this.form.nom || !this.form.prenom || !this.form.email) {
      this.messageErreur.set('Nom, prénom et email sont obligatoires.');
      return;
    }

    // Vérification format email basique
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.form.email)) {
      this.messageErreur.set('Format d\'email invalide.');
      return;
    }

    if (this.utilisateurService.emailExiste(this.form.email)) {
      this.messageErreur.set('Cet email est déjà utilisé.');
      return;
    }

    if (!this.form.departement || !this.form.poste) {
      this.messageErreur.set('Département et poste sont obligatoires.');
      return;
    }

    if (!this.form.password || this.form.password.length < 6) {
      this.messageErreur.set('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    // Tout est bon : on ajoute
    this.utilisateurService.ajouter(this.form);
    this.fermerModal();
    this.messageSucces.set(`✅ ${this.form.prenom} ${this.form.nom} a été ajouté avec succès.`);
    setTimeout(() => this.messageSucces.set(''), 4000);
  }

  // Couleur selon le rôle
  couleurRole(role: string): string {
    const map: Record<string, string> = {
      admin: 'danger', rh: 'info',
      manager: 'success', employe: 'primary'
    };
    return map[role] || 'secondary';
  }

  // Initiales pour l'avatar
  initiales(u: User): string {
    return `${u.prenom.charAt(0)}${u.nom.charAt(0)}`.toUpperCase();
  }
}*/