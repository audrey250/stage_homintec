
// src/app/messagerie-fab.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MessagerieService } from './services/messagerie.service';

@Component({
  selector: 'app-messagerie-fab',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <a routerLink="/messagerie" class="fab-btn" title="Messagerie">
      <i class="fas fa-comments"></i>
      <span *ngIf="messagerieService.totalNonLus() > 0" class="fab-badge">
        {{ messagerieService.totalNonLus() }}
      </span>
    </a>
  `,
 styles: [`
  .fab-btn {
    position: fixed;
    bottom: 28px;
    right: 28px;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: #28a745;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    box-shadow: 0 4px 16px rgba(40, 167, 69, .45);
    z-index: 1050;
    text-decoration: none;
    transition: transform .15s, box-shadow .15s;
  }

  .fab-btn:hover {
    transform: scale(1.08);
    box-shadow: 0 6px 20px rgba(40, 167, 69, .55);
  }

  .fab-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    background: #e74c3c;
    color: white;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 600;
    min-width: 18px;
    height: 18px;
    padding: 0 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
`]
})
export class MessagerieFabComponent {
  constructor(public messagerieService: MessagerieService) {}
} 

