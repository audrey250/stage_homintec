// ============================================================
// FICHIER : src/app/services/service-rh.service.ts
// RÔLE    : Gère tous les appels HTTP vers Spring Boot
//           pour les services RH (entités organisationnelles)
//
// SOURCE  : Classe "Service" du diagramme de classes
//           Attributs : id_service, nom, description
//           Méthodes  : ajouter, modifier, afficher, supprimer
//
// ⚠️  Ce fichier s'appelle "service-rh.service.ts" et non
//     "service.service.ts" pour éviter la confusion avec
//     le dossier "services/" d'Angular lui-même
// ============================================================

import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';

// On importe les interfaces depuis le fichier models
// (séparation claire entre la forme des données et la logique)
import { ServiceRH, ServiceRHForm } from './service-rh.service';

// URL de base de l'API Spring Boot
// À changer uniquement ici si le serveur change d'adresse
const API_URL = 'http://localhost:8080/api';

@Injectable({ providedIn: 'root' })
// providedIn: 'root' = ce service est disponible partout dans l'app
// Angular crée une seule instance (singleton) partagée par tous les composants
export class ServiceRHService {

  // ============================================================
  // ÉTAT LOCAL (cache)
  // ============================================================

  // signal<ServiceRH[]>([]) = liste vide au démarrage
  // Sera remplie par chargerTout() au ngOnInit des composants
  // Les composants qui lisent services() se mettent à jour
  // automatiquement quand ce signal change
  private _services = signal<ServiceRH[]>([]);

  // asReadonly() = les composants peuvent LIRE mais pas modifier
  // directement. Seules les méthodes de ce service peuvent écrire
  services = this._services.asReadonly();

  // Signal de chargement — true pendant les appels HTTP
  // Utilisé dans le HTML : *ngIf="serviceRHService.loading()"
  private _loading = signal(false);
  loading = this._loading.asReadonly();

  // Signal d'erreur — message affiché dans le HTML en cas d'échec
  private _erreur = signal('');
  erreur = this._erreur.asReadonly();

  // Le constructeur reçoit HttpClient par injection de dépendances
  // HttpClient est le service Angular pour faire des requêtes HTTP
  constructor(private http: HttpClient) {}

  // ============================================================
  // CHARGER TOUS LES SERVICES
  // GET /api/services
  // Appelé dans ngOnInit() de ListeServicesComponent
  // et ServiceFormComponent (pour le <select> responsable)
  // ============================================================
  chargerTout(): void {
    // On active le spinner et on remet l'erreur à zéro
    this._loading.set(true);
    this._erreur.set('');

    this.http.get<ServiceRH[]>(`${API_URL}/services`)
      .pipe(
        // tap = exécuté quand la requête RÉUSSIT
        // sans modifier les données retournées
        tap((data: ServiceRH[]) => {
          // On remplace tout le cache par les données fraîches
          this._services.set(data);
          this._loading.set(false);
        }),
        // catchError = exécuté si la requête ÉCHOUE
        catchError((err: HttpErrorResponse) => {
          this._loading.set(false);
          this._erreur.set('Impossible de charger les services.');
          // throwError recrée un Observable en erreur
          // pour que les composants puissent aussi réagir
          return throwError(() => err);
        })
      )
      // subscribe() déclenche réellement la requête HTTP
      // (les Observables sont "lazy" — rien ne se passe sans subscribe)
      .subscribe();
  }

  // ============================================================
  // RÉCUPÉRER UN SERVICE PAR SON ID
  // GET /api/services/:id
  // Retourne un Observable (pas void) car le composant
  // ServiceFormComponent doit réagir à la réponse pour
  // pré-remplir le formulaire en mode édition
  // ============================================================
  getById(id: number): Observable<ServiceRH> {
    return this.http.get<ServiceRH>(`${API_URL}/services/${id}`)
      .pipe(
        catchError((err: HttpErrorResponse) => throwError(() => err))
      );
  }

  // ============================================================
  // CRÉER UN SERVICE
  // POST /api/services
  // Reçoit ServiceRHForm (sans id) — Spring Boot génère l'id
  // Retourne un Observable<ServiceRH> avec le service créé
  // (id généré par Spring Boot inclus dans la réponse)
  // ============================================================
  creer(data: ServiceRHForm): Observable<ServiceRH> {
    return this.http.post<ServiceRH>(`${API_URL}/services`, data)
      .pipe(
        tap((nouveau: ServiceRH) => {
          // On ajoute le nouveau service au début de la liste
          // sans recharger toute la liste depuis le serveur
          this._services.update(liste => [nouveau, ...liste]);
        }),
        catchError((err: HttpErrorResponse) => throwError(() => err))
      );
  }

  // ============================================================
  // MODIFIER UN SERVICE
  // PUT /api/services/:id
  // Envoie le formulaire complet (Spring Boot remplace tout)
  // Spring Boot renvoie le service modifié
  // ============================================================
  modifier(id: number, data: ServiceRHForm): Observable<ServiceRH> {
    return this.http.put<ServiceRH>(`${API_URL}/services/${id}`, data)
      .pipe(
        tap((modifie: ServiceRH) => {
          // On remplace SEULEMENT ce service dans le cache local
          // les autres restent inchangés
          this._services.update(liste =>
            liste.map((s: ServiceRH) => s.id === id ? modifie : s)
          );
        }),
        catchError((err: HttpErrorResponse) => throwError(() => err))
      );
  }

  // ============================================================
  // SUPPRIMER UN SERVICE
  // DELETE /api/services/:id
  // Spring Boot renvoie 204 No Content si succès
  // ou 409 Conflict si le service contient des employés
  // ============================================================
  supprimer(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/services/${id}`)
      .pipe(
        tap(() => {
          // On retire ce service du cache local
          this._services.update(liste =>
            liste.filter((s: ServiceRH) => s.id !== id)
          );
        }),
        catchError((err: HttpErrorResponse) => throwError(() => err))
      );
  }

  // ============================================================
  // VALIDATION LOCALE (sans appel HTTP)
  // Vérifie si un nom de service existe déjà dans le cache
  // Utilisé avant l'envoi du formulaire pour éviter un 409
  // ============================================================

  // idExclu = en mode édition, on exclut le service en cours
  // pour ne pas signaler une erreur sur son propre nom
  nomExiste(nom: string, idExclu?: number): boolean {
    return this._services().some((s: ServiceRH) =>
      // toLowerCase() = comparaison insensible à la casse
      s.nom.toLowerCase() === nom.toLowerCase() &&
      // Si idExclu est défini, on ignore ce service dans la vérification
      s.id !== idExclu
    );
  }

  // ============================================================
  // HELPERS POUR LES COMPOSANTS
  // ============================================================

  // Filtre les services par département
  // Utilisé dans ListeServicesComponent pour le filtre par département
  getParDepartement(departementId: number): ServiceRH[] {
    return this._services().filter(
      (s: ServiceRH) => s.departementId === departementId
    );
  }

  // Retourne les services dont un utilisateur est responsable
  // Utilisé dans ProfilComponent pour afficher "ses" services
  getParResponsable(responsableId: number): ServiceRH[] {
    return this._services().filter(
      (s: ServiceRH) => s.responsableId === responsableId
    );
  }

  // Retourne le nombre total d'employés dans tous les services
  // Utilisé dans les statistiques du dashboard
  get totalEmployes(): number {
    return this._services().reduce(
      (total, s) => total + s.nbEmployes, 0
    );
  }
}