import { Component, computed, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  AlertController,
  ModalController,
  ToastController,
  IonIcon,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  createOutline,
  wifiOutline,
  trashOutline,
  mapOutline,
  closeOutline,
} from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { BranchesApiService } from '../../core/branches/branches.api.service';
import {
  showErrorToast,
  showSuccessToast,
} from '../../core/util/error-toast.util';
import {
  BranchDetail,
  Geofence,
  WifiConfig,
} from '../../shared/types/branch.types';
import { BranchFormModal } from './branch-form.modal';

addIcons({
  'close-outline': closeOutline,
  'create-outline': createOutline,
  'arrow-back-outline': arrowBackOutline,
  'wifi-outline': wifiOutline,
  'trash-outline': trashOutline,
  'map-outline': mapOutline,
});

@Component({
  selector: 'app-branch-detail',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, IonIcon],
  templateUrl: './branch-detail.page.html',
  styleUrl: './branch-detail.page.scss',
})
export class BranchDetailPage {
  private readonly api = inject(BranchesApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly fb = inject(FormBuilder);

  readonly branch = signal<BranchDetail | null>(null);
  readonly wifiConfigs = signal<WifiConfig[]>([]);
  readonly geofences = signal<Geofence[]>([]);
  readonly activeTab = signal<'info' | 'wifi' | 'geofence'>('info');
  readonly loading = signal(false);
  readonly isAdmin = computed(
    () => this.auth.currentUser()?.roles.includes('admin') ?? false
  );

  readonly wifiForm: FormGroup = this.fb.group({
    ssid: ['', Validators.required],
    bssid: ['', [Validators.pattern(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/)]],
    priority: [0, [Validators.min(0), Validators.max(100)]],
  });

  readonly geofenceForm: FormGroup = this.fb.group({
    name: ['', Validators.required],
    center_lat: [
      0,
      [Validators.required, Validators.min(-90), Validators.max(90)],
    ],
    center_lng: [
      0,
      [Validators.required, Validators.min(-180), Validators.max(180)],
    ],
    radius_meters: [
      100,
      [Validators.required, Validators.min(10), Validators.max(2000)],
    ],
  });

  private branchId = '';

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.branchId = id;
    await this.loadBranch();
  }

  async loadBranch() {
    this.loading.set(true);
    try {
      const resp = await firstValueFrom(this.api.get(this.branchId));
      this.branch.set(resp.data);
      this.wifiConfigs.set(resp.data.wifi_configs ?? []);
      this.geofences.set(resp.data.geofences ?? []);
      // Copy from branch helper
      this.geofenceForm.patchValue({
        center_lat: resp.data.latitude,
        center_lng: resp.data.longitude,
      });
    } catch (err) {
      await showErrorToast(this.toastCtrl, err);
      await this.router.navigate(['/branches']);
    } finally {
      this.loading.set(false);
    }
  }

  // Removed unused onTabChange since we use inline signal setting

  async openEdit() {
    const b = this.branch();
    if (!b) return;
    const modal = await this.modalCtrl.create({
      component: BranchFormModal,
      componentProps: { branch: b },
    });
    await modal.present();
    const { data } = await modal.onDidDismiss<{ updated: true } | undefined>();
    if (data?.updated) {
      await showSuccessToast(this.toastCtrl, 'Đã cập nhật');
      await this.loadBranch();
    }
  }

  async addWifi() {
    if (this.wifiForm.invalid) return;
    try {
      await firstValueFrom(
        this.api.createWifi(this.branchId, this.wifiForm.value)
      );
      await showSuccessToast(this.toastCtrl, 'Đã thêm WiFi');
      this.wifiForm.reset({ priority: 0 });
      await this.loadBranch();
    } catch (err) {
      await showErrorToast(this.toastCtrl, err);
    }
  }

  async removeWifi(config: WifiConfig) {
    const alert = await this.alertCtrl.create({
      header: 'Xóa WiFi?',
      message: `Xóa cấu hình ${config.ssid}?`,
      buttons: [
        { text: 'Hủy', role: 'cancel' },
        {
          text: 'Xóa',
          role: 'destructive',
          handler: () => {
            void this.doRemoveWifi(config.id);
          },
        },
      ],
    });
    await alert.present();
  }

  private async doRemoveWifi(configId: string) {
    try {
      await firstValueFrom(this.api.deleteWifi(this.branchId, configId));
      await showSuccessToast(this.toastCtrl, 'Đã xóa WiFi');
      await this.loadBranch();
    } catch (err) {
      await showErrorToast(this.toastCtrl, err);
    }
  }

  async addGeofence() {
    if (this.geofenceForm.invalid) return;
    try {
      await firstValueFrom(
        this.api.createGeofence(this.branchId, this.geofenceForm.value)
      );
      await showSuccessToast(this.toastCtrl, 'Đã thêm geofence');
      this.geofenceForm.reset({
        center_lat: this.branch()?.latitude ?? 0,
        center_lng: this.branch()?.longitude ?? 0,
        radius_meters: 100,
      });
      await this.loadBranch();
    } catch (err) {
      await showErrorToast(this.toastCtrl, err);
    }
  }
}
