// ============================================================
// src/app/notifications/notifications.ts
// ============================================================

import {
  Component, OnInit, OnDestroy, signal, computed, HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { NotificationService, Notification } from '../services/notification.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications.html',
  styleUrls: ['./notifications.css']
})
export class NotificationsComponent implements OnInit, OnDestroy {

  panneauOuvert = signal(false);
  ongletActif   = signal<'toutes' | 'non-lues'>('toutes');

  // Notifications filtrées selon l'onglet actif
  notificationsFiltrees = computed(() => {
    const liste = this.notifService.notifications();
    return this.ongletActif() === 'non-lues'
      ? liste.filter(n => n.statut === 'NON_LU')
      : liste;
  });

  constructor(
    public authService:  AuthService,
    public notifService: NotificationService
  ) {}

  ngOnInit(): void {
    const userId = this.authService.currentUser()?.id;
    if (!userId) return;

    const userIdStr = String(userId);

    // 1) Charger les notifications via REST au démarrage
    this.notifService.chargerNotifications(userIdStr).subscribe({
      error: err => console.error('Erreur chargement notifications', err)
    });

    // 2) Connecter le WebSocket pour les notifications temps réel
    this.notifService.connecterWebSocket(userIdStr);
  }

  ngOnDestroy(): void {
    // Déconnecter proprement le WebSocket quand le composant est détruit
    this.notifService.deconnecterWebSocket();
  }

  // Fermer le panneau si on clique en dehors
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.notif-wrapper')) {
      this.panneauOuvert.set(false);
    }
  }

  togglePanneau(): void {
    this.panneauOuvert.update(v => !v);
  }

  changerOnglet(onglet: 'toutes' | 'non-lues'): void {
    this.ongletActif.set(onglet);
  }

  // Marquer une notification comme lue ET ouvrir si lien
  lire(notif: Notification): void {
    if (notif.statut === 'NON_LU') {
      this.notifService.marquerCommeLue(notif.id).subscribe();
    }
  }

  marquerToutesLues(): void {
    const userId = this.authService.currentUser()?.id;
    if (!userId) return;
    this.notifService.marquerToutesLues(String(userId)).subscribe();
  }

  supprimer(event: MouseEvent, id: string): void {
    event.stopPropagation(); // ne pas déclencher lire()
    this.notifService.supprimer(id).subscribe();
  }

  // Icône selon le contenu de la notification
  icone(notif: Notification): string {
    const c = notif.contenu.toLowerCase();
    if (c.includes('approuv'))   return 'fas fa-check-circle';
    if (c.includes('refus'))     return 'fas fa-times-circle';
    if (c.includes('annul'))     return 'fas fa-ban';
    if (c.includes('congé') || c.includes('permission')) return 'fas fa-calendar-alt';
    if (c.includes('message'))   return 'fas fa-envelope';
    if (c.includes('modif'))     return 'fas fa-pen';
    return 'fas fa-bell';
  }

  // Couleur de l'icône selon le type
  couleurIcone(notif: Notification): string {
    const c = notif.contenu.toLowerCase();
    if (c.includes('approuv'))   return 'text-success';
    if (c.includes('refus'))     return 'text-danger';
    if (c.includes('annul'))     return 'text-warning';
    if (c.includes('message'))   return 'text-primary';
    return 'text-secondary';
  }
}