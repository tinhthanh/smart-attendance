import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  ToastController,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  RefresherCustomEvent,
  IonIcon,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  calendarClearOutline,
  arrowForwardOutline,
  hourglassOutline,
  timeOutline,
  shieldCheckmark,
} from 'ionicons/icons';

addIcons({
  'calendar-clear-outline': calendarClearOutline,
  'arrow-forward-outline': arrowForwardOutline,
  'hourglass-outline': hourglassOutline,
  'time-outline': timeOutline,
  'shield-checkmark': shieldCheckmark,
});
import { firstValueFrom } from 'rxjs';
import { CheckinApiService } from '../../core/checkin/checkin.api.service';
import { showErrorToast } from '../../core/util/error-toast.util';
import { AttendanceSession } from '../../shared/types/checkin.types';
import { formatAttendanceStatus } from '@smart-attendance/shared/constants';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [
    DatePipe,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonSpinner,
    IonIcon,
  ],
  templateUrl: './history.page.html',
  styleUrl: './history.page.scss',
})
export class HistoryPage {
  private readonly api = inject(CheckinApiService);
  private readonly toast = inject(ToastController);

  readonly sessions = signal<AttendanceSession[]>([]);
  readonly loading = signal(false);

  formatStatus = formatAttendanceStatus;

  async ngOnInit() {
    await this.reload();
  }

  async ionViewWillEnter() {
    await this.reload();
  }

  async reload() {
    this.loading.set(true);
    try {
      const resp = await firstValueFrom(this.api.listMe());
      this.sessions.set(resp.data);
    } catch (err) {
      await showErrorToast(this.toast, err);
    } finally {
      this.loading.set(false);
    }
  }

  async onRefresh(event: Event) {
    await this.reload();
    (event as RefresherCustomEvent).target.complete();
  }
}
