import { Component, Input, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ModalController, ToastController } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { AttendanceApiService } from '../../core/attendance/attendance.api.service';
import { showErrorToast } from '../../core/util/error-toast.util';
import {
  OVERRIDE_STATUS_OPTIONS,
  SessionStatus,
} from '../../shared/types/attendance-session.types';
import { formatAttendanceStatus } from '@smart-attendance/shared/constants';



@Component({
  selector: 'app-override-session-modal',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './override-session.modal.html',
  styleUrls: ['./override-session.modal.scss'],
})
export class OverrideSessionModal {
  @Input() sessionId = '';
  @Input() currentStatus: SessionStatus = 'on_time';

  formatStatus = formatAttendanceStatus;

  private readonly api = inject(AttendanceApiService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toastCtrl = inject(ToastController);
  private readonly fb = inject(FormBuilder);

  readonly options = OVERRIDE_STATUS_OPTIONS;
  readonly loading = signal(false);
  readonly form: FormGroup = this.fb.group({
    status: ['', Validators.required],
    note: [
      '',
      [
        Validators.required,
        Validators.minLength(10),
        Validators.maxLength(500),
      ],
    ],
  });

  get charCount(): number {
    return (this.form.get('note')?.value || '').length;
  }

  async onSubmit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    try {
      await firstValueFrom(
        this.api.override(this.sessionId, {
          status: this.form.value.status,
          note: this.form.value.note,
        })
      );
      await this.modalCtrl.dismiss({ updated: true });
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
