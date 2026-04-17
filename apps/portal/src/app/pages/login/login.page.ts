import { Component, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ToastController } from '@ionic/angular/standalone';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastController);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly form: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  async onSubmit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    try {
      await this.auth.login(this.form.value.email, this.form.value.password);
    } catch (err: unknown) {
      const msg = this.toVietnameseError(err);
      const t = await this.toast.create({
        message: msg,
        duration: 3000,
        color: 'danger',
        position: 'top',
      });
      await t.present();
    } finally {
      this.loading.set(false);
    }
  }

  private toVietnameseError(err: unknown): string {
    const code = (err as { error?: { error?: { code?: string } } })?.error
      ?.error?.code;
    switch (code) {
      case 'INVALID_CREDENTIALS':
        return 'Sai email hoặc mật khẩu';
      case 'ACCOUNT_INACTIVE':
        return 'Tài khoản đã bị khóa';
      case 'TOO_MANY_ATTEMPTS':
        return 'Quá nhiều lần thử, vui lòng chờ 1 phút';
      default:
        return 'Lỗi hệ thống, vui lòng thử lại';
    }
  }
}
