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
  IonInput,
  IonItem,
  IonSpinner,
  IonIcon,
  IonContent,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  fingerPrintOutline,
  mailOutline,
  lockClosedOutline,
  arrowForwardOutline,
} from 'ionicons/icons';
import { AuthService } from '../../core/auth/auth.service';
import { showErrorToast } from '../../core/util/error-toast.util';

addIcons({
  'finger-print-outline': fingerPrintOutline,
  'mail-outline': mailOutline,
  'lock-closed-outline': lockClosedOutline,
  'arrow-forward-outline': arrowForwardOutline,
});

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    IonContent,
    ReactiveFormsModule,
    IonContent,
    IonItem,
    IonInput,
    IonButton,
    IonSpinner,
    IonIcon,
  ],
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
    } catch (err) {
      await showErrorToast(this.toast, err);
    } finally {
      this.loading.set(false);
    }
  }
}
