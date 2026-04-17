import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ModalController,
  ToastController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  alertCircle,
  checkmarkCircle,
  closeCircle,
  hammerOutline,
} from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { AttendanceApiService } from '../../core/attendance/attendance.api.service';
import { AuthService } from '../../core/auth/auth.service';
import {
  showErrorToast,
  showSuccessToast,
} from '../../core/util/error-toast.util';
import {
  SessionStatus,
  SessionWithEvents,
} from '../../shared/types/attendance-session.types';
import {
  formatAttendanceStatus,
  formatEventType,
} from '@smart-attendance/shared/constants';
import { RiskFlagChipComponent } from '../../shared/components/risk-flag-chip.component';
import { OverrideSessionModal } from './override-session.modal';

addIcons({
  'checkmark-circle': checkmarkCircle,
  'close-circle': closeCircle,
  'alert-circle': alertCircle,
  'hammer-outline': hammerOutline,
});

@Component({
  selector: 'app-session-detail',
  standalone: true,
  imports: [
    DatePipe,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonList,
    IonItem,
    IonLabel,
    IonChip,
    IonButton,
    IonIcon,
    IonText,
    IonSpinner,
    RiskFlagChipComponent,
  ],
  templateUrl: './session-detail.page.html',
})
export class SessionDetailPage {
  private readonly api = inject(AttendanceApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly modalCtrl = inject(ModalController);
  private readonly toastCtrl = inject(ToastController);

  readonly session = signal<SessionWithEvents | null>(null);
  readonly loading = signal(false);
  readonly notFound = signal(false);
  readonly canOverride = computed(() => {
    const roles = this.auth.currentUser()?.roles ?? [];
    return roles.includes('admin') || roles.includes('manager');
  });

  private sessionId = '';

  formatStatus = formatAttendanceStatus;
  formatEvent = formatEventType;

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.sessionId = id;
    await this.load();
  }

  async load() {
    this.loading.set(true);
    this.notFound.set(false);
    try {
      const resp = await firstValueFrom(this.api.get(this.sessionId));
      this.session.set(resp.data);
    } catch (err) {
      const code = (err as { error?: { error?: { code?: string } } })?.error
        ?.error?.code;
      if (code === 'NOT_FOUND' || code === 'FORBIDDEN') {
        this.notFound.set(true);
      } else {
        await showErrorToast(this.toastCtrl, err);
      }
    } finally {
      this.loading.set(false);
    }
  }

  trustColor(score: number | null): string {
    if (score === null) return 'medium';
    if (score >= 70) return 'success';
    if (score >= 40) return 'warning';
    return 'danger';
  }

  statusColor(status: SessionStatus): string {
    switch (status) {
      case 'on_time':
        return 'success';
      case 'late':
      case 'early_leave':
        return 'warning';
      case 'absent':
      case 'missing_checkout':
        return 'danger';
      default:
        return 'medium';
    }
  }

  async onOverride() {
    const s = this.session();
    if (!s) return;
    const modal = await this.modalCtrl.create({
      component: OverrideSessionModal,
      componentProps: { sessionId: s.id, currentStatus: s.status },
    });
    await modal.present();
    const { data } = await modal.onDidDismiss<{ updated: true } | undefined>();
    if (data?.updated) {
      await showSuccessToast(
        this.toastCtrl,
        'Đã ghi đè trạng thái — audit log đã lưu'
      );
      await this.load();
    }
  }

  goBack() {
    this.router.navigate(['/attendance']);
  }
}
