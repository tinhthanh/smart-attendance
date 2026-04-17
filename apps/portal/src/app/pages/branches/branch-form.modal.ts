import { Component, Input, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  ModalController,
  ToastController,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { BranchesApiService } from '../../core/branches/branches.api.service';
import { showErrorToast } from '../../core/util/error-toast.util';
import { BranchDetail } from '../../shared/types/branch.types';

@Component({
  selector: 'app-branch-form-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonItem,
    IonInput,
    IonSpinner,
  ],
  templateUrl: './branch-form.modal.html',
})
export class BranchFormModal {
  @Input() branch: BranchDetail | null = null;

  private readonly api = inject(BranchesApiService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toastCtrl = inject(ToastController);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly form: FormGroup = this.fb.group({
    code: [
      '',
      [
        Validators.required,
        Validators.pattern(/^[A-Z0-9-]+$/),
        Validators.minLength(3),
      ],
    ],
    name: ['', [Validators.required, Validators.minLength(1)]],
    address: [''],
    latitude: [
      0,
      [Validators.required, Validators.min(-90), Validators.max(90)],
    ],
    longitude: [
      0,
      [Validators.required, Validators.min(-180), Validators.max(180)],
    ],
    radius_meters: [150, [Validators.min(50), Validators.max(1000)]],
    timezone: ['Asia/Ho_Chi_Minh'],
  });

  get isEdit(): boolean {
    return this.branch !== null;
  }

  ngOnInit() {
    if (this.branch) {
      this.form.patchValue({
        code: this.branch.code,
        name: this.branch.name,
        address: this.branch.address ?? '',
        latitude: this.branch.latitude,
        longitude: this.branch.longitude,
        radius_meters: this.branch.radius_meters,
        timezone: this.branch.timezone,
      });
      // Prevent editing code in edit mode
      this.form.get('code')?.disable();
    }
  }

  async onSubmit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    try {
      const raw = this.form.getRawValue();
      if (this.isEdit && this.branch) {
        const { code: _ignore, ...updateData } = raw;
        void _ignore;
        await firstValueFrom(this.api.update(this.branch.id, updateData));
        await this.modalCtrl.dismiss({ updated: true });
      } else {
        await firstValueFrom(this.api.create(raw));
        await this.modalCtrl.dismiss({ created: true });
      }
    } catch (err) {
      await showErrorToast(this.toastCtrl, err);
    } finally {
      this.loading.set(false);
    }
  }

  async onCancel() {
    await this.modalCtrl.dismiss();
  }
}
