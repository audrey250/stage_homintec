import { Injectable, signal } from '@angular/core';

export type StatutDemande = 'en_attente' | 'approuve' | 'rejete';
export type TypeDemande   = 'conge_annuel' | 'conge_maladie' |
                            'conge_maternite' | 'permission' | 'autre';

export interface Demande {
  id: number;
  employeId: number;
  employeNom: string;
  employePrenom: string;
  departement: string;
  type: TypeDemande;
  dateDebut: string;
  dateFin: string;
  nbJours: number;
  motif: string;
  statut: StatutDemande;
  dateDemande: string;
  commentaireValidateur?: string;
  validateurNom?: string;
  dateValidation?: string;
}

@Injectable({ providedIn: 'root' })
export class CongeService {

  // ---- Données temporaires (à remplacer par HTTP Spring Boot) ----
  private _demandes = signal<Demande[]>([
    {
      id: 1,
      employeId: 1, employeNom: 'Koudjo', employePrenom: 'Ama',
      departement: 'Technique', type: 'conge_annuel',
      dateDebut: '2024-02-01', dateFin: '2024-02-10', nbJours: 8,
      motif: 'Congé annuel planifié', statut: 'en_attente',
      dateDemande: '2024-01-20'
    },
    {
      id: 2,
      employeId: 1, employeNom: 'Koudjo', employePrenom: 'Ama',
      departement: 'Technique', type: 'permission',
      dateDebut: '2024-01-25', dateFin: '2024-01-25', nbJours: 1,
      motif: 'Rendez-vous médical', statut: 'approuve',
      dateDemande: '2024-01-18',
      commentaireValidateur: 'Approuvé sans problème.',
      validateurNom: 'Agossou Kofi', dateValidation: '2024-01-19'
    },
    {
      id: 3,
      employeId: 3, employeNom: 'Dossou', employePrenom: 'Adjoa',
      departement: 'RH', type: 'conge_maladie',
      dateDebut: '2024-01-15', dateFin: '2024-01-17', nbJours: 3,
      motif: 'Maladie', statut: 'approuve',
      dateDemande: '2024-01-15',
      commentaireValidateur: 'Soignez-vous bien.',
      validateurNom: 'Gbénou Komi', dateValidation: '2024-01-15'
    },
    {
      id: 4,
      employeId: 1, employeNom: 'Koudjo', employePrenom: 'Ama',
      departement: 'Technique', type: 'conge_annuel',
      dateDebut: '2024-03-10', dateFin: '2024-03-15', nbJours: 4,
      motif: 'Vacances familiales', statut: 'rejete',
      dateDemande: '2024-01-10',
      commentaireValidateur: 'Période chargée, merci de reporter.',
      validateurNom: 'Agossou Kofi', dateValidation: '2024-01-12'
    },
    {
      id: 5,
      employeId: 2, employeNom: 'Agossou', employePrenom: 'Kofi',
      departement: 'Technique', type: 'permission',
      dateDebut: '2024-02-05', dateFin: '2024-02-05', nbJours: 1,
      motif: 'Démarche administrative', statut: 'en_attente',
      dateDemande: '2024-01-28'
    },
  ]);

  demandes = this._demandes.asReadonly();

  // Soumettre une nouvelle demande
  soumettre(data: Partial<Demande>): void {
    const maxId = Math.max(...this._demandes().map(d => d.id));
    const nouvelle: Demande = {
      id: maxId + 1,
      employeId:    data.employeId!,
      employeNom:   data.employeNom!,
      employePrenom: data.employePrenom!,
      departement:  data.departement!,
      type:         data.type as TypeDemande,
      dateDebut:    data.dateDebut!,
      dateFin:      data.dateFin!,
      nbJours:      data.nbJours!,
      motif:        data.motif!,
      statut:       'en_attente',
      dateDemande:  new Date().toISOString().split('T')[0],
    };
    this._demandes.update(liste => [...liste, nouvelle]);
  }

  // Valider ou rejeter une demande
  valider(
    id: number,
    statut: 'approuve' | 'rejete',
    commentaire: string,
    validateurNom: string
  ): void {
    this._demandes.update(liste =>
      liste.map(d => d.id === id ? {
        ...d,
        statut,
        commentaireValidateur: commentaire,
        validateurNom,
        dateValidation: new Date().toISOString().split('T')[0]
      } : d)
    );
  }

  getEnAttente(): Demande[] {
    return this._demandes().filter(d => d.statut === 'en_attente');
  }

  getParEmploye(employeId: number): Demande[] {
    return this._demandes().filter(d => d.employeId === employeId);
  }
}