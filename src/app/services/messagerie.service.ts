import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const API_URL = environment.apiUrl;
const WS_URL  = API_URL.replace('/api', '') + '/ws';

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

  private stompClient: Client | null = null;
  private monUserId: string | null   = null;
  private topicsAbonnes: Set<string> = new Set();
  private pendingTopics: Set<string> = new Set();

  // ✅ Set des IDs de messages déjà ajoutés via HTTP — pour ignorer l'écho WebSocket
  private _messagesEnvoyes: Set<string> = new Set();

  constructor(
    private http:        HttpClient,
    private authService: AuthService
  ) {}

  // ============================================================
  // WEBSOCKET — CONNEXION
  // ============================================================
  connecterWebSocket(userId: string): void {
    if (this.stompClient?.active) return;
    this.monUserId = userId;

    this.stompClient = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      reconnectDelay:   5000,
      onConnect: () => {
        console.log('✅ WebSocket messagerie connecté');
        this.topicsAbonnes.clear();
        this.pendingTopics.forEach(topic => this.subscribeTopic(topic));
      },
      onStompError: (frame) => {
        console.error('❌ Erreur STOMP', frame);
        this._erreur.set('Connexion temps réel perdue.');
      },
      onDisconnect: () => {
        console.log('🔌 WebSocket déconnecté');
      }
    });

    this.stompClient.activate();
  }

  deconnecterWebSocket(): void {
    this.stompClient?.deactivate();
    this.stompClient = null;
    this.topicsAbonnes.clear();
  }

  // ============================================================
  // WEBSOCKET — S'ABONNER À UNE CONVERSATION
  // ============================================================
  abonnerConversation(conversationId: string): void {
    const topic = `/topic/conversation/${conversationId}`;
    if (this.pendingTopics.has(topic)) return;
    this.pendingTopics.add(topic);

    if (this.stompClient?.connected) {
      this.subscribeTopic(topic);
    } else {
      console.log(`⏳ Abonnement différé à ${topic}`);
    }
  }

  private subscribeTopic(topic: string): void {
    if (this.topicsAbonnes.has(topic) || !this.stompClient?.connected) return;

    this.stompClient.subscribe(topic, (frame: IMessage) => {
      try {
        const msg: Message = JSON.parse(frame.body);

        // ✅ ANTI-DOUBLON : ignorer l'écho WebSocket si c'est un message
        //    que MOI j'ai envoyé et dont le serveur a déjà confirmé l'ID via HTTP
        if (this._messagesEnvoyes.has(msg.id)) {
          this._messagesEnvoyes.delete(msg.id); // nettoyage
          console.log('🔕 Écho WebSocket ignoré pour message déjà présent:', msg.id);
          return;
        }

        // ✅ Ignorer aussi si l'expéditeur c'est moi ET que le message est déjà
        //    présent dans la liste (double sécurité)
        if (msg.expediteurId === this.monUserId) {
          const conv = this._conversations().find(c => c.id === msg.conversationId);
          if (conv?.messages?.some(m => m.id === msg.id)) {
            console.log('🔕 Doublon expéditeur ignoré:', msg.id);
            return;
          }
        }

        console.log('✅ Message temps réel reçu:', msg);
        this._ajouterMessageTempsReel(msg);
      } catch (e) {
        console.error('Erreur parsing message WebSocket', e);
      }
    });

    this.topicsAbonnes.add(topic);
    console.log(`✅ Abonné à ${topic}`);
  }

  // ============================================================
  // WEBSOCKET — MESSAGE REÇU EN TEMPS RÉEL (destinataire uniquement)
  // ============================================================
  private _ajouterMessageTempsReel(msg: Message): void {
    this._conversations.update(convs =>
      convs.map(c => {
        if (c.id !== msg.conversationId) return c;

        // Déjà présent par ID exact → ignorer
        if (c.messages?.some(m => m.id === msg.id)) return c;

        return {
          ...c,
          messages:    [...(c.messages ?? []), msg],
          lastMessage: msg.contenu,
          nonLus: msg.expediteurId !== this.monUserId
            ? (c.nonLus ?? 0) + 1
            : c.nonLus
        };
      })
    );
  }

  // ============================================================
  // WEBSOCKET — ENVOYER VIA SOCKET
  // Notifie le backend pour qu'il broadcaste aux AUTRES abonnés
  // ============================================================
  envoyerViaSocket(msg: NouveauMessage, destinataireId: string): void {
    if (!this.stompClient?.active) return;
    const user = this.authService.currentUser();
    this.stompClient.publish({
      destination: '/app/message.envoyer',
      body: JSON.stringify({
        conversationId:   msg.conversationId,
        contenu:          msg.contenu,
        expediteurId:     user?.id     ?? '',
        expediteurNom:    user?.nom    ?? '',
        expediteurPrenom: user?.prenom ?? '',
        destinataireId
      })
    });
  }

  // ============================================================
  // REST — Conversations
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

  creerConversation(payload: NouvelleConversation): Observable<Conversation> {
    const expediteurId = this.authService.currentUser()?.id;
    if (!expediteurId) return throwError(() => new Error('Utilisateur non authentifié.'));

    return this.http
      .post<Conversation>(`${API_URL}/conversations`, {
        expediteurId,
        destinataireId: payload.destinataireId
      })
      .pipe(
        tap(nouvelle => {
          this._conversations.update(convs => {
            const existe = convs.find(c => c.destinataireId === nouvelle.destinataireId);
            return existe ? convs : [nouvelle, ...convs];
          });
        }),
        catchError(err => throwError(() => err))
      );
  }

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
  // REST — Messages
  // ============================================================
  chargerMessages(id: string): Observable<Message[]> {
    this._loading.set(true);
    return this.http
      .get<Message[]>(`${API_URL}/messages/conversation/${id}`)
      .pipe(
        tap(messages => {
          this._loading.set(false);
          this._conversations.update(convs =>
            convs.map(c => c.id === id ? { ...c, messages, nonLus: 0 } : c)
          );
        }),
        catchError(err => {
          this._loading.set(false);
          return throwError(() => err);
        })
      );
  }

  envoyer(msg: NouveauMessage): Observable<Message> {
    const expediteurId = this.authService.currentUser()?.id;
    const user         = this.authService.currentUser();

    // ✅ Message optimiste affiché immédiatement
    const tempId = 'temp-' + Date.now();
    const messageOptimiste: Message = {
      id:               tempId,
      expediteurId:     expediteurId ?? '',
      expediteurNom:    user?.nom    ?? '',
      expediteurPrenom: user?.prenom ?? '',
      conversationId:   msg.conversationId,
      contenu:          msg.contenu,
      dateEnvoi:        new Date().toISOString(),
      lu:               true
    };

    this._conversations.update(convs =>
      convs.map(c => {
        if (c.id !== msg.conversationId) return c;
        return {
          ...c,
          messages:    [...(c.messages ?? []), messageOptimiste],
          lastMessage: msg.contenu
        };
      })
    );

    return this.http
      .post<Message>(`${API_URL}/messages`, {
        conversationId: msg.conversationId,
        contenu:        msg.contenu,
        expediteurId
      })
      .pipe(
        tap(nouveau => {
          // ✅ Enregistrer l'ID réel pour bloquer l'écho WebSocket
          this._messagesEnvoyes.add(nouveau.id);

          // Nettoyer automatiquement après 5 secondes (sécurité)
          setTimeout(() => this._messagesEnvoyes.delete(nouveau.id), 5000);

          // Remplacer le message optimiste par le vrai message HTTP
          this._conversations.update(convs =>
            convs.map(c => {
              if (c.id !== msg.conversationId) return c;

              const messages = (c.messages ?? []).map(m =>
                m.id === tempId ? nouveau : m
              );

              return { ...c, messages, lastMessage: nouveau.contenu };
            })
          );
        }),
        catchError(err => {
          // Supprimer le message optimiste en cas d'erreur
          this._conversations.update(convs =>
            convs.map(c => {
              if (c.id !== msg.conversationId) return c;
              return {
                ...c,
                messages: (c.messages ?? []).filter(m => m.id !== tempId)
              };
            })
          );
          return throwError(() => err);
        })
      );
  }

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

  modifierMessage(id: string, contenu: string): Observable<Message> {
    const userId = this.authService.currentUser()?.id;
    return this.http.put<Message>(
      `${API_URL}/messages/${id}${userId ? `?userId=${userId}` : ''}`,
      { contenu, userId }
    );
  }

  supprimerMessage(id: string): Observable<void> {
    const userId = this.authService.currentUser()?.id;
    return this.http.delete<void>(
      `${API_URL}/messages/${id}${userId ? `?userId=${userId}` : ''}`
    );
  }

  // ============================================================
  // Mutations locales du signal
  // ============================================================
  mettreAJourMessage(id: string, contenu: string): void {
    this._conversations.update(convs =>
      convs.map(c => ({
        ...c,
        messages: (c.messages ?? []).map(m =>
          m.id === id ? { ...m, contenu } : m
        )
      }))
    );
  }

  supprimerMessageLocal(id: string, conversationId: string): void {
    this._conversations.update(convs =>
      convs.map(c =>
        c.id === conversationId
          ? { ...c, messages: (c.messages ?? []).filter(m => m.id !== id) }
          : c
      )
    );
  }

  mettreAJourApercu(conversationId: string, contenu: string, incrementerNonLus = false): void {
    this._conversations.update(convs =>
      convs.map(c => {
        if (c.id !== conversationId) return c;
        return {
          ...c,
          lastMessage: contenu,
          nonLus: incrementerNonLus ? (c.nonLus ?? 0) + 1 : c.nonLus
        };
      })
    );
  }

  // ============================================================
  // REST — Utilisateurs
  // ============================================================
  chargerUtilisateurs(): Observable<UtilisateurSimple[]> {
    return this.http
      .get<UtilisateurSimple[]>(`${API_URL}/utilisateurs`)
      .pipe(
        tap(data => this._utilisateurs.set(data)),
        catchError(err => throwError(() => err))
      );
  }

  totalNonLus(): number {
    return this._conversations().reduce((t, c) => t + (c.nonLus ?? 0), 0);
  }
}