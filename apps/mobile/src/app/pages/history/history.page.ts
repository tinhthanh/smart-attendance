import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  ToastController,
  IonBadge,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
} from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { CheckinApiService } from '../../core/checkin/checkin.api.service';
import { showErrorToast } from '../../core/util/error-toast.util';
import { AttendanceSession } from '../../shared/types/checkin.types';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [
    DatePipe,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonList,
    IonItem,
    IonLabel,
    IonNote,
    IonBadge,
    IonSpinner,
    IonText,
  ],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Lịch sử</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      @if (loading()) {
      <div class="ion-text-center ion-padding">
        <ion-spinner name="crescent"></ion-spinner>
      </div>
      } @else if (sessions().length === 0) {
      <div class="ion-text-center ion-padding">
        <ion-text color="medium">Chưa có lịch sử</ion-text>
      </div>
      } @else {
      <ion-list>
        @for (s of sessions(); track s.id) {
        <ion-item>
          <ion-label>
            <h2>{{ s.work_date }}</h2>
            <p>
              Vào:
              {{
                s.check_in_at ? (s.check_in_at | date : 'HH:mm') : '--'
              }}
              &nbsp;·&nbsp; Ra:
              {{ s.check_out_at ? (s.check_out_at | date : 'HH:mm') : '--' }}
            </p>
            @if (s.worked_minutes) {
            <p>Giờ làm: {{ s.worked_minutes }} phút</p>
            }
          </ion-label>
          <ion-note slot="end">
            @if (s.trust_score !== null) {
            <ion-badge
              [color]="
                (s.trust_score ?? 0) >= 70
                  ? 'success'
                  : (s.trust_score ?? 0) >= 40
                  ? 'warning'
                  : 'danger'
              "
              [attr.aria-label]="'Điểm tin cậy ' + s.trust_score"
              >{{ s.trust_score }}</ion-badge
            >
            }
            <br />
            <ion-badge color="tertiary">{{ s.status }}</ion-badge>
          </ion-note>
        </ion-item>
        }
      </ion-list>
      }
    </ion-content>
  `,
})
export class HistoryPage {
  private readonly api = inject(CheckinApiService);
  private readonly toast = inject(ToastController);

  readonly sessions = signal<AttendanceSession[]>([]);
  readonly loading = signal(false);

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
