import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ToastController,
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonMenuButton,
  IonNote,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { checkmarkCircleOutline, refreshOutline } from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { DashboardApiService } from '../../core/dashboard/dashboard.api.service';
import { showErrorToast } from '../../core/util/error-toast.util';
import { AnomaliesPayload } from '../../shared/types/dashboard.types';

addIcons({
  'refresh-outline': refreshOutline,
  'checkmark-circle-outline': checkmarkCircleOutline,
});

@Component({
  selector: 'app-anomalies',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonMenuButton,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonList,
    IonItem,
    IonLabel,
    IonNote,
    IonChip,
    IonBadge,
    IonButton,
    IonIcon,
    IonText,
    IonSpinner,
  ],
  templateUrl: './anomalies.page.html',
})
export class AnomaliesPage {
  private readonly api = inject(DashboardApiService);
  private readonly toast = inject(ToastController);

  readonly data = signal<AnomaliesPayload | null>(null);
  readonly loading = signal(false);

  async ngOnInit() {
    await this.refresh();
  }

  async refresh() {
    this.loading.set(true);
    try {
      const resp = await firstValueFrom(this.api.getAnomalies());
      this.data.set(resp.data);
    } catch (err) {
      await showErrorToast(this.toast, err);
    } finally {
      this.loading.set(false);
    }
  }

  isEmpty(): boolean {
    const d = this.data();
    return (
      !!d &&
      d.branches_late_spike.length === 0 &&
      d.employees_low_trust.length === 0 &&
      d.untrusted_devices_new_today === 0
    );
  }
}
