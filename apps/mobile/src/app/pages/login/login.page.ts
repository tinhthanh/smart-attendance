import { Component, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  ToastController,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonInput,
  IonItem,
  IonSpinner,
} from '@ionic/angular/standalone';
import { AuthService } from '../../core/auth/auth.service';
import { showErrorToast } from '../../core/util/error-toast.util';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonItem,
    IonInput,
    IonButton,
    IonSpinner,
  ],
  template: `
    <ion-content class="ion-padding">
      <div class="login-container">
        <ion-card>
          <ion-card-header>
            <ion-card-title>Smart Attendance</ion-card-title>
            <ion-card-subtitle>Đăng nhập nhân viên</ion-card-subtitle>
          </ion-card-header>
          <ion-card-content>
            <form [formGroup]="form" (ngSubmit)="onSubmit()">
              <ion-item>
                <ion-input
                  label="Email"
                  labelPlacement="floating"
                  type="email"
                  formControlName="email"
                ></ion-input>
              </ion-item>
              <ion-item>
                <ion-input
                  label="Mật khẩu"
                  labelPlacement="floating"
                  type="password"
                  formControlName="password"
                ></ion-input>
              </ion-item>
              <br />
              <ion-button
                expand="block"
                type="submit"
                [disabled]="form.invalid || loading()"
              >
                @if (loading()) {
                <ion-spinner name="crescent"></ion-spinner>
                } @else { Đăng nhập }
              </ion-button>
            </form>
          </ion-card-content>
        </ion-card>
      </div>
    </ion-content>
  `,
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
    } catch (err) {
      await showErrorToast(this.toast, err);
    } finally {
      this.loading.set(false);
    }
  }
}
