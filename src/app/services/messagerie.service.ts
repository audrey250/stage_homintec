// ============================================================
// src/app/services/messagerie.service.ts
// ============================================================

import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

const API_URL = environment.apiUrl;

export type StatutConversation = 'active' | 'bloquee' | 'supprimee' | 'envoyee' | 'fermee';

// ✅ Tous les IDs en string (UUID)
export interface Message {
  id:               string;
  expediteurId:     string;
  expediteurNom:    string;
  expediteurPrenom: string;
  conversationId:   string;
  contenu:          string;
  dateEnvoi:        string;
  lu:               boolean;
}

export interface Conversation {
  id:                 string;
  statut:             StatutConversation;
  lastMessage:        string;
  dateCreation:       string;
  destinataireId:     string;
  destinataireNom:    string;
  destinatairePrenom: string;
  destinataireRole:   string;
  destinataireDept:   string;
  nonLus:             number;
  messages:           Message[];
}

export interface NouvelleConversation {
  destinataireId: string;
}

export interface NouveauMessage {
  conversationId: string;
  contenu:        string;
}

export interface UtilisateurSimple {
  id:              string;
  nom:             string;
  prenom:          string;
  poste?:          string;
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

  private _utilisateurs = signal<UtilisateurSimple[]>([]);
  utilisateurs          = this._utilisateurs.asReadonly();

  constructor(
    private http:        HttpClient,
    private authService: AuthService
  ) {}

  // ============================================================
  // CHARGER TOUTES LES CONVERSATIONS
  // GET /api/conversations/utilisateur/:userId
  // ============================================================
  chargerConversations(userId: string): Observable<Conversation[]> {
    this._loading.set(true);
    this._erreur.set('');
    return this.http
      .get<Conversation[]>(`${API_URL}/conversations/utilisateur/${userId}`)
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
  // Body : { expediteurId, destinataireId }
  // ============================================================
  creerConversation(payload: NouvelleConversation): Observable<Conversation> {
    const expediteurId = this.authService.currentUser()?.id;
    if (!expediteurId) {
      return throwError(() => new Error('Utilisateur non authentifié. Veuillez vous reconnecter.'));
    }
    return this.http
      .post<Conversation>(`${API_URL}/conversations`, {
        expediteurId,
        destinataireId: payload.destinataireId
      })
      .pipe(
        tap((nouvelle) => {
          this._conversations.update(convs => {
            const existe = convs.find(c => c.destinataireId === nouvelle.destinataireId);
            if (existe) return convs;
            return [nouvelle, ...convs];
          });
        }),
        catchError((err) => throwError(() => err))
      );
  }

  // ============================================================
  // CHARGER LES MESSAGES D'UNE CONVERSATION
  // ✅ GET /api/messages/conversation/:id
  // ============================================================
  chargerMessages(id: string): Observable<Message[]> {
    this._loading.set(true);
    return this.http
      .get<Message[]>(`${API_URL}/messages/conversation/${id}`)
      .pipe(
        tap((messages) => {
          this._loading.set(false);
          this._conversations.update(convs =>
            convs.map(c =>
              c.id === id
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
  // ENVOYER UN MESSAGE
  // ✅ POST /api/messages
  // Body : { conversationId, contenu, expediteurId }
  // ============================================================
  envoyer(msg: NouveauMessage): Observable<Message> {
    const expediteurId = this.authService.currentUser()?.id;
    return this.http
      .post<Message>(`${API_URL}/messages`, {
        conversationId: msg.conversationId,
        contenu:        msg.contenu,
        expediteurId:   expediteurId
      })
      .pipe(
        tap((nouveau) => {
          this._conversations.update(convs =>
            convs.map(c =>
              c.id === msg.conversationId
                ? {
                    ...c,
                    messages:    [...(c.messages ?? []), nouveau],
                    lastMessage: msg.contenu,
                    dateEnvoi:   nouveau.dateEnvoi
                  }
                : c
            )
          );
        }),
        catchError((err) => throwError(() => err))
      );
  }

  // ============================================================
  // MARQUER LES MESSAGES COMME LUS
  // ✅ PATCH /api/messages/conversation/:id/lu?userId=...
  // ============================================================
  marquerLus(id: string): Observable<void> {
    const userId = this.authService.currentUser()?.id;
    return this.http
      .patch<void>(
        `${API_URL}/messages/conversation/${id}/lu?userId=${userId}`,
        {}
      )
      .pipe(
        tap(() => {
          this._conversations.update(convs =>
            convs.map(c =>
              c.id === id ? { ...c, nonLus: 0 } : c
            )
          );
        }),
        catchError((err) => throwError(() => err))
      );
  }

  // ============================================================
  // SUPPRIMER UNE CONVERSATION
  // DELETE /api/conversations/:id
  // ============================================================
  supprimerConversation(id: string): Observable<void> {
    return this.http
      .delete<void>(`${API_URL}/conversations/${id}`)
      .pipe(
        tap(() => {
          this._conversations.update(convs =>
            convs.filter(c => c.id !== id)
          );
        }),
        catchError((err) => throwError(() => err))
      );
  }

  // ============================================================
  // CHARGER LA LISTE DES UTILISATEURS
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