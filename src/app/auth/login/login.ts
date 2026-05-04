// Component = décorateur qui dit "ce fichier est un composant Angular"
import { Component, signal } from '@angular/core';

// FormsModule = nécessaire pour utiliser [(ngModel)] dans le HTML
// ngModel = liaison bidirectionnelle entre le champ HTML et la variable TS
import { FormsModule } from '@angular/forms';

// CommonModule = directives de base : *ngIf, *ngFor, etc.
import { CommonModule } from '@angular/common';

// Router = pour naviguer entre pages depuis le TypeScript
import { Router } from '@angular/router';

// On importe notre service
import { AuthService } from '../../services/auth.service';

@Component({
  // Nom de la balise HTML pour utiliser ce composant : <app-login>
  selector: 'app-login',

  // Ce composant est autonome (standalone = true)
  // Il importe lui-même ce dont il a besoin, sans module externe
  standalone: true,

  // On déclare les imports nécessaires pour ce composant
  imports: [CommonModule, FormsModule],

  // Le fichier HTML associé
  templateUrl: './login.html',

  // Le fichier SCSS associé
  styleUrl: './login.scss'
})
export class LoginComponent {

  // Ces variables sont liées aux champs du formulaire HTML
  // Quand l'utilisateur tape, ces variables se mettent à jour (ngModel)
  email = '';
  password = '';

  // signal(false) = état réactif initialement à false
  // showPassword contrôle si le mot de passe est visible ou masqué
  showPassword = signal(false);

  // loading = true pendant la vérification (affiche un spinner)
  loading = signal(false);

  // errorMessage = message d'erreur à afficher si connexion échoue
  errorMessage = signal('');

  // Ajoute ces 2 choses dans la classe LoginComponent

// 1. Liste des comptes démo — à mettre après errorMessage
demoAccounts = [
  { label: 'Employé', email: 'ama.koudjo@homintec.com'    },
  { label: 'Manager', email: 'kofi.agossou@homintec.com'  },
  { label: 'RH',      email: 'adjoa.dossou@homintec.com'  },
  { label: 'Admin',   email: 'komi.gbenou@homintec.com'   },
  { label: 'SD',      email: 'audrey.gbenou@homintec.com' },
];

// 2. Méthode pour remplir le formulaire automatiquement au clic
remplirDemo(email: string): void {
  this.email    = email;
  this.password = 'homintec2024';
  this.errorMessage.set('');
}

  // Le constructeur reçoit les services par injection
  // Angular crée et passe automatiquement les instances
  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    // Si quelqu'un est déjà connecté, on le redirige directement
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/dashboard']);
    }
  }



  // Appelée quand l'utilisateur soumet le formulaire
  onSubmit(): void {
    // On efface les erreurs précédentes
    this.errorMessage.set('');

    // Vérification basique : les champs sont-ils remplis ?
    if (!this.email || !this.password) {
      this.errorMessage.set('Veuillez remplir tous les champs.');
      return; // On arrête ici, pas la peine d'aller plus loin
    }

    // On active le spinner de chargement
    this.loading.set(true);

    // setTimeout simule un appel réseau (800ms)
    // En production, ce sera un vrai appel HTTP vers Spring Boot
    setTimeout(() => {
      // On appelle le service pour vérifier les identifiants
      const succes = this.authService.login(this.email, this.password);

      if (succes) {
        // Connexion réussie → on navigue vers le dashboard
        this.router.navigate(['/dashboard']);
      } else {
        // Connexion échouée → message d'erreur
        this.errorMessage.set('Email ou mot de passe incorrect.');
        // On désactive le spinner
        this.loading.set(false);
      }
    }, 800);
  }
}