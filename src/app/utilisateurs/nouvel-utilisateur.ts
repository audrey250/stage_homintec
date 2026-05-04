// ============================================================
// FICHIER : src/app/utilisateurs/nouvel-utilisateur/
//           nouvel-utilisateur.ts
// RÔLE    : Logique du formulaire d'ajout d'un utilisateur
// ============================================================

/*import { Component, signal } from '@angular/core';

// FormsModule → permet [(ngModel)] pour lier les champs HTML aux variables TS
import { FormsModule } from '@angular/forms';

// CommonModule → permet *ngIf, *ngFor dans le HTML
import { CommonModule } from '@angular/common';

// Router → pour naviguer vers une autre page après l'enregistrement
import { Router, RouterLink } from '@angular/router';

// Notre service qui gère la liste des utilisateurs
import { UtilisateurService } from '../services/utilisateur.service';// ---- Interface du formulaire ----
// On définit exactement la forme des données du formulaire
// C'est séparé de l'interface User car on a le mot de passe en plus
type Role = 'employe' | 'manager' | 'rh' | 'admin';

export interface FormulaireUtilisateur {
  prenom: string;
  nom: string;
  email: string;
  // role peut UNIQUEMENT avoir ces 4 valeurs (typage strict TypeScript)
  role: Role;
  departement: string;
  poste: string;
  soldeConges: number;
  soldePermissions: number;
  password: string;
  confirmPassword: string;  // Pour vérifier que les 2 mots de passe correspondent
  telephone: string;        // Optionnel
}

@Component({
  selector: 'app-nouvel-utilisateur',
  standalone: true,
  // On déclare les modules dont ce composant a besoin
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './nouvel-utilisateur.html',
  styleUrl:    './nouvel-utilisateur.scss'
})
export class NouvelUtilisateurComponent {

  // ---- États de l'interface ----
  // signal() = état réactif : quand il change, le HTML se met à jour automatiquement
  etapeActive   = signal(1);        // Formulaire en 3 étapes : 1, 2, 3
  loading       = signal(false);    // true = spinner affiché
  succes        = signal(false);    // true = message de succès affiché
  erreurGlobal  = signal('');       // Message d'erreur général
  showPassword  = signal(false);    // Afficher/masquer le mot de passe
  showConfirm   = signal(false);    // Afficher/masquer la confirmation

  // ---- Erreurs par champ ----
  // Un objet où chaque clé est le nom d'un champ et la valeur est le message d'erreur
  erreurs: Record<string, string> = {};

  // ---- Données du formulaire ----
  // Initialisées avec des valeurs par défaut vides ou raisonnables
  form: FormulaireUtilisateur = {
    prenom: '',
    nom: '',
    email: '',
    role: 'employe' as Role,      // Rôle par défaut
    departement: '',
    poste: '',
    soldeConges: 18,      // Valeur standard HOMINTEC
    soldePermissions: 3,  // Valeur standard HOMINTEC
    password: '',
    confirmPassword: '',
    telephone: ''
  };

  // ---- Listes déroulantes ----
  // Les options disponibles dans les <select>
  roles: { value: Role; label: string; icon: string }[] = [
  { value: 'employe',  label: 'Employé',           icon: 'fa-user'        },
  { value: 'manager',  label: 'Manager',           icon: 'fa-user-tie'    },
  { value: 'rh',       label: 'Responsable RH',    icon: 'fa-user-shield' },
  { value: 'admin',    label: 'Administrateur',    icon: 'fa-user-cog'    },
];
  departements = [
    'Technique',
    'Ressources Humaines',
    'Direction',
    'Commercial',
    'Finances',
    'Logistique',
    'Juridique'
  ];

  // ---- Injecter les dépendances dans le constructeur ----
  // Angular fournit automatiquement les instances
  constructor(
    private utilisateurService: UtilisateurService,
    private router: Router
  ) {} 

  // ============================================================
  // NAVIGATION ENTRE ÉTAPES
  // ============================================================

  // Aller à l'étape suivante après validation de l'étape courante
  etapeSuivante(): void {
    // On valide d'abord l'étape courante
    if (this.validerEtape(this.etapeActive())) {
      // Si valide, on passe à l'étape suivante
      this.etapeActive.update(e => e + 1);
    }
  }

  // Revenir à l'étape précédente (pas besoin de validation)
  etapePrecedente(): void {
    this.etapeActive.update(e => e - 1);
  }

  // ============================================================
  // VALIDATION PAR ÉTAPE
  // ============================================================

  validerEtape(etape: number): boolean {
    // On remet les erreurs à zéro avant de valider
    this.erreurs = {};

    if (etape === 1) {
      // ---- ÉTAPE 1 : Identité ----
      if (!this.form.prenom.trim()) {
        this.erreurs['prenom'] = 'Le prénom est obligatoire.';
      }
      if (!this.form.nom.trim()) {
        this.erreurs['nom'] = 'Le nom est obligatoire.';
      }
      if (!this.form.email.trim()) {
        this.erreurs['email'] = 'L\'email est obligatoire.';
      } else if (!this.emailValide(this.form.email)) {
        // Regex de base pour valider le format d'un email
        this.erreurs['email'] = 'Format d\'email invalide.';
      } else if (this.utilisateurService.emailExiste(this.form.email)) {
        // On vérifie si l'email existe déjà dans notre liste
        this.erreurs['email'] = 'Cet email est déjà utilisé.';
      }
      if (this.form.telephone && !this.telephoneValide(this.form.telephone)) {
        this.erreurs['telephone'] = 'Format de téléphone invalide.';
      }
    }

    if (etape === 2) {
      // ---- ÉTAPE 2 : Poste ----
      if (!this.form.departement) {
        this.erreurs['departement'] = 'Le département est obligatoire.';
      }
      if (!this.form.poste.trim()) {
        this.erreurs['poste'] = 'Le poste est obligatoire.';
      }
      if (this.form.soldeConges < 0 || this.form.soldeConges > 50) {
        this.erreurs['soldeConges'] = 'Le solde doit être entre 0 et 50 jours.';
      }
      if (this.form.soldePermissions < 0 || this.form.soldePermissions > 20) {
        this.erreurs['soldePermissions'] = 'Le solde doit être entre 0 et 20.';
      }
    }

    if (etape === 3) {
      // ---- ÉTAPE 3 : Sécurité ----
      if (!this.form.password) {
        this.erreurs['password'] = 'Le mot de passe est obligatoire.';
      } else if (this.form.password.length < 8) {
        this.erreurs['password'] = 'Minimum 8 caractères.';
      } else if (!this.passwordFort(this.form.password)) {
        this.erreurs['password'] = 'Doit contenir une majuscule, un chiffre et un caractère spécial.';
      }
      if (this.form.password !== this.form.confirmPassword) {
        this.erreurs['confirmPassword'] = 'Les mots de passe ne correspondent pas.';
      }
    }

    // S'il n'y a aucune erreur → la validation est passée
    return Object.keys(this.erreurs).length === 0;
  }

  // ============================================================
  // SOUMISSION FINALE (étape 3)
  // ============================================================

  soumettre(): void {
    // Valider l'étape 3 avant de soumettre
    if (!this.validerEtape(3)) return;

    // Activer le spinner
    this.loading.set(true);
    this.erreurGlobal.set('');

    // Simuler un délai réseau (800ms)
    // En production : appel HTTP POST vers Spring Boot
    setTimeout(() => {
      try {
        // Appel du service pour ajouter l'utilisateur
        this.utilisateurService.ajouter({
          prenom:            this.form.prenom,
          nom:               this.form.nom,
          email:             this.form.email,
          role:              this.form.role,
          departement:       this.form.departement,
          poste:             this.form.poste,
          soldeConges:       this.form.soldeConges,
          soldePermissions:  this.form.soldePermissions,
          password:          this.form.password
        });

        // Succès : on affiche le message de confirmation
        this.loading.set(false);
        this.succes.set(true);

        // Après 2.5 secondes, on redirige vers la liste
        setTimeout(() => {
          this.router.navigate(['/utilisateurs']);
        }, 2500);

      } catch (err) {
        // En cas d'erreur inattendue
        this.loading.set(false);
        this.erreurGlobal.set('Une erreur est survenue. Veuillez réessayer.');
      }
    }, 800);
  }

  // ============================================================
  // HELPERS (fonctions utilitaires)
  // ============================================================

  // Valide le format d'un email avec une expression régulière
  private emailValide(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // Valide le format d'un numéro de téléphone (accepte +229, espaces, tirets)
  private telephoneValide(tel: string): boolean {
    return /^[+\d\s\-()]{8,15}$/.test(tel);
  }

  // Un mot de passe "fort" doit avoir : 1 majuscule, 1 chiffre, 1 caractère spécial
  private passwordFort(pwd: string): boolean {
    const majuscule  = /[A-Z]/.test(pwd);
    const chiffre    = /[0-9]/.test(pwd);
    const special    = /[!@#$%^&*(),.?":{}|<>]/.test(pwd);
    return majuscule && chiffre && special;
  }

  // Force du mot de passe : retourne 0 (faible) à 4 (très fort)
  // Utilisé pour la barre de progression
  get forcePassword(): number {
    const p = this.form.password;
    if (!p) return 0;
    let score = 0;
    if (p.length >= 8)                            score++;
    if (/[A-Z]/.test(p))                          score++;
    if (/[0-9]/.test(p))                          score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(p))        score++;
    return score;
  }

  // Libellé de la force du mot de passe
  get forceLabel(): string {
    return ['', 'Faible', 'Moyen', 'Fort', 'Très fort'][this.forcePassword];
  }

  // Couleur Bootstrap selon la force
  get forceCouleur(): string {
    return ['', 'danger', 'warning', 'info', 'success'][this.forcePassword];
  }

  // Retourne les initiales de l'utilisateur pour l'aperçu
  get initiales(): string {
    const p = this.form.prenom.charAt(0).toUpperCase();
    const n = this.form.nom.charAt(0).toUpperCase();
    return p || n ? `${p}${n}` : '?';
  }

  // Retourne la couleur de l'avatar selon le rôle sélectionné
  get couleurRole(): string {
    const map: Record<string, string> = {
      admin: '#e74c3b', rh: '#17a2b8',
      manager: '#1cc88a', employe: '#4e73df'
    };
    return map[this.form.role] || '#4e73df';
  }

  // Retourne le libellé du rôle sélectionné
  get libelleRole(): string {
    return this.roles.find(r => r.value === this.form.role)?.label ?? '';
  }
}*/