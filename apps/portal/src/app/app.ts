import { Component, OnInit, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { AuthService } from './core/auth/auth.service';

@Component({
  imports: [IonApp, IonRouterOutlet],
  selector: 'app-root',
  template: '<ion-app><ion-router-outlet></ion-router-outlet></ion-app>',
})
export class App implements OnInit {
  private readonly auth = inject(AuthService);

  async ngOnInit() {
    await this.auth.initFromStorage();
  }
}
