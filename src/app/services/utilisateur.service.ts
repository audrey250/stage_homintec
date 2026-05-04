import { Injectable, signal } from '@angular/core';
import { User } from './auth.service';

export type NouvelUtilisateur = Omit<User, 'id'> & { password: string };

@Injectable({ providedIn: 'root' })
export class UtilisateurService {

  // ---- Données temporaires (à remplacer par HTTP Spring Boot) ----
  private _utilisateurs = signal<User[]>([
    {
      id: 1, nom: 'Koudjo', prenom: 'Ama',
      email: 'ama.koudjo@homintec.com',
      role: 'employe', departement: 'Technique',
      poste: 'Ingénieure', soldeConges: 18, soldePermissions: 3
    },
    {
      id: 2, nom: 'Agossou', prenom: 'Kofi',
      email: 'kofi.agossou@homintec.com',
      role: 'manager', departement: 'Technique',
      poste: 'Chef de projet', soldeConges: 20, soldePermissions: 5
    },
    {
      id: 3, nom: 'Dossou', prenom: 'Adjoa',
      email: 'adjoa.dossou@homintec.com',
      role: 'rh', departement: 'RH',
      poste: 'Responsable RH', soldeConges: 20, soldePermissions: 5
    },
    {
      id: 4, nom: 'Gbénou', prenom: 'Komi',
      email: 'komi.gbenou@homintec.com',
      role: 'admin', departement: 'Direction',
      poste: 'Directeur Général', soldeConges: 25, soldePermissions: 10
    },
    {
      id: 5, nom: 'Gbénou', prenom: 'Audrey',
      email: 'audrey.gbenou@homintec.com',
      role: 'employe', departement: 'Direction',
      poste: 'Secrétaire de Direction', soldeConges: 18, soldePermissions: 3
    },
  ]);

  utilisateurs = this._utilisateurs.asReadonly();

  ajouter(data: NouvelUtilisateur): void {
    const maxId = Math.max(...this._utilisateurs().map(u => u.id));
    const { password, ...userData } = data;
    const nouvel: User = { id: maxId + 1, ...userData };
    this._utilisateurs.update(liste => [...liste, nouvel]);
  }

  supprimer(id: number): void {
    this._utilisateurs.update(liste => liste.filter(u => u.id !== id));
  }

  emailExiste(email: string): boolean {
    return this._utilisateurs().some(u => u.email === email);
  }
}