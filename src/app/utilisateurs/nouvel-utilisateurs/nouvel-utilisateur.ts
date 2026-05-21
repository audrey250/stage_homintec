// ============================================================
// src/app/utilisateurs/nouvel-utilisateur/nouvel-utilisateur.ts
// ============================================================

import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { UtilisateurService } from '../../services/utilisateur.service';
import { DepartementService } from '../../services/departement.service';

export interface FormulaireUtilisateur {
 
  nom:              string;
   prenom:           string;
  email:            string;
  poste:             string;
  departementId:       number|null;
  
  
}

@Component({
  selector: 'app-nouvel-utilisateur',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './nouvel-utilisateur.html',
  styleUrls: ['./nouvel-utilisateur.css']
})
export class NouvelUtilisateurComponent implements OnInit {

  etapeActive  = signal(1);
  loading      = signal(false);
  succes       = signal(false);
  erreurGlobal = signal('');
  showPassword = signal(false);
  showConfirm  = signal(false);
  

  erreurs: Record<string, string> = {};

  form: FormulaireUtilisateur = {
    prenom:           '',
    nom:              '',
    email:            '',
    poste:             '',
    departementId:      null as number | null,
   
   
  };

  

  departements = [
    'informatique'
  ];

  constructor(
    private utilisateurService: UtilisateurService,
    public departementService: DepartementService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Charger la liste complète des départements au chargement du composant
    this.departementService.chargerTout();
  }

  

  etapeSuivante(): void {
    if (this.validerEtape(this.etapeActive())) {
      this.etapeActive.update(e => e + 1);
    }
  }

  etapePrecedente(): void {
    this.etapeActive.update(e => e - 1);
  }

  validerEtape(etape: number): boolean {
    this.erreurs = {};

    if (etape === 1) {
      if (!this.form.prenom.trim())
        this.erreurs['prenom'] = 'Le prénom est obligatoire.';
      if (!this.form.nom.trim())
        this.erreurs['nom'] = 'Le nom est obligatoire.';
      if (!this.form.email.trim()) {
        this.erreurs['email'] = 'L\'email est obligatoire.';
      } else if (!this.emailValide(this.form.email)) {
        this.erreurs['email'] = 'Format d\'email invalide.';
      } else if (this.utilisateurService.emailExiste(this.form.email)) {
        this.erreurs['email'] = 'Cet email est déjà utilisé.';
      }
      
    }

    if (etape === 2) {
      if (!this.form.departementId)
        this.erreurs['departement'] = 'Le département est obligatoire.';
      if (!this.form.poste.trim())
        this.erreurs['poste'] = 'Le poste est obligatoire.';
      
    }

   
    return Object.keys(this.erreurs).length === 0;
  }

  soumettre(): void {
    if (!this.validerEtape(3)) return;

    this.loading.set(true);
    this.erreurGlobal.set('');

    // Appel HTTP POST vers Spring Boot
    this.utilisateurService.ajouter({
      prenom:            this.form.prenom,
      nom:               this.form.nom,
      email:             this.form.email,
      poste:              this.form.poste,
      departementId:       this.form.departementId!,
   
      
    }).subscribe({
      next: () => {
        this.loading.set(false);
        this.succes.set(true);
        setTimeout(() => this.router.navigate(['/utilisateurs']), 2500);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        if (err.status === 409) {
          // Conflict → email déjà utilisé côté serveur
          this.erreurs['email'] = 'Cet email est déjà utilisé.';
          this.etapeActive.set(1);
        } else if (err.status === 0) {
          this.erreurGlobal.set(
            'Serveur inaccessible. Vérifiez que Spring Boot est démarré.'
          );
        } else {
          this.erreurGlobal.set(
            err.error?.message || 'Une erreur est survenue.'
          );
        }
      }
    });
  }

  private emailValide(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
  

  get initiales(): string {
  const prenomInitiale = this.form.prenom?.trim()?.[0]?.toUpperCase() ?? '';
  const nomInitiale = this.form.nom?.trim()?.[0]?.toUpperCase() ?? '';

  const initials = prenomInitiale + nomInitiale;

  return initials || '?';
}

  get couleurPoste(): string {
    const map: Record<string, string> = {
      admin: '#e74c3b', rh: '#17a2b8',
      manager: '#1cc88a', employe: '#4e73df'
    };
    const key = (this.form.poste ?? '').toString().toLowerCase();
    if (key.includes('admin')) return map['admin'];
    if (key.includes('rh') || key.includes('responsable')) return map['rh'];
    if (key.includes('manager')) return map['manager'];
    if (key.includes('employ')) return map['employe'];
    return '#4e73df';
  }
  
}