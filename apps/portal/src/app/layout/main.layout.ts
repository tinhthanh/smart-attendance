import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {
  IonButton,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonMenu,
  IonMenuToggle,
  IonRouterOutlet,
  IonSplitPane,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
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
  'log-out-outline': logOutOutline,
});

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    IonSplitPane,
    IonMenu,
    IonContent,
    IonList,
    IonItem,
    IonIcon,
    IonLabel,
    IonMenuToggle,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButton,
    IonChip,
    IonRouterOutlet,
  ],
  templateUrl: './main.layout.html',
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
