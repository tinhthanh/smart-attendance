import { Component, inject } from '@angular/core';
import {
  IonButton,
  IonChip,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonChip,
    IonButton,
  ],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Tôi</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      @if (auth.currentUser(); as u) {
      <ion-list>
        <ion-item>
          <ion-label>
            <h2>{{ u.full_name }}</h2>
            <p>{{ u.email }}</p>
          </ion-label>
        </ion-item>
        @if (u.employee; as e) {
        <ion-item>
          <ion-label>
            <h3>Mã nhân viên</h3>
            <p>{{ e.employee_code }}</p>
          </ion-label>
        </ion-item>
        @if (e.primary_branch; as b) {
        <ion-item>
          <ion-label>
            <h3>Chi nhánh chính</h3>
            <p>{{ b.name }}</p>
          </ion-label>
        </ion-item>
        } @if (e.department; as d) {
        <ion-item>
          <ion-label>
            <h3>Phòng ban</h3>
            <p>{{ d.name }}</p>
          </ion-label>
        </ion-item>
        } }
        <ion-item>
          <ion-label>
            <h3>Vai trò</h3>
            @for (r of u.roles; track r) {
            <ion-chip color="tertiary">
              <ion-label>{{ r }}</ion-label>
            </ion-chip>
            }
          </ion-label>
        </ion-item>
      </ion-list>
      <br />
      <ion-button expand="block" color="danger" (click)="onLogout()"
        >Đăng xuất</ion-button
      >
      }
    </ion-content>
  `,
})
export class ProfilePage {
  readonly auth = inject(AuthService);

  async onLogout() {
    await this.auth.logout();
  }
}
