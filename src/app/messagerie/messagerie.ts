import { Component, signal, OnInit, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { MessagerieService, Conversation } from '../services/messagerie.service';

@Component({
  selector: 'app-messagerie',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './messagerie.html',
  styleUrl: './messagerie.scss'
})
export class MessagerieComponent implements OnInit, AfterViewChecked {

  // Référence au conteneur des messages pour le scroll automatique
  // ViewChild permet d'accéder à un élément HTML depuis le TypeScript
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  // La conversation actuellement ouverte (null = aucune sélectionnée)
  conversationActive = signal<Conversation | null>(null);

  // Le texte en cours de saisie
  nouveauMessage = '';

  // Pour savoir si on doit scroller en bas
  private doitScroller = false;

  constructor(
    public authService: AuthService,
    public messagerieService: MessagerieService
  ) {}

  ngOnInit(): void {
    // Si une seule conversation, on l'ouvre directement
    const convs = this.messagerieService.conversations();
    if (convs.length === 1) {
      this.ouvrirConversation(convs[0]);
    }
  }

  // Après chaque rendu du composant, on scrolle en bas si nécessaire
  ngAfterViewChecked(): void {
    if (this.doitScroller) {
      this.scrollerEnBas();
      this.doitScroller = false;
    }
  }

  // Ouvrir une conversation
  ouvrirConversation(conv: Conversation): void {
    this.conversationActive.set(conv);
    // Marquer comme lus
    const userId = this.authService.currentUser()?.id ?? 0;
    this.messagerieService.marquerCommeLus(conv.id, userId);
    // Scroller en bas après rendu
    this.doitScroller = true;
  }

  // Envoyer un message
  envoyer(): void {
    const conv = this.conversationActive();
    const user = this.authService.currentUser();

    // Vérifications : conv ouverte, user connecté, message non vide
    if (!conv || !user || !this.nouveauMessage.trim()) return;

    this.messagerieService.envoyerMessage(
      conv.id,
      user.id,
      user.nom,
      user.prenom,
      conv.interlocuteurId,
      this.nouveauMessage.trim()
    );

    // On vide le champ
    this.nouveauMessage = '';
    // On rafraîchit la conversation active
    const updated = this.messagerieService.conversations()
      .find(c => c.id === conv.id);
    if (updated) this.conversationActive.set(updated);
    // On scrolle en bas
    this.doitScroller = true;
  }

  // Scroller en bas du conteneur messages
  private scrollerEnBas(): void {
    try {
      const el = this.messagesContainer?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }

  // Formater la date d'un message
  formaterDate(date: Date): string {
    const d = new Date(date);
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  // Initiales pour l'avatar
  initiales(nom: string, prenom: string): string {
    return `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();
  }

  // L'utilisateur connecté est-il l'expéditeur ?
  estMonMessage(expediteurId: number): boolean {
    return expediteurId === this.authService.currentUser()?.id;
  }
}