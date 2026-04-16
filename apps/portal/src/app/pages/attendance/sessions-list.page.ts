import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ModalController,
  ToastController,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonMenuButton,
  IonNote,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { alertCircleOutline, downloadOutline } from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { AttendanceApiService } from '../../core/attendance/attendance.api.service';
import { AuthService } from '../../core/auth/auth.service';
import { BranchesApiService } from '../../core/branches/branches.api.service';
import { showErrorToast } from '../../core/util/error-toast.util';
import { CreateExportDto } from '../../core/reports/reports.api.service';
import { ExportProgressModal } from './export-progress.modal';
import {
  ListSessionsQuery,
  Session,
  SessionStatus,
} from '../../shared/types/attendance-session.types';
import { Branch, PaginationMeta } from '../../shared/types/branch.types';

addIcons({
  'alert-circle-outline': alertCircleOutline,
  'download-outline': downloadOutline,
});

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDate(d);
}

@Component({
  selector: 'app-sessions-list',
  standalone: true,
  imports: [
    RouterLink,
    DatePipe,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonMenuButton,
    IonSearchbar,
    IonSelect,
    IonSelectOption,
    IonList,
    IonItem,
    IonLabel,
    IonNote,
    IonChip,
    IonButton,
    IonIcon,
    IonSpinner,
    IonText,
  ],
  templateUrl: './sessions-list.page.html',
})
export class SessionsListPage {
  private readonly api = inject(AttendanceApiService);
  private readonly branchesApi = inject(BranchesApiService);
  private readonly auth = inject(AuthService);
  private readonly toastCtrl = inject(ToastController);
  private readonly modalCtrl = inject(ModalController);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly sessions = signal<Session[]>([]);
  readonly meta = signal<PaginationMeta | null>(null);
  readonly branches = signal<Branch[]>([]);
  readonly loading = signal(false);
  readonly query = signal<ListSessionsQuery>({
    page: 1,
    limit: 20,
    date_from: daysAgo(7),
    date_to: daysAgo(0),
  });

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
      employee_id: params.get('employee_id') || undefined,
      date_from: params.get('date_from') || daysAgo(7),
      date_to: params.get('date_to') || daysAgo(0),
      status: (params.get('status') as SessionStatus) || undefined,
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
    const q = this.query();
    if (q.date_from && q.date_to && q.date_from > q.date_to) {
      await showErrorToast(this.toastCtrl, {
        error: { error: { message: 'Ngày bắt đầu phải trước ngày kết thúc' } },
      });
      return;
    }
    this.loading.set(true);
    try {
      const resp = await firstValueFrom(this.api.list(q));
      this.sessions.set(resp.data);
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
        employee_id: q.employee_id || null,
        date_from: q.date_from || null,
        date_to: q.date_to || null,
        status: q.status || null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  quickFilter(days: number) {
    this.query.update((q) => ({
      ...q,
      page: 1,
      date_from: days === 0 ? daysAgo(0) : daysAgo(days),
      date_to: daysAgo(0),
    }));
    this.syncUrl();
    this.reload();
  }

  onDateFrom(event: Event) {
    const v = (event.target as HTMLInputElement).value;
    this.query.update((q) => ({ ...q, page: 1, date_from: v || undefined }));
    this.syncUrl();
    this.reload();
  }

  onDateTo(event: Event) {
    const v = (event.target as HTMLInputElement).value;
    this.query.update((q) => ({ ...q, page: 1, date_to: v || undefined }));
    this.syncUrl();
    this.reload();
  }

  onBranchChange(event: Event) {
    const v = (event as CustomEvent<{ value: string | null }>).detail.value;
    this.query.update((q) => ({ ...q, page: 1, branch_id: v || undefined }));
    this.syncUrl();
    this.reload();
  }

  onStatusChange(event: Event) {
    const v = (event as CustomEvent<{ value: string | null }>).detail.value;
    this.query.update((q) => ({
      ...q,
      page: 1,
      status: (v as SessionStatus) || undefined,
    }));
    this.syncUrl();
    this.reload();
  }

  onEmployeeSearch(event: Event) {
    // Note: BE employee_id expects UUID, not free search — skip for now, use filter from list
    void event;
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

  trustColor(score: number | null): string {
    if (score === null) return 'medium';
    if (score >= 70) return 'success';
    if (score >= 40) return 'warning';
    return 'danger';
  }

  async openExportModal(): Promise<void> {
    const q = this.query();
    if (!q.date_from || !q.date_to) {
      await showErrorToast(this.toastCtrl, {
        error: { error: { message: 'Vui lòng chọn khoảng ngày' } },
      });
      return;
    }
    if (this.isManagerOnly() && !q.branch_id) {
      await showErrorToast(this.toastCtrl, {
        error: {
          error: { message: 'Vui lòng chọn chi nhánh để xuất báo cáo' },
        },
      });
      return;
    }
    const dto: CreateExportDto = {
      type: 'attendance_csv',
      branch_id: q.branch_id,
      date_from: q.date_from,
      date_to: q.date_to,
    };
    const modal = await this.modalCtrl.create({
      component: ExportProgressModal,
      componentProps: { dto },
      backdropDismiss: false,
    });
    await modal.present();
  }

  statusColor(status: SessionStatus): string {
    switch (status) {
      case 'on_time':
        return 'success';
      case 'late':
      case 'early_leave':
        return 'warning';
      case 'absent':
      case 'missing_checkout':
        return 'danger';
      default:
        return 'medium';
    }
  }
}
