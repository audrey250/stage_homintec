import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { MessagerieFabComponent } from './messagerie-fab.component';
import { AuthService } from './services/auth.service';
import { MessagerieService } from './services/messagerie.service';
import { NotificationsComponent } from './notifications/notifications';
// puis dans imports: [NotificationsComponent]
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, MessagerieFabComponent],
  template: `
    <router-outlet></router-outlet>
    <app-messagerie-fab *ngIf="authService.isLoggedIn()"></app-messagerie-fab>
  `
})
export class AppComponent implements OnInit {
  constructor(
    public authService: AuthService,
    private messagerieService: MessagerieService
  ) {}

  ngOnInit(): void {
    const userId = this.authService.currentUser()?.id;
    if (userId) {
      this.messagerieService.chargerConversations(userId)
        .subscribe({ error: () => {} });
    }
  }
}