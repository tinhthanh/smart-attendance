import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  businessOutline,
  homeOutline,
  logOutOutline,
  peopleOutline,
  timeOutline,
} from 'ionicons/icons';
import { AuthService } from '../core/auth/auth.service';

addIcons({
  'home-outline': homeOutline,
  'business-outline': businessOutline,
  'people-outline': peopleOutline,
  'time-outline': timeOutline,
  'alert-circle-outline': alertCircleOutline,
  'log-out-outline': logOutOutline,
});

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, IonIcon],
  templateUrl: './main.layout.html',
  styleUrl: './main.layout.scss',
})
export class MainLayout {
  readonly auth = inject(AuthService);

  readonly userLabel = computed(() => {
    const u = this.auth.currentUser();
    return u ? `${u.full_name} (${u.roles.join(', ')})` : '';
  });

  async onLogout() {
    await this.auth.logout();
  }
}
