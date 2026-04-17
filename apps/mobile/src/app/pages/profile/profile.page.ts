import { Component, inject } from '@angular/core';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  idCardOutline,
  locationOutline,
  businessOutline,
  logOutOutline,
} from 'ionicons/icons';

addIcons({
  'id-card-outline': idCardOutline,
  'location-outline': locationOutline,
  'business-outline': businessOutline,
  'log-out-outline': logOutOutline,
});
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [IonContent, IonIcon],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
})
export class ProfilePage {
  readonly auth = inject(AuthService);

  async onLogout() {
    await this.auth.logout();
  }
}
