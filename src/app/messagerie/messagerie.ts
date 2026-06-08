// ============================================================
// src/app/messagerie/messagerie.ts
// ============================================================

import {
  Component, signal, computed, OnInit, OnDestroy,
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

  conversationActive = signal<Conversation | null>(null);
  nouveauMessage     = '';
  erreurEnvoi        = signal('');
  chargementEnvoi    = signal(false);

  messageSelectionne = signal<Message | null>(null);
  messageEdition     = signal<Message | null>(null);

  // ✅ Recalculé automatiquement dès que _conversations change dans le service
  messagesActifs = computed(() => {
    const convId = this.conversationActive()?.id;
    if (!convId) return [];
    return this.messagerieService.conversations()
      .find(c => c.id === convId)?.messages ?? [];
  });

  // Vérifier si un message est en cours d'envoi (ID temporaire)
  estEnCoursEnvoi(msg: Message): boolean {
    return msg.id.startsWith('temp-');
  }

  modalNouvelleConvOuvert = signal(false);
  chargementUtilisateurs  = signal(false);
  erreurNouvelleConv      = signal('');
  chargementCreation      = signal(false);
  utilisateurRecherche    = signal('');
  utilisateurSelectionne  = signal<UtilisateurSimple | null>(null);
  suppressionEnCours      = signal(false);

  private doitScroller = false;

  constructor(
    public authService:       AuthService,
    public messagerieService: MessagerieService
  ) {}

   ngOnInit(): void {
  const userId = this.authService.currentUser()?.id;
  if (!userId) return;

  this.messagerieService.chargerConversations(userId).subscribe({
    next: convs => {
      // ✅ S'abonner à toutes les conversations existantes dès le chargement
      convs.forEach(c => this.messagerieService.abonnerConversation(c.id));
      if (convs.length === 1) this.ouvrirConversation(convs[0]);
    },
    error: err => console.error('Erreur chargement conversations', err)
  });

  this.messagerieService.connecterWebSocket(userId.toString());
}

  ngOnDestroy(): void {
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
  this.erreurEnvoi.set('');
  this.annulerEdition();

  // ✅ S'abonner au topic de cette conversation
  this.messagerieService.abonnerConversation(conv.id);

  this.messagerieService.chargerMessages(conv.id).subscribe({
    next: () => {
      const updated = this.messagerieService.conversations()
        .find(c => c.id === conv.id);
      if (updated) this.conversationActive.set(updated);
      this.messagerieService.marquerLus(conv.id).subscribe();
      this.doitScroller = true;
    },
    error: err => console.error('Erreur chargement messages', err)
  });
}

  // ============================================================
  // ENVOYER
  // ✅ Le service ajoute le message dans le signal + met à jour lastMessage
  //    Le composant n'a qu'à déclencher le scroll et notifier le WebSocket
  // ============================================================
  envoyer(): void {
    const conv = this.conversationActive();
    const user = this.authService.currentUser();
    if (!conv || !user || !this.nouveauMessage.trim()) return;

    const contenu = this.nouveauMessage.trim();
    this.chargementEnvoi.set(true);
    this.erreurEnvoi.set('');
    // ✅ Vider le champ immédiatement pour un retour visuel instantané
    this.nouveauMessage = '';

    const payload: NouveauMessage = {
      conversationId: conv.id,
      contenu
    };

    this.messagerieService.envoyer(payload).subscribe({
      next: () => {
        // ✅ Le service a déjà ajouté le message dans _conversations via tap()
        //    messagesActifs() se recalcule automatiquement → bulle apparaît
        this.messagerieService.envoyerViaSocket(payload, conv.destinataireId);
        this.chargementEnvoi.set(false);
        this.doitScroller = true;
      },
      error: err => {
        this.chargementEnvoi.set(false);
        // Remettre le texte si erreur
        this.nouveauMessage = contenu;
        this.erreurEnvoi.set("Échec de l'envoi. Réessayez.");
        console.error(err);
      }
    });
  }

  // ============================================================
  // SÉLECTIONNER (toggle boutons modifier/supprimer)
  // ============================================================
  selectionnerMessage(msg: Message): void {
    if (this.messageEdition()) return;
    this.messageSelectionne.set(
      this.messageSelectionne()?.id === msg.id ? null : msg
    );
  }

  // ============================================================
  // ÉDITION INLINE
  // ============================================================
  ouvrirEdition(msg: Message): void {
    this.messageEdition.set(msg);
    this.messageSelectionne.set(null);
    this.nouveauMessage = msg.contenu;
    setTimeout(() => {
      const input = document.querySelector('.wa-text-input') as HTMLInputElement;
      if (input) { input.focus(); input.select(); }
    }, 50);
  }

  validerEdition(): void {
    const msg = this.messageEdition();
    if (!msg || !this.nouveauMessage.trim()) return;
    if (this.nouveauMessage.trim() === msg.contenu) {
      this.annulerEdition();
      return;
    }

    const nouveauContenu = this.nouveauMessage.trim();
    this.chargementEnvoi.set(true);

    this.messagerieService.modifierMessage(msg.id, nouveauContenu).subscribe({
      next: () => {
        this.messagerieService.mettreAJourMessage(msg.id, nouveauContenu);

        // ✅ Si c'est le dernier message, mettre à jour l'aperçu sidebar
        const msgs = this.messagesActifs();
        if (msgs.length > 0 && msgs[msgs.length - 1].id === msg.id) {
          this.messagerieService.mettreAJourApercu(
            this.conversationActive()!.id,
            nouveauContenu
          );
        }

        this.chargementEnvoi.set(false);
        this.annulerEdition();
      },
      error: err => {
        this.chargementEnvoi.set(false);
        this.erreurEnvoi.set('Impossible de modifier le message.');
        console.error(err);
      }
    });
  }

  annulerEdition(): void {
    this.messageEdition.set(null);
    this.messageSelectionne.set(null);
    this.nouveauMessage = '';
  }

  // ============================================================
  // SUPPRIMER UN MESSAGE
  // ============================================================
  supprimerMessage(msg: Message): void {
    if (!confirm('Supprimer ce message ?')) return;

    this.messagerieService.supprimerMessage(msg.id).subscribe({
      next: () => {
        this.messagerieService.supprimerMessageLocal(msg.id, msg.conversationId);
        this.messageSelectionne.set(null);

        // ✅ Mettre à jour l'aperçu avec le nouveau dernier message
        const conv = this.conversationActive();
        if (conv) {
          const msgs = this.messagesActifs();
          const dernierContenu = msgs.length > 0
            ? msgs[msgs.length - 1].contenu
            : '';
          this.messagerieService.mettreAJourApercu(conv.id, dernierContenu);
        }
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

    const existante = this.messagerieService.conversations()
      .find(c => c.destinataireId === destinataire.id);

    if (existante) {
      this.fermerModalNouvelleConv();
      this.ouvrirConversation(existante);
      return;
    }

    this.chargementCreation.set(true);
    this.erreurNouvelleConv.set('');

    this.messagerieService.creerConversation({ destinataireId: destinataire.id }).subscribe({
      next: conv => {
        this.chargementCreation.set(false);
        this.fermerModalNouvelleConv();
        this.ouvrirConversation(conv);
      },
      error: err => {
        this.chargementCreation.set(false);
        this.erreurNouvelleConv.set(err.error?.message || 'Impossible de créer la conversation.');
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
        console.error(err);
      }
    });
  }

  // ============================================================
  // ✅ HELPER — Nombre total de messages d'une conversation
  //    Réactif : se recalcule automatiquement quand le signal change
  // ============================================================
  totalMessages(conv: Conversation): number {
    return this.messagerieService.conversations()
      .find(c => c.id === conv.id)?.messages?.length ?? 0;
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
        hour:   '2-digit',
        minute: '2-digit'
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
    return d.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day:     '2-digit',
      month:   'long'
    });
  }
}