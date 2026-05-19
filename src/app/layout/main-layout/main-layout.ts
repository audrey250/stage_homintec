import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';

import { SidebarComponent } from '../sidebar/sidebar';
import { NavbarComponent } from '../navbar/navbar';
import { SidebarService } from '../../services/sidebar.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    SidebarComponent,
    NavbarComponent
  ],
  templateUrl: './main-layout.html',
  styleUrls: ['./main-layout.css']
})
export class MainLayoutComponent implements OnInit {
  constructor(public sidebarService: SidebarService) {}

  ngOnInit(): void {
    this.sidebarService.syncWithViewport();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.sidebarService.syncWithViewport();
  }

  closeMobileSidebar(): void {
    this.sidebarService.closeMobile();
  }

  /**
   * Fermer la sidebar avec la touche Escape
   */
  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.sidebarService.isMobileViewport()) {
      this.sidebarService.closeMobile();
    }
  }
}