import { Component, computed, inject, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import 'iconify-icon';
import { AuthService } from '../core/auth/auth.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
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
