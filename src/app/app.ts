import { Component } from '@angular/core';
// RouterOutlet = l'endroit où Angular affiche
// le composant correspondant à la route active
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  // Template minimal : juste le router-outlet
  // Angular remplacera cette balise par le bon composant
  // selon l'URL : /login → LoginComponent, /dashboard → DashboardComponent...
  template: `<router-outlet />`
})
export class App {}