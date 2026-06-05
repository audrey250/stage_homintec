// ============================================================
// src/app/services/notification.service.ts
// Aligné sur NotificationController Spring Boot
// WebSocket STOMP via SockJS
// ============================================================

import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

// SockJS + STOMP — installer : npm install sockjs-client @stomp/stompjs
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const API_URL = environment.apiUrl;

// ── Miroir exact du NotificationWebSocketDTO Spring Boot ──
export interface Notification {
  id:         string;   // UUID
  contenu:    string;
  datenotif:  string;   // LocalDateTime sérialisé en string
  statut:     'LU' | 'NON_LU';
  utilisateurId?: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {

  // ── Signaux réactifs ──
  private _notifications  = signal<Notification[]>([]);
  private _nonLues        = signal<number>(0);
  private _loading        = signal(false);
  private _erreur         = signal('');

  notifications  = this._notifications.asReadonly();
  nonLues        = this._nonLues.asReadonly();
  loading        = this._loading.asReadonly();
  erreur         = this._erreur.asReadonly();

  // ── Client STOMP ──
  private stompClient: Client | null = null;
  private utilisateurId: string | null = null;

  constructor(private http: HttpClient) {}

  // ============================================================
  // WEBSOCKET — Connexion STOMP/SockJS
  // S'abonne à /queue/notifications/{utilisateurId}
  // (messages personnels, pas broadcast)
  // ============================================================
  connecterWebSocket(utilisateurId: string): void {
    if (this.stompClient?.active) return; // déjà connecté
    this.utilisateurId = utilisateurId;

    this.stompClient = new Client({
      // SockJS comme transport (fallback configuré côté Spring)
      webSocketFactory: () => new SockJS(`${API_URL.replace('/api', '')}/ws`),

      reconnectDelay: 5000, // reconnexion auto toutes les 5s si coupé

      onConnect: () => {
        console.log('✅ WebSocket STOMP connecté');

        // Abonnement aux notifications personnelles de l'utilisateur
        this.stompClient!.subscribe(
          `/queue/notifications/${utilisateurId}`,
          (msg: IMessage) => {
            try {
              const notif: Notification = JSON.parse(msg.body);
              // Ajouter en tête de liste
              this._notifications.update(list => [notif, ...list]);
              // Incrémenter le compteur non lues
              if (notif.statut === 'NON_LU') {
                this._nonLues.update(n => n + 1);
              }
            } catch (e) {
              console.error('Erreur parsing notification WebSocket', e);
            }
          }
        );

        // Abonnement optionnel aux broadcasts globaux (ex: annonces RH)
        this.stompClient!.subscribe('/topic/annonces', (msg: IMessage) => {
          try {
            const notif: Notification = JSON.parse(msg.body);
            this._notifications.update(list => [notif, ...list]);
            if (notif.statut === 'NON_LU') {
              this._nonLues.update(n => n + 1);
            }
          } catch {}
        });
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

  // Déconnecter proprement (appeler au logout ou destroy du composant)
  deconnecterWebSocket(): void {
    this.stompClient?.deactivate();
    this.stompClient = null;
  }

  // ============================================================
  // REST — GET /api/notifications/{utilisateurId}
  // Toutes les notifications de l'utilisateur
  // ============================================================
  chargerNotifications(utilisateurId: string): Observable<Notification[]> {
    this._loading.set(true);
    this._erreur.set('');
    return this.http
      .get<Notification[]>(`${API_URL}/notifications/${utilisateurId}`)
      .pipe(
        tap(data => {
          this._notifications.set(data);
          this._loading.set(false);
          // Recalculer le compteur non lues depuis la liste chargée
          this._nonLues.set(data.filter(n => n.statut === 'NON_LU').length);
        }),
        catchError(err => {
          this._loading.set(false);
          this._erreur.set('Impossible de charger les notifications.');
          return throwError(() => err);
        })
      );
  }

  // ============================================================
  // REST — GET /api/notifications/{utilisateurId}/non-lues
  // ============================================================
  chargerNonLues(utilisateurId: string): Observable<Notification[]> {
    return this.http
      .get<Notification[]>(`${API_URL}/notifications/${utilisateurId}/non-lues`)
      .pipe(
        tap(data => {
          this._nonLues.set(data.length);
        }),
        catchError(err => throwError(() => err))
      );
  }

  // ============================================================
  // REST — GET /api/notifications/{utilisateurId}/count
  // ============================================================
  chargerCount(utilisateurId: string): Observable<number> {
    return this.http
      .get<number>(`${API_URL}/notifications/${utilisateurId}/count`)
      .pipe(
        tap(count => this._nonLues.set(count)),
        catchError(err => throwError(() => err))
      );
  }

  // ============================================================
  // REST — PATCH /api/notifications/{id}/lue
  // ============================================================
  marquerCommeLue(id: string): Observable<Notification> {
    return this.http
      .patch<Notification>(`${API_URL}/notifications/${id}/lue`, {})
      .pipe(
        tap(updated => {
          this._notifications.update(list =>
            list.map(n => n.id === id ? { ...n, statut: 'LU' } : n)
          );
          // Décrémenter le compteur
          this._nonLues.update(n => Math.max(0, n - 1));
        }),
        catchError(err => throwError(() => err))
      );
  }

  // ============================================================
  // REST — PATCH /api/notifications/{utilisateurId}/toutes-lues
  // ============================================================
  marquerToutesLues(utilisateurId: string): Observable<void> {
    return this.http
      .patch<void>(`${API_URL}/notifications/${utilisateurId}/toutes-lues`, {})
      .pipe(
        tap(() => {
          this._notifications.update(list =>
            list.map(n => ({ ...n, statut: 'LU' as const }))
          );
          this._nonLues.set(0);
        }),
        catchError(err => throwError(() => err))
      );
  }

  // ============================================================
  // REST — DELETE /api/notifications/{id}
  // ============================================================
  supprimer(id: string): Observable<void> {
    return this.http
      .delete<void>(`${API_URL}/notifications/${id}`)
      .pipe(
        tap(() => {
          const notif = this._notifications().find(n => n.id === id);
          this._notifications.update(list => list.filter(n => n.id !== id));
          // Si la notif supprimée était non lue, décrémenter
          if (notif?.statut === 'NON_LU') {
            this._nonLues.update(n => Math.max(0, n - 1));
          }
        }),
        catchError(err => throwError(() => err))
      );
  }

  // ============================================================
  // HELPER — formater la date affichée
  // ============================================================
  formaterDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const auj = new Date();
      if (d.toDateString() === auj.toDateString()) {
        return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      }
      const hier = new Date(auj);
      hier.setDate(auj.getDate() - 1);
      if (d.toDateString() === hier.toDateString()) return 'Hier';
      return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    } catch {
      return dateStr;
    }
  }
}