import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import {
  AlertController,
  ToastController,
  IonContent,
  IonCard,
  IonIcon,
  IonSpinner,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  alertCircle,
  checkmarkCircle,
  cloudOfflineOutline,
  warningOutline,
  fingerPrintOutline,
  locationOutline,
  idCardOutline,
  businessOutline,
  timeOutline,
  shieldCheckmarkOutline,
  calendarClearOutline,
  logInOutline,
  logOutOutline,
} from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { GeolocationService } from '../../core/capacitor/geolocation.service';
import { DeviceService } from '../../core/capacitor/device.service';
import { NetworkService } from '../../core/capacitor/network.service';
import { WifiService } from '../../core/capacitor/wifi.service';
import { CheckinApiService } from '../../core/checkin/checkin.api.service';
import {
  getRiskFlagInfo,
  pickPrimaryFlag,
} from '@smart-attendance/shared/constants';
import {
  errorMessage,
  flagMessage,
  showErrorToast,
} from '../../core/util/error-toast.util';
import {
  AttendanceSession,
  CheckInResponse,
  CheckOutResponse,
} from '../../shared/types/checkin.types';

addIcons({
  'checkmark-circle': checkmarkCircle,
  'alert-circle': alertCircle,
  'warning-outline': warningOutline,
  'cloud-offline-outline': cloudOfflineOutline,
  'finger-print-outline': fingerPrintOutline,
  'location-outline': locationOutline,
  'id-card-outline': idCardOutline,
  'business-outline': businessOutline,
  'time-outline': timeOutline,
  'shield-checkmark-outline': shieldCheckmarkOutline,
  'calendar-clear-outline': calendarClearOutline,
  'log-in-outline': logInOutline,
  'log-out-outline': logOutOutline,
});

type CheckinResult =
  | (CheckInResponse & { kind: 'in' })
  | (CheckOutResponse & { kind: 'out' });

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [DatePipe, IonContent, IonCard, IonIcon, IonSpinner],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage {
  private readonly auth = inject(AuthService);
  private readonly geo = inject(GeolocationService);
  private readonly wifi = inject(WifiService);
  private readonly deviceSvc = inject(DeviceService);
  private readonly network = inject(NetworkService);
  private readonly checkin = inject(CheckinApiService);
  private readonly toast = inject(ToastController);
  private readonly alert = inject(AlertController);

  readonly user = this.auth.currentUser;
  readonly online = this.network.online;
  readonly loadingTodaySession = signal(false);
  readonly submitting = signal(false);
  readonly todaySession = signal<AttendanceSession | null>(null);
  readonly lastResult = signal<CheckinResult | null>(null);

  readonly status = computed<'none' | 'checked_in' | 'done'>(() => {
    const s = this.todaySession();
    if (!s || !s.check_in_at) return 'none';
    if (!s.check_out_at) return 'checked_in';
    return 'done';
  });

  async ngOnInit() {
    await this.loadToday();
  }

  async ionViewWillEnter() {
    await this.loadToday();
  }

  async loadToday() {
    this.loadingTodaySession.set(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const resp = await firstValueFrom(this.checkin.listMe(today, today));
      this.todaySession.set(resp.data[0] ?? null);
    } catch (err) {
      await showErrorToast(this.toast, err);
    } finally {
      this.loadingTodaySession.set(false);
    }
  }

  async onCheckIn() {
    await this.submitCheckin('in');
  }

  async onCheckOut() {
    await this.submitCheckin('out');
  }

  private async submitCheckin(kind: 'in' | 'out') {
    if (!this.online()) {
      await showErrorToast(this.toast, {
        error: {
          error: { message: 'Mất kết nối — vui lòng thử lại khi có mạng' },
        },
      });
      return;
    }

    this.submitting.set(true);
    try {
      const gps = await this.geo.getPosition();
      if (!gps) {
        await this.showPermissionDenied();
        return;
      }

      const wifi = await this.wifi.read();
      const [fingerprint, platform, deviceName, appVersion] = await Promise.all(
        [
          this.deviceSvc.getFingerprint(),
          this.deviceSvc.getPlatform(),
          this.deviceSvc.getDeviceName(),
          this.deviceSvc.getAppVersion(),
        ]
      );

      const body = {
        latitude: gps.lat,
        longitude: gps.lng,
        accuracy_meters: Math.round(gps.accuracyMeters),
        ssid: wifi?.ssid,
        bssid: wifi?.bssid ?? undefined,
        device_fingerprint: fingerprint,
        platform,
        device_name: deviceName,
        app_version: appVersion,
        is_mock_location: gps.isMock,
      };

      const resp =
        kind === 'in'
          ? await firstValueFrom(this.checkin.checkIn(body))
          : await firstValueFrom(this.checkin.checkOut(body));

      await Haptics.impact({ style: ImpactStyle.Light });
      this.lastResult.set({ ...resp.data, kind } as CheckinResult);
      await this.loadToday();
      await this.showResultDialog(this.lastResult()!);
    } catch (err) {
      const apiErr = err as {
        error?: {
          error?: {
            code?: string;
            message?: string;
            details?: Record<string, unknown>;
          };
        };
      };
      const details = apiErr.error?.error?.details as
        | {
            event_id?: string;
            trust_score?: number;
            risk_flags?: string[];
            distance_meters?: number;
          }
        | undefined;

      if (details?.risk_flags) {
        await this.showFailDialog(details.risk_flags, details.distance_meters);
      } else {
        await showErrorToast(this.toast, err);
      }
    } finally {
      this.submitting.set(false);
    }
  }

  private async showPermissionDenied() {
    const a = await this.alert.create({
      header: 'Cần quyền vị trí',
      message:
        'Ứng dụng cần quyền truy cập vị trí để chấm công tại chi nhánh. Vui lòng cấp quyền trong Cài đặt.',
      buttons: [{ text: 'Đã hiểu', role: 'cancel' }],
    });
    await a.present();
  }

  private async showResultDialog(result: CheckinResult) {
    const title =
      result.trust_level === 'trusted'
        ? 'Chấm công thành công'
        : result.trust_level === 'review'
        ? 'Thành công (cần xem xét)'
        : 'Không hợp lệ';
    const color =
      result.trust_level === 'trusted'
        ? 'success'
        : result.trust_level === 'review'
        ? 'warning'
        : 'danger';
    const time =
      result.kind === 'in'
        ? new Date((result as CheckInResponse).check_in_at).toLocaleTimeString(
            'vi-VN'
          )
        : new Date(
            (result as CheckOutResponse).check_out_at
          ).toLocaleTimeString('vi-VN');

    const a = await this.alert.create({
      header: title,
      subHeader: `Lúc ${time} — ${result.branch.name}`,
      message: `Điểm tin cậy: ${result.trust_score}/100 (${result.trust_level})`,
      cssClass: `alert-${color}`,
      buttons: [{ text: 'OK', role: 'cancel' }],
    });
    await a.present();
  }

  private async showFailDialog(flags: string[], distance?: number) {
    const primary = pickPrimaryFlag(flags);
    const primaryInfo = primary ? getRiskFlagInfo(primary) : null;

    const subHeader = primaryInfo?.label_vi;
    const primaryLine = primary
      ? flagMessage(primary, distance)
      : 'Vui lòng thử lại';
    const secondary = flags
      .filter((f) => f !== primary)
      .map((f) => '• ' + getRiskFlagInfo(f).label_vi);

    const message =
      primaryLine +
      (secondary.length > 0
        ? `<br><br><strong>Cờ khác:</strong><br>${secondary.join('<br>')}`
        : '');

    const a = await this.alert.create({
      header: 'Không thể chấm công',
      subHeader,
      message,
      buttons: [{ text: 'Đã hiểu', role: 'cancel' }],
    });
    await a.present();
    void errorMessage;
  }
}
