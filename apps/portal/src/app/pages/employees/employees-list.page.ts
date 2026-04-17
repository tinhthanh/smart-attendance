import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ModalController,
  ToastController,
  IonIcon,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline, searchOutline } from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { BranchesApiService } from '../../core/branches/branches.api.service';
import { EmployeesApiService } from '../../core/employees/employees.api.service';
import {
  showErrorToast,
  showSuccessToast,
} from '../../core/util/error-toast.util';
import { Branch, PaginationMeta } from '../../shared/types/branch.types';
import {
  Employee,
  ListEmployeesQuery,
} from '../../shared/types/employee.types';
import { EmployeeFormModal } from './employee-form.modal';

addIcons({ 'add-outline': addOutline, 'search-outline': searchOutline });

@Component({
  selector: 'app-employees-list',
  standalone: true,
  imports: [RouterLink, IonIcon],
  templateUrl: './employees-list.page.html',
  styleUrl: './employees-list.page.scss',
})
export class EmployeesListPage {
  private readonly api = inject(EmployeesApiService);
  private readonly branchesApi = inject(BranchesApiService);
  private readonly auth = inject(AuthService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toastCtrl = inject(ToastController);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly employees = signal<Employee[]>([]);
  readonly meta = signal<PaginationMeta | null>(null);
  readonly branches = signal<Branch[]>([]);
  readonly loading = signal(false);
  readonly query = signal<ListEmployeesQuery>({ page: 1, limit: 20 });
  readonly isAdmin = computed(
    () => this.auth.currentUser()?.roles.includes('admin') ?? false
  );
  readonly isManagerOnly = computed(
    () =>
      !this.isAdmin() &&
      (this.auth.currentUser()?.roles.includes('manager') ?? false)
  );

  constructor() {
    const params = this.route.snapshot.queryParamMap;
    this.query.set({
      page: Number(params.get('page') ?? 1),
      limit: 20,
      branch_id: params.get('branch_id') || undefined,
      status:
        (params.get('status') as 'active' | 'on_leave' | 'terminated') ||
        undefined,
      search: params.get('search') || undefined,
    });
    this.loadBranches();
    this.reload();
  }

  async loadBranches() {
    try {
      const resp = await firstValueFrom(this.branchesApi.list({ limit: 100 }));
      this.branches.set(resp.data);
    } catch {
      // non-critical
    }
  }

  async reload() {
    this.loading.set(true);
    try {
      const resp = await firstValueFrom(this.api.list(this.query()));
      this.employees.set(resp.data);
      this.meta.set(resp.meta);
    } catch (err) {
      await showErrorToast(this.toastCtrl, err);
    } finally {
      this.loading.set(false);
    }
  }

  private syncUrl() {
    const q = this.query();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        page: q.page === 1 ? null : q.page,
        branch_id: q.branch_id || null,
        status: q.status || null,
        search: q.search || null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  onSearch(event: Event) {
    const v = (event.target as HTMLInputElement).value || '';
    this.query.update((q) => ({ ...q, page: 1, search: v || undefined }));
    this.syncUrl();
    this.reload();
  }

  onBranchChange(event: Event) {
    const v = (event.target as HTMLSelectElement).value;
    this.query.update((q) => ({ ...q, page: 1, branch_id: v || undefined }));
    this.syncUrl();
    this.reload();
  }

  onStatusChange(event: Event) {
    const v = (event.target as HTMLSelectElement).value;
    this.query.update((q) => ({
      ...q,
      page: 1,
      status: (v as 'active' | 'on_leave' | 'terminated') || undefined,
    }));
    this.syncUrl();
    this.reload();
  }

  prevPage() {
    if ((this.query().page ?? 1) <= 1) return;
    this.query.update((q) => ({ ...q, page: (q.page ?? 1) - 1 }));
    this.syncUrl();
    this.reload();
  }

  nextPage() {
    const m = this.meta();
    if (!m || (this.query().page ?? 1) >= m.total_pages) return;
    this.query.update((q) => ({ ...q, page: (q.page ?? 1) + 1 }));
    this.syncUrl();
    this.reload();
  }

  async openCreate() {
    const modal = await this.modalCtrl.create({
      component: EmployeeFormModal,
      componentProps: { employee: null, branches: this.branches() },
    });
    await modal.present();
    const { data } = await modal.onDidDismiss<{ created: true } | undefined>();
    if (data?.created) {
      await showSuccessToast(this.toastCtrl, 'Đã tạo nhân viên');
      await this.reload();
    }
  }
}
