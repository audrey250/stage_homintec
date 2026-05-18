// ============================================================
// src/app/messagerie/messagerie.ts
// VERSION SPRING BOOT
// ============================================================

import {
  Component, signal, OnInit,
  ElementRef, ViewChild, AfterViewChecked
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import {
  MessagerieService,
  Conversation,
  NouveauMessage
} from '../services/messagerie.service';

@Component({
  selector: 'app-messagerie',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './messagerie.html',
  styleUrl: './messagerie.css'
})
export class MessagerieComponent implements OnInit, AfterViewChecked {

  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  conversationActive = signal<Conversation | null>(null);
  nouveauMessage     = '';
  erreurEnvoi        = signal('');
  chargementEnvoi    = signal(false);

  private doitScroller = false;

  constructor(
    public authService:      AuthService,
    public messagerieService: MessagerieService
  ) {}

  // ---- Au chargement : récupère les conversations depuis Spring Boot ----
  ngOnInit(): void {
    this.messagerieService.chargerConversations().subscribe({
      next: (convs) => {
        // Si une seule conversation → l'ouvrir automatiquement
        if (convs.length === 1) {
          this.ouvrirConversation(convs[0]);
        }
      },
      error: (err) => {
        console.error('Erreur chargement conversations', err);
      }
    });
  }

  ngAfterViewChecked(): void {
    if (this.doitScroller) {
      this.scrollerEnBas();
      this.doitScroller = false;
    }
  }

  // ---- Ouvrir une conversation ----
  ouvrirConversation(conv: Conversation): void {
    // Afficher immédiatement la conversation dans l'interface
    this.conversationActive.set(conv);
    this.erreurEnvoi.set('');

    // Charger les messages depuis Spring Boot
    this.messagerieService
      .chargerMessages(conv.interlocuteurId)
      .subscribe({
        next: () => {
          // Récupérer la conversation mise à jour depuis le cache
          const updated = this.messagerieService
            .conversations()
            .find(c => c.interlocuteurId === conv.interlocuteurId);

          if (updated) this.conversationActive.set(updated);

          // Marquer les messages comme lus
          this.messagerieService
            .marquerLus(conv.interlocuteurId)
            .subscribe();

          this.doitScroller = true;
        },
        error: (err) => {
          console.error('Erreur chargement messages', err);
        }
      });
  }

  // ---- Envoyer un message ----
  envoyer(): void {
    const conv = this.conversationActive();
    const user = this.authService.currentUser();

    if (!conv || !user || !this.nouveauMessage.trim()) return;

    this.chargementEnvoi.set(true);
    this.erreurEnvoi.set('');

    // Prépare le corps de la requête POST
    const payload: NouveauMessage = {
      destinataireId: conv.interlocuteurId,
      contenu:        this.nouveauMessage.trim()
    };

    this.messagerieService.envoyer(payload).subscribe({
      next: () => {
        // Vide le champ après envoi réussi
        this.nouveauMessage = '';
        this.chargementEnvoi.set(false);

        // Met à jour la conversation affichée avec le nouveau message
        const updated = this.messagerieService
          .conversations()
          .find(c => c.interlocuteurId === conv.interlocuteurId);

        if (updated) this.conversationActive.set(updated);

        this.doitScroller = true;
      },
      error: (err) => {
        this.chargementEnvoi.set(false);
        this.erreurEnvoi.set('Échec de l\'envoi. Réessayez.');
        console.error('Erreur envoi message', err);
      }
    });
  }

  // ---- Scroll automatique en bas ----
  private scrollerEnBas(): void {
    try {
      const el = this.messagesContainer?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }

  // ---- Formater la date ISO en HH:MM ----
  formaterDate(date: string): string {
    try {
      return new Date(date).toLocaleTimeString('fr-FR', {
        hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return date;
    }
  }

  // ---- Initiales pour l'avatar ----
  initiales(nom: string, prenom: string): string {
    return `${prenom?.charAt(0) ?? ''}${nom?.charAt(0) ?? ''}`.toUpperCase();
  }

  // ---- Est-ce un message envoyé par moi ? ----
  estMonMessage(expediteurId: number): boolean {
    return expediteurId === this.authService.currentUser()?.id;
  }
}