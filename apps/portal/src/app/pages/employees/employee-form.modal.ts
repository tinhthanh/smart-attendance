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
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { EmployeesApiService } from '../../core/employees/employees.api.service';
import { showErrorToast } from '../../core/util/error-toast.util';
import { Branch } from '../../shared/types/branch.types';
import { Employee } from '../../shared/types/employee.types';

@Component({
  selector: 'app-employee-form-modal',
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
    IonSelect,
    IonSelectOption,
    IonSpinner,
  ],
  templateUrl: './employee-form.modal.html',
})
export class EmployeeFormModal {
  @Input() employee: Employee | null = null;
  @Input() branches: Branch[] = [];

  private readonly api = inject(EmployeesApiService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toastCtrl = inject(ToastController);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly form: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    full_name: ['', [Validators.required]],
    phone: [''],
    employee_code: [
      '',
      [Validators.required, Validators.pattern(/^[A-Z0-9-]+$/)],
    ],
    primary_branch_id: ['', [Validators.required]],
    role: ['employee', [Validators.required]],
  });

  get isEdit(): boolean {
    return this.employee !== null;
  }

  ngOnInit() {
    if (this.employee) {
      this.form.patchValue({
        email: this.employee.user.email,
        full_name: this.employee.user.full_name,
        phone: this.employee.user.phone ?? '',
        employee_code: this.employee.employee_code,
        primary_branch_id: this.employee.primary_branch?.id ?? '',
      });
      this.form.get('email')?.disable();
      this.form.get('password')?.disable();
      this.form.get('employee_code')?.disable();
      this.form.get('role')?.disable();
    }
  }

  async onSubmit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    try {
      if (this.isEdit && this.employee) {
        const raw = this.form.getRawValue();
        await firstValueFrom(
          this.api.update(this.employee.id, {
            full_name: raw.full_name,
            phone: raw.phone || undefined,
            primary_branch_id: raw.primary_branch_id,
          })
        );
        await this.modalCtrl.dismiss({ updated: true });
      } else {
        await firstValueFrom(this.api.create(this.form.value));
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
