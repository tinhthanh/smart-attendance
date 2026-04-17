import { Component, computed, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ModalController,
  ToastController,
  IonIcon,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  pencilOutline,
  phonePortraitOutline,
} from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { BranchesApiService } from '../../core/branches/branches.api.service';
import { EmployeesApiService } from '../../core/employees/employees.api.service';
import {
  showErrorToast,
  showSuccessToast,
} from '../../core/util/error-toast.util';
import { Branch } from '../../shared/types/branch.types';
import { Employee, EmployeeDevice } from '../../shared/types/employee.types';
import { EmployeeFormModal } from './employee-form.modal';

addIcons({
  'arrow-back-outline': arrowBackOutline,
  'pencil-outline': pencilOutline,
  'phone-portrait-outline': phonePortraitOutline,
});

@Component({
  selector: 'app-employee-detail',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, IonIcon],
  templateUrl: './employee-detail.page.html',
  styleUrl: './employee-detail.page.scss',
})
export class EmployeeDetailPage {
  private readonly api = inject(EmployeesApiService);
  private readonly branchesApi = inject(BranchesApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly modalCtrl = inject(ModalController);
  private readonly toastCtrl = inject(ToastController);
  private readonly fb = inject(FormBuilder);

  readonly employee = signal<Employee | null>(null);
  readonly devices = signal<EmployeeDevice[]>([]);
  readonly branches = signal<Branch[]>([]);
  readonly activeTab = signal<'info' | 'assignments' | 'devices'>('info');
  readonly loading = signal(false);
  readonly isAdmin = computed(
    () => this.auth.currentUser()?.roles.includes('admin') ?? false
  );

  readonly assignmentForm: FormGroup = this.fb.group({
    branch_id: ['', [Validators.required]],
    assignment_type: ['secondary', [Validators.required]],
    effective_from: ['', [Validators.required]],
    effective_to: [''],
  });

  private employeeId = '';

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.employeeId = id;
    await Promise.all([
      this.loadEmployee(),
      this.loadDevices(),
      this.loadBranches(),
    ]);
  }

  async loadEmployee() {
    this.loading.set(true);
    try {
      const resp = await firstValueFrom(this.api.get(this.employeeId));
      this.employee.set(resp.data);
    } catch (err) {
      await showErrorToast(this.toastCtrl, err);
      await this.router.navigate(['/employees']);
    } finally {
      this.loading.set(false);
    }
  }

  async loadDevices() {
    try {
      const resp = await firstValueFrom(this.api.listDevices(this.employeeId));
      this.devices.set(resp.data);
    } catch {
      this.devices.set([]);
    }
  }

  async loadBranches() {
    try {
      const resp = await firstValueFrom(this.branchesApi.list({ limit: 100 }));
      this.branches.set(resp.data);
    } catch {
      // non-critical
    }
  }

  // Removed unused onTabChange since we use inline .set() in HTML

  async openEdit() {
    const e = this.employee();
    if (!e) return;
    const modal = await this.modalCtrl.create({
      component: EmployeeFormModal,
      componentProps: { employee: e, branches: this.branches() },
    });
    await modal.present();
    const { data } = await modal.onDidDismiss<{ updated: true } | undefined>();
    if (data?.updated) {
      await showSuccessToast(this.toastCtrl, 'Đã cập nhật');
      await this.loadEmployee();
    }
  }

  async addAssignment() {
    if (this.assignmentForm.invalid) return;
    try {
      const raw = this.assignmentForm.value;
      await firstValueFrom(
        this.api.createAssignment(this.employeeId, {
          branch_id: raw.branch_id,
          assignment_type: raw.assignment_type,
          effective_from: raw.effective_from,
          effective_to: raw.effective_to || undefined,
        })
      );
      await showSuccessToast(this.toastCtrl, 'Đã thêm phân công');
      this.assignmentForm.reset({ assignment_type: 'secondary' });
    } catch (err) {
      await showErrorToast(this.toastCtrl, err);
    }
  }

  async toggleDeviceTrust(device: EmployeeDevice) {
    try {
      await firstValueFrom(
        this.api.updateDevice(this.employeeId, device.id, !device.is_trusted)
      );
      await showSuccessToast(this.toastCtrl, 'Đã cập nhật thiết bị');
      await this.loadDevices();
    } catch (err) {
      await showErrorToast(this.toastCtrl, err);
    }
  }
}
