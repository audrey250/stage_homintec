// ============================================================
// src/app/services/messagerie.service.ts
// VERSION SPRING BOOT
// ============================================================

import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';

const API_URL = 'http://192.168.1.142:8080/api';

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

export interface Conversation {
  interlocuteurId:     number;
  interlocuteurNom:    string;
  interlocuteurPrenom: string;
  interlocuteurRole:   string;
  interlocuteurDept:   string;
  dernierMessage:      string;
  dateMessage:         string;
  nonLus:              number;
  messages:            Message[];
}

export interface NouveauMessage {
  destinataireId: number;
  contenu:        string;
}

@Injectable({ providedIn: 'root' })
export class MessagerieService {

  private _conversations = signal<Conversation[]>([]);
  conversations          = this._conversations.asReadonly();

  private _loading = signal(false);
  loading          = this._loading.asReadonly();

  private _erreur = signal('');
  erreur          = this._erreur.asReadonly();

  constructor(private http: HttpClient) {}

  // ---- Charger toutes les conversations ----
  // GET /api/messages/conversations
  chargerConversations(): Observable<Conversation[]> {
    this._loading.set(true);
    return this.http
      .get<Conversation[]>(`${API_URL}/messages/conversations`)
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

  // ---- Charger les messages d'une conversation ----
  // GET /api/messages/:interlocuteurId
  chargerMessages(interlocuteurId: number): Observable<Message[]> {
    this._loading.set(true);
    return this.http
      .get<Message[]>(`${API_URL}/messages/${interlocuteurId}`)
      .pipe(
        tap((messages) => {
          this._loading.set(false);
          // Met à jour les messages dans la conversation du cache local
          this._conversations.update(convs =>
            convs.map(c =>
              c.interlocuteurId === interlocuteurId
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

  // ---- Envoyer un message ----
  // POST /api/messages
  envoyer(msg: NouveauMessage): Observable<Message> {
    return this.http
      .post<Message>(`${API_URL}/messages`, msg)
      .pipe(
        tap((nouveau) => {
          // Ajoute le message dans le cache local sans recharger
          this._conversations.update(convs =>
            convs.map(c =>
              c.interlocuteurId === msg.destinataireId
                ? {
                    ...c,
                    messages:      [...(c.messages ?? []), nouveau],
                    dernierMessage: msg.contenu,
                    dateMessage:    nouveau.date
                  }
                : c
            )
          );
        }),
        catchError((err) => throwError(() => err))
      );
  }

  // ---- Marquer les messages d'une conversation comme lus ----
  // PUT /api/messages/:interlocuteurId/lus
  marquerLus(interlocuteurId: number): Observable<void> {
    return this.http
      .put<void>(`${API_URL}/messages/${interlocuteurId}/lus`, {})
      .pipe(
        tap(() => {
          this._conversations.update(convs =>
            convs.map(c =>
              c.interlocuteurId === interlocuteurId
                ? { ...c, nonLus: 0 }
                : c
            )
          );
        }),
        catchError((err) => throwError(() => err))
      );
  }

  // ---- Total messages non lus (badge sidebar) ----
  totalNonLus(): number {
    return this._conversations().reduce((t, c) => t + c.nonLus, 0);
  }
}