// ============================================================
// src/app/messagerie/messagerie.ts
// ============================================================

import {
  Component, signal, OnInit, OnDestroy,
  ElementRef, ViewChild, AfterViewChecked
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import {
  MessagerieService,
  Conversation,
  NouveauMessage,
  UtilisateurSimple,
  Message
} from '../services/messagerie.service';

@Component({
  selector: 'app-messagerie',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './messagerie.html',
  styleUrls: ['./messagerie.css']
})
export class MessagerieComponent implements OnInit, OnDestroy, AfterViewChecked {

  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  conversationActive  = signal<Conversation | null>(null);
  nouveauMessage      = '';
  erreurEnvoi         = signal('');
  chargementEnvoi     = signal(false);

  messageSelectionne  = signal<Message | null>(null);
  messageEdition      = signal<Message | null>(null);
  texteEdition        = '';

  // ---- Modal nouvelle conversation ----
  modalNouvelleConvOuvert = signal(false);
  chargementUtilisateurs  = signal(false);
  erreurNouvelleConv      = signal('');
  chargementCreation      = signal(false);
  utilisateurRecherche    = signal('');
  utilisateurSelectionne  = signal<UtilisateurSimple | null>(null);

  // ---- Suppression ----
  suppressionEnCours = signal(false);

  private doitScroller    = false;
  private convActiveId: string | null = null;

  constructor(
    public authService:       AuthService,
    public messagerieService: MessagerieService
  ) {}

  ngOnInit(): void {
    const userId = this.authService.currentUser()?.id;
    if (!userId) return;

    // 1) Charger les conversations via REST
    this.messagerieService.chargerConversations(userId).subscribe({
      next: convs => {
        if (convs.length === 1) this.ouvrirConversation(convs[0]);
      },
      error: err => console.error('Erreur chargement conversations', err)
    });

    // 2) ✅ Connecter le WebSocket pour les messages temps réel
    this.messagerieService.connecterWebSocket(userId);
  }

  ngOnDestroy(): void {
    // Déconnecter proprement à la destruction du composant
    this.messagerieService.deconnecterWebSocket();
  }

  ngAfterViewChecked(): void {
    if (this.doitScroller) {
      this.scrollerEnBas();
      this.doitScroller = false;
    }
  }

  // ============================================================
  // OUVRIR UNE CONVERSATION
  // ============================================================
  ouvrirConversation(conv: Conversation): void {
    this.conversationActive.set(conv);
    this.convActiveId = conv.id;
    this.erreurEnvoi.set('');

    this.messagerieService.chargerMessages(conv.id).subscribe({
      next: () => {
        const updated = this.messagerieService
          .conversations()
          .find(c => c.id === conv.id);

        if (updated) this.conversationActive.set(updated);
        this.messagerieService.marquerLus(conv.id).subscribe();
        this.doitScroller = true;
      },
      error: err => console.error('Erreur chargement messages', err)
    });
  }

  // ============================================================
  // ENVOYER UN MESSAGE
  // Stratégie : REST pour la persistance + WebSocket pour
  // notifier le destinataire en temps réel
  // ============================================================
  envoyer(): void {
    const conv = this.conversationActive();
    const user = this.authService.currentUser();
    if (!conv || !user || !this.nouveauMessage.trim()) return;

    this.chargementEnvoi.set(true);
    this.erreurEnvoi.set('');

    const payload: NouveauMessage = {
      conversationId: conv.id,
      contenu:        this.nouveauMessage.trim()
    };

    // ── Envoyer via REST (persistance en base) ──
    this.messagerieService.envoyer(payload).subscribe({
      next: () => {
        // ── Notifier le destinataire via WebSocket ──
        this.messagerieService.envoyerViaSocket(payload, conv.destinataireId);

        this.nouveauMessage = '';
        this.chargementEnvoi.set(false);

        const updated = this.messagerieService
          .conversations()
          .find(c => c.id === conv.id);

        if (updated) this.conversationActive.set(updated);
        this.doitScroller = true;
      },
      error: err => {
        this.chargementEnvoi.set(false);
        this.erreurEnvoi.set('Échec de l\'envoi. Réessayez.');
        console.error('Erreur envoi message', err);
      }
    });
  }

  // ============================================================
  // MODIFIER / SUPPRIMER UN MESSAGE
  // ============================================================
  selectionnerMessage(msg: Message): void {
    this.messageSelectionne.set(
      this.messageSelectionne()?.id === msg.id ? null : msg
    );
  }

  modifierMessage(msg: Message): void {
    const nouveauTexte = prompt('Modifier le message :', msg.contenu);
    if (!nouveauTexte || nouveauTexte.trim() === msg.contenu) return;

    this.messagerieService.modifierMessage(msg.id, nouveauTexte.trim()).subscribe({
      next: () => {
        msg.contenu = nouveauTexte.trim();
        this.messageSelectionne.set(null);
      },
      error: err => console.error(err)
    });
  }

  supprimerMessage(msg: Message): void {
    if (!confirm('Supprimer ce message ?')) return;

    this.messagerieService.supprimerMessage(msg.id).subscribe({
      next: () => {
        const conv = this.conversationActive();
        if (!conv) return;
        conv.messages = conv.messages.filter(m => m.id !== msg.id);
        this.conversationActive.set({ ...conv });
        this.messageSelectionne.set(null);
      },
      error: err => console.error(err)
    });
  }

  // ============================================================
  // MODAL NOUVELLE CONVERSATION
  // ============================================================
  ouvrirModalNouvelleConv(): void {
    this.utilisateurRecherche.set('');
    this.utilisateurSelectionne.set(null);
    this.erreurNouvelleConv.set('');
    this.modalNouvelleConvOuvert.set(true);
    this.chargementUtilisateurs.set(true);

    this.messagerieService.chargerUtilisateurs().subscribe({
      next: ()  => this.chargementUtilisateurs.set(false),
      error: () => {
        this.chargementUtilisateurs.set(false);
        this.erreurNouvelleConv.set('Impossible de charger les utilisateurs.');
      }
    });
  }

  fermerModalNouvelleConv(): void {
    this.modalNouvelleConvOuvert.set(false);
    this.utilisateurSelectionne.set(null);
    this.erreurNouvelleConv.set('');
  }

  selectionnerUtilisateur(u: UtilisateurSimple): void {
    this.utilisateurSelectionne.set(u);
    this.erreurNouvelleConv.set('');
  }

  creerConversation(): void {
    const destinataire = this.utilisateurSelectionne();
    if (!destinataire) {
      this.erreurNouvelleConv.set('Veuillez sélectionner un destinataire.');
      return;
    }

    const existante = this.messagerieService
      .conversations()
      .find(c => c.destinataireId === destinataire.id);

    if (existante) {
      this.fermerModalNouvelleConv();
      this.ouvrirConversation(existante);
      return;
    }

    this.chargementCreation.set(true);
    this.erreurNouvelleConv.set('');

    this.messagerieService
      .creerConversation({ destinataireId: destinataire.id })
      .subscribe({
        next: conv => {
          this.chargementCreation.set(false);
          this.fermerModalNouvelleConv();
          this.ouvrirConversation(conv);
        },
        error: err => {
          this.chargementCreation.set(false);
          this.erreurNouvelleConv.set(
            err.error?.message || 'Impossible de créer la conversation.'
          );
        }
      });
  }

  // ============================================================
  // SUPPRIMER UNE CONVERSATION
  // ============================================================
  supprimerConversation(conv: Conversation): void {
    if (!confirm(`Supprimer la conversation avec ${conv.destinatairePrenom} ${conv.destinataireNom} ?`))
      return;

    this.suppressionEnCours.set(true);

    this.messagerieService.supprimerConversation(conv.id).subscribe({
      next: () => {
        this.suppressionEnCours.set(false);
        if (this.conversationActive()?.id === conv.id) {
          this.conversationActive.set(null);
        }
      },
      error: err => {
        this.suppressionEnCours.set(false);
        console.error('Erreur suppression conversation', err);
      }
    });
  }

  // ============================================================
  // HELPERS
  // ============================================================
  utilisateursFiltres(): UtilisateurSimple[] {
    const recherche = this.utilisateurRecherche().toLowerCase().trim();
    const moi = this.authService.currentUser()?.id;
    return this.messagerieService.utilisateurs().filter(u => {
      if (u.id === moi) return false;
      if (!recherche) return true;
      return `${u.prenom} ${u.nom}`.toLowerCase().includes(recherche);
    });
  }

  private scrollerEnBas(): void {
    try {
      const el = this.messagesContainer?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }

  formaterDate(date: string): string {
    try {
      return new Date(date).toLocaleTimeString('fr-FR', {
        hour: '2-digit', minute: '2-digit'
      });
    } catch { return date; }
  }

  formaterDateConv(date: string): string {
    if (!date) return '';
    try {
      const d   = new Date(date);
      const auj = new Date();
      if (d.toDateString() === auj.toDateString()) {
        return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      }
      return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    } catch { return date; }
  }

  initiales(nom: string, prenom: string): string {
    return `${prenom?.charAt(0) ?? ''}${nom?.charAt(0) ?? ''}`.toUpperCase();
  }

  estMonMessage(expediteurId: string): boolean {
    return expediteurId === this.authService.currentUser()?.id;
  }

  getAvatarColor(id: string): string {
    const colors = ['av-blue', 'av-green', 'av-coral', 'av-purple', 'av-amber', 'av-teal'];
    return colors[id ? id.charCodeAt(0) % colors.length : 0];
  }

  isNewDay(messages: Message[], index: number): boolean {
    if (index === 0) return true;
    const curr = new Date(messages[index].dateEnvoi).toDateString();
    const prev = new Date(messages[index - 1].dateEnvoi).toDateString();
    return curr !== prev;
  }

  formaterJour(date: string): string {
    const d   = new Date(date);
    const auj = new Date();
    if (d.toDateString() === auj.toDateString()) return "Aujourd'hui";
    const hier = new Date();
    hier.setDate(auj.getDate() - 1);
    if (d.toDateString() === hier.toDateString()) return 'Hier';
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' });
  }

  onEnter(event: Event): void {
    const e = event as KeyboardEvent;
    if (!e.shiftKey) { e.preventDefault(); this.envoyer(); }
  }
}