import { Component, inject } from '@angular/core';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonChip,
  IonLabel,
} from '@ionic/angular/standalone';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    IonChip,
    IonLabel,
  ],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Dashboard</ion-title>
        <ion-button slot="end" fill="clear" color="light" (click)="onLogout()">
          Đăng xuất
        </ion-button>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      @if (auth.currentUser(); as user) {
      <h2>Xin chào, {{ user.full_name }}</h2>
      <p>Email: {{ user.email }}</p>
      <div>
        @for (role of user.roles; track role) {
        <ion-chip color="tertiary">
          <ion-label>{{ role }}</ion-label>
        </ion-chip>
        }
      </div>
      <br />
      <p><em>Dashboard chi tiết sẽ hoàn thiện ở T-015.</em></p>
      }
    </ion-content>
  `,
})
export class DashboardPage {
  readonly auth = inject(AuthService);

  async onLogout() {
    await this.auth.logout();
  }
}
