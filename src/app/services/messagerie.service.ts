import { Injectable, signal } from '@angular/core';

// Interface d'un message individuel
export interface Message {
  id: number;
  expediteurId: number;
  expediteurNom: string;
  expediteurPrenom: string;
  destinataireId: number;
  contenu: string;
  date: Date;
  lu: boolean;
}

// Interface d'une conversation (entre 2 personnes)
export interface Conversation {
  id: number;
  interlocuteurId: number;
  interlocuteurNom: string;
  interlocuteurPrenom: string;
  interlocuteurRole: string;
  interlocuteurDept: string;
  messages: Message[];
  // Calculé : dernier message pour l'aperçu
  get dernierMessage(): string;
  get nbNonLus(): number;
}

@Injectable({ providedIn: 'root' })
export class MessagerieService {

  // Signal contenant toutes les conversations
  private _conversations = signal<Conversation[]>([
    {
      id: 1,
      interlocuteurId: 2,
      interlocuteurNom: 'Agossou',
      interlocuteurPrenom: 'Kofi',
      interlocuteurRole: 'Manager',
      interlocuteurDept: 'Technique',
      messages: [
        {
          id: 1, expediteurId: 2,
          expediteurNom: 'Agossou', expediteurPrenom: 'Kofi',
          destinataireId: 1, contenu: 'Bonjour Ama, votre demande de congé a bien été reçue.',
          date: new Date('2024-01-20T09:00:00'), lu: true
        },
        {
          id: 2, expediteurId: 1,
          expediteurNom: 'Koudjo', expediteurPrenom: 'Ama',
          destinataireId: 2, contenu: 'Merci Chef, j\'attends votre validation.',
          date: new Date('2024-01-20T09:05:00'), lu: true
        },
        {
          id: 3, expediteurId: 2,
          expediteurNom: 'Agossou', expediteurPrenom: 'Kofi',
          destinataireId: 1, contenu: 'Je regarde ça aujourd\'hui.',
          date: new Date('2024-01-20T09:10:00'), lu: false
        },
      ],
      get dernierMessage() {
        return this.messages[this.messages.length - 1]?.contenu ?? '';
      },
      get nbNonLus() {
        return this.messages.filter(m => !m.lu && m.expediteurId !== 1).length;
      }
    },
    {
      id: 2,
      interlocuteurId: 3,
      interlocuteurNom: 'Dossou',
      interlocuteurPrenom: 'Adjoa',
      interlocuteurRole: 'RH',
      interlocuteurDept: 'RH',
      messages: [
        {
          id: 4, expediteurId: 3,
          expediteurNom: 'Dossou', expediteurPrenom: 'Adjoa',
          destinataireId: 1, contenu: 'Bonjour, pensez à joindre votre justificatif médical.',
          date: new Date('2024-01-19T14:00:00'), lu: false
        },
      ],
      get dernierMessage() {
        return this.messages[this.messages.length - 1]?.contenu ?? '';
      },
      get nbNonLus() {
        return this.messages.filter(m => !m.lu && m.expediteurId !== 1).length;
      }
    }
  ]);

  // Lecture publique en readonly
  conversations = this._conversations.asReadonly();

  // Envoyer un message dans une conversation existante
  envoyerMessage(
    conversationId: number,
    expediteurId: number,
    expediteurNom: string,
    expediteurPrenom: string,
    destinataireId: number,
    contenu: string
  ): void {
    this._conversations.update(convs =>
      convs.map(conv => {
        if (conv.id !== conversationId) return conv;

        // Nouvel ID = max existant + 1
        const maxId = Math.max(...conv.messages.map(m => m.id), 0);

        const nouveauMsg: Message = {
          id: maxId + 1,
          expediteurId,
          expediteurNom,
          expediteurPrenom,
          destinataireId,
          contenu,
          date: new Date(),
          lu: false
        };

        return { ...conv, messages: [...conv.messages, nouveauMsg] };
      })
    );
  }

  // Marquer tous les messages d'une conversation comme lus
  marquerCommeLus(conversationId: number, userId: number): void {
    this._conversations.update(convs =>
      convs.map(conv => {
        if (conv.id !== conversationId) return conv;
        return {
          ...conv,
          messages: conv.messages.map(m =>
            // On marque seulement les messages reçus (pas les siens)
            m.destinataireId === userId ? { ...m, lu: true } : m
          )
        };
      })
    );
  }

  // Nombre total de messages non lus (pour le badge dans la sidebar)
  totalNonLus(userId: number): number {
    return this._conversations().reduce((total, conv) =>
      total + conv.messages.filter(m => !m.lu && m.destinataireId === userId).length
    , 0);
  }
}