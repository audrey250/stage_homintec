// ============================================================
// src/app/services/messagerie.service.ts
// VERSION SPRING BOOT — avec entité Conversation
// ============================================================

import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';

const API_URL = environment.apiUrl;

// Statuts de conversation (selon diagramme de classe)
export type StatutConversation = 'active' | 'bloquee' | 'supprimee' | 'envoyee' | 'fermee';

export interface Message {
  id:               number;
  expediteurId:     number;
  expediteurNom:    string;
  expediteurPrenom: string;
  destinataireId:   number;
  contenu:          string;
  date:             string;   // ISO : "2024-01-20T09:00:00"
  lu:               boolean;
}

// Entité Conversation telle que définie dans le diagramme de classe
export interface Conversation {
  idConversation:      number;          // PK Spring Boot
  statut:              StatutConversation;
  lastMessage:         string;          // last_message dans le diagramme
  date:                string;

  // Infos sur l'interlocuteur (enrichies par le backend)
  interlocuteurId:     number;
  interlocuteurNom:    string;
  interlocuteurPrenom: string;
  interlocuteurRole:   string;
  interlocuteurDept:   string;

  nonLus:              number;
  messages:            Message[];
}

// Payload pour créer une nouvelle conversation (POST /api/conversations)
export interface NouvelleConversation {
  interlocuteurId: number;
}

export interface NouveauMessage {
  conversationId: number;   // on lie le message à la conversation
  destinataireId: number;
  contenu:        string;
}

// Utilisateur minimal pour la liste de destinataires
export interface UtilisateurSimple {
  id:      number;
  nom:     string;
  prenom:  string;
  poste?:  string;
  departementNom?: string;
}

@Injectable({ providedIn: 'root' })
export class MessagerieService {

  private _conversations = signal<Conversation[]>([]);
  conversations          = this._conversations.asReadonly();

  private _loading = signal(false);
  loading          = this._loading.asReadonly();

  private _erreur = signal('');
  erreur          = this._erreur.asReadonly();

  // Liste des utilisateurs disponibles pour démarrer une conversation
  private _utilisateurs = signal<UtilisateurSimple[]>([]);
  utilisateurs          = this._utilisateurs.asReadonly();

  constructor(private http: HttpClient) {}

  // ============================================================
  // CHARGER TOUTES LES CONVERSATIONS DE L'UTILISATEUR CONNECTÉ
  // GET /api/conversations
  // Spring Boot renvoie : Conversation[] avec infos interlocuteur
  // ============================================================
  chargerConversations(): Observable<Conversation[]> {
    this._loading.set(true);
    this._erreur.set('');
    return this.http
      .get<Conversation[]>(`${API_URL}/conversations`)
      .pipe(
        tap((data) => {
          this._conversations.set(data);
          this._loading.set(false);
        }),
        catchError((err) => {
          this._loading.set(false);
          this._erreur.set('Impossible de charger les conversations.');
          return throwError(() => err);
        })
      );
  }

  // ============================================================
  // CRÉER UNE NOUVELLE CONVERSATION
  // POST /api/conversations
  // Body : { interlocuteurId }
  // Retourne la Conversation créée (statut = 'active')
  // ============================================================
  creerConversation(payload: NouvelleConversation): Observable<Conversation> {
    return this.http
      .post<Conversation>(`${API_URL}/conversations`, payload)
      .pipe(
        tap((nouvelle) => {
          // Éviter les doublons si la conversation existait déjà
          this._conversations.update(convs => {
            const existe = convs.find(
              c => c.interlocuteurId === nouvelle.interlocuteurId
            );
            if (existe) return convs;
            return [nouvelle, ...convs];
          });
        }),
        catchError((err) => throwError(() => err))
      );
  }

  // ============================================================
  // CHARGER LES MESSAGES D'UNE CONVERSATION
  // GET /api/conversations/:idConversation/messages
  // ============================================================
  chargerMessages(idConversation: number): Observable<Message[]> {
    this._loading.set(true);
    return this.http
      .get<Message[]>(`${API_URL}/conversations/${idConversation}/messages`)
      .pipe(
        tap((messages) => {
          this._loading.set(false);
          this._conversations.update(convs =>
            convs.map(c =>
              c.idConversation === idConversation
                ? { ...c, messages, nonLus: 0 }
                : c
            )
          );
        }),
        catchError((err) => {
          this._loading.set(false);
          return throwError(() => err);
        })
      );
  }

  // ============================================================
  // ENVOYER UN MESSAGE DANS UNE CONVERSATION
  // POST /api/conversations/:idConversation/messages
  // Body : { destinataireId, contenu }
  // ============================================================
  envoyer(msg: NouveauMessage): Observable<Message> {
    return this.http
      .post<Message>(
        `${API_URL}/conversations/${msg.conversationId}/messages`,
        { destinataireId: msg.destinataireId, contenu: msg.contenu }
      )
      .pipe(
        tap((nouveau) => {
          this._conversations.update(convs =>
            convs.map(c =>
              c.idConversation === msg.conversationId
                ? {
                    ...c,
                    messages:    [...(c.messages ?? []), nouveau],
                    lastMessage: msg.contenu,
                    date:        nouveau.date
                  }
                : c
            )
          );
        }),
        catchError((err) => throwError(() => err))
      );
  }

  // ============================================================
  // MARQUER LES MESSAGES D'UNE CONVERSATION COMME LUS
  // PUT /api/conversations/:idConversation/lus
  // ============================================================
  marquerLus(idConversation: number): Observable<void> {
    return this.http
      .put<void>(`${API_URL}/conversations/${idConversation}/lus`, {})
      .pipe(
        tap(() => {
          this._conversations.update(convs =>
            convs.map(c =>
              c.idConversation === idConversation
                ? { ...c, nonLus: 0 }
                : c
            )
          );
        }),
        catchError((err) => throwError(() => err))
      );
  }

  // ============================================================
  // SUPPRIMER UNE CONVERSATION (statut = 'supprimee')
  // DELETE /api/conversations/:idConversation
  // ============================================================
  supprimerConversation(idConversation: number): Observable<void> {
    return this.http
      .delete<void>(`${API_URL}/conversations/${idConversation}`)
      .pipe(
        tap(() => {
          this._conversations.update(convs =>
            convs.filter(c => c.idConversation !== idConversation)
          );
        }),
        catchError((err) => throwError(() => err))
      );
  }

  // ============================================================
  // CHARGER LA LISTE DES UTILISATEURS (pour nouvelle conversation)
  // GET /api/utilisateurs
  // ============================================================
  chargerUtilisateurs(): Observable<UtilisateurSimple[]> {
    return this.http
      .get<UtilisateurSimple[]>(`${API_URL}/utilisateurs`)
      .pipe(
        tap((data) => this._utilisateurs.set(data)),
        catchError((err) => throwError(() => err))
      );
  }

  // ============================================================
  // TOTAL MESSAGES NON LUS (badge sidebar)
  // ============================================================
  totalNonLus(): number {
    return this._conversations().reduce((t, c) => t + c.nonLus, 0);
  }
}