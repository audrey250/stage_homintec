// ============================================================
// src/app/services/messagerie.service.ts
// WebSocket STOMP temps réel — aligné sur MessageWebSocketController
// ============================================================

import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const API_URL  = environment.apiUrl;
const WS_URL   = API_URL.replace('/api', '') + '/ws'; // http://192.168.1.115:8080/ws

export type StatutConversation = 'active' | 'bloquee' | 'supprimee' | 'envoyee' | 'fermee';

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

  // ── Client STOMP ──
  private stompClient: Client | null = null;
  private monUserId: string | null   = null;

  constructor(
    private http:        HttpClient,
    private authService: AuthService
  ) {}

  // ============================================================
  // WEBSOCKET — Connexion + abonnement temps réel
  // Le serveur pousse vers /queue/messages-{monId}
  // ============================================================
  connecterWebSocket(userId: string): void {
    if (this.stompClient?.active) return;
    this.monUserId = userId;

    this.stompClient = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      reconnectDelay:   5000,

      onConnect: () => {
        console.log('✅ WebSocket messagerie connecté');

        // ── Écouter les messages destinés à MOI ──
        // Spring envoie vers /queue/messages-{destinataireId}
        this.stompClient!.subscribe(
          `/queue/messages-${userId}`,
          (frame: IMessage) => {
            try {
              const msg: Message = JSON.parse(frame.body);
              this.ajouterMessageTempsReel(msg);
            } catch (e) {
              console.error('Erreur parsing message WebSocket', e);
            }
          }
        );
      },

      onStompError: (frame) => {
        console.error('❌ Erreur STOMP messagerie', frame);
        this._erreur.set('Connexion temps réel perdue.');
      },

      onDisconnect: () => console.log('🔌 WebSocket messagerie déconnecté')
    });

    this.stompClient.activate();
  }

  deconnecterWebSocket(): void {
    this.stompClient?.deactivate();
    this.stompClient = null;
  }

  // ── Ajouter un message reçu en temps réel dans le bon signal ──
  private ajouterMessageTempsReel(msg: Message): void {
    this._conversations.update(convs =>
      convs.map(c => {
        if (c.id !== msg.conversationId) return c;

        // Éviter les doublons (si le REST a déjà ajouté le message)
        const dejaPresent = c.messages?.some(m => m.id === msg.id);
        if (dejaPresent) return c;

        return {
          ...c,
          messages:    [...(c.messages ?? []), msg],
          lastMessage: msg.contenu,
          dateCreation: msg.dateEnvoi,
          // Incrémenter nonLus seulement si ce n'est pas ma propre conv active
          nonLus: msg.expediteurId !== this.monUserId
            ? c.nonLus + 1
            : c.nonLus
        };
      })
    );
  }

  // ============================================================
  // ENVOYER via WebSocket (temps réel) + fallback REST
  // Le client envoie vers /app/message
  // ============================================================
  envoyerViaSocket(msg: NouveauMessage, destinataireId: string): void {
    if (!this.stompClient?.active) return;

    const expediteurId = this.authService.currentUser()?.id;
    const user         = this.authService.currentUser();

    // Payload attendu par MessageWebSocketDTO
    this.stompClient.publish({
      destination: '/app/message',
      body: JSON.stringify({
        conversationId:   msg.conversationId,
        contenu:          msg.contenu,
        expediteurId:     expediteurId,
        expediteurNom:    user?.nom    ?? '',
        expediteurPrenom: user?.prenom ?? '',
        destinataireId:   destinataireId
      })
    });
  }

  // ============================================================
  // REST — Charger conversations
  // GET /api/conversations/utilisateur/:userId
  // ============================================================
  chargerConversations(userId: string): Observable<Conversation[]> {
    this._loading.set(true);
    this._erreur.set('');
    return this.http
      .get<Conversation[]>(`${API_URL}/conversations/utilisateur/${userId}`)
      .pipe(
        tap(data => {
          this._conversations.set(data);
          this._loading.set(false);
        }),
        catchError(err => {
          this._loading.set(false);
          this._erreur.set('Impossible de charger les conversations.');
          return throwError(() => err);
        })
      );
  }

  // ============================================================
  // REST — Créer une conversation
  // POST /api/conversations
  // ============================================================
  creerConversation(payload: NouvelleConversation): Observable<Conversation> {
    const expediteurId = this.authService.currentUser()?.id;
    if (!expediteurId) {
      return throwError(() => new Error('Utilisateur non authentifié.'));
    }
    return this.http
      .post<Conversation>(`${API_URL}/conversations`, {
        expediteurId,
        destinataireId: payload.destinataireId
      })
      .pipe(
        tap(nouvelle => {
          this._conversations.update(convs => {
            const existe = convs.find(c => c.destinataireId === nouvelle.destinataireId);
            if (existe) return convs;
            return [nouvelle, ...convs];
          });
        }),
        catchError(err => throwError(() => err))
      );
  }

  // ============================================================
  // REST — Charger messages d'une conversation
  // GET /api/messages/conversation/:id
  // ============================================================
  chargerMessages(id: string): Observable<Message[]> {
    this._loading.set(true);
    return this.http
      .get<Message[]>(`${API_URL}/messages/conversation/${id}`)
      .pipe(
        tap(messages => {
          this._loading.set(false);
          this._conversations.update(convs =>
            convs.map(c =>
              c.id === id ? { ...c, messages, nonLus: 0 } : c
            )
          );
        }),
        catchError(err => {
          this._loading.set(false);
          return throwError(() => err);
        })
      );
  }

  // ============================================================
  // REST — Envoyer un message
  // POST /api/messages
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
        tap(nouveau => {
          this._conversations.update(convs =>
            convs.map(c => {
              if (c.id !== msg.conversationId) return c;
              const dejaPresent = c.messages?.some(m => m.id === nouveau.id);
              return {
                ...c,
                messages:     dejaPresent ? c.messages : [...(c.messages ?? []), nouveau],
                lastMessage:  msg.contenu,
                dateCreation: nouveau.dateEnvoi
              };
            })
          );
        }),
        catchError(err => throwError(() => err))
      );
  }

  // ============================================================
  // REST — Marquer comme lus
  // PATCH /api/messages/conversation/:id/lu?userId=...
  // ============================================================
  marquerLus(id: string): Observable<void> {
    const userId = this.authService.currentUser()?.id;
    return this.http
      .patch<void>(`${API_URL}/messages/conversation/${id}/lu?userId=${userId}`, {})
      .pipe(
        tap(() => {
          this._conversations.update(convs =>
            convs.map(c => c.id === id ? { ...c, nonLus: 0 } : c)
          );
        }),
        catchError(err => throwError(() => err))
      );
  }

  // ============================================================
  // REST — Supprimer une conversation
  // DELETE /api/conversations/:id
  // ============================================================
  supprimerConversation(id: string): Observable<void> {
    return this.http
      .delete<void>(`${API_URL}/conversations/${id}`)
      .pipe(
        tap(() => {
          this._conversations.update(convs => convs.filter(c => c.id !== id));
        }),
        catchError(err => throwError(() => err))
      );
  }

  // ============================================================
  // REST — Charger utilisateurs
  // GET /api/utilisateurs
  // ============================================================
  chargerUtilisateurs(): Observable<UtilisateurSimple[]> {
    return this.http
      .get<UtilisateurSimple[]>(`${API_URL}/utilisateurs`)
      .pipe(
        tap(data => this._utilisateurs.set(data)),
        catchError(err => throwError(() => err))
      );
  }

  // ============================================================
  // REST — Modifier / Supprimer un message
  // ============================================================
  modifierMessage(id: string, contenu: string): Observable<any> {
    return this.http.put(`${API_URL}/messages/${id}`, { contenu });
  }

  supprimerMessage(id: string): Observable<any> {
    return this.http.delete(`${API_URL}/messages/${id}`);
  }

  // ============================================================
  // HELPER — Total non lus (badge sidebar)
  // ============================================================
  totalNonLus(): number {
    return this._conversations().reduce((t, c) => t + c.nonLus, 0);
  }
}