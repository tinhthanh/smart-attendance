import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  AlertController,
  ModalController,
  ToastController,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
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
import { addOutline, pencilOutline, trashOutline } from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { BranchesApiService } from '../../core/branches/branches.api.service';
import {
  showErrorToast,
  showSuccessToast,
} from '../../core/util/error-toast.util';
import {
  Branch,
  ListBranchesQuery,
  PaginationMeta,
} from '../../shared/types/branch.types';
import { BranchFormModal } from './branch-form.modal';

addIcons({
  'add-outline': addOutline,
  'pencil-outline': pencilOutline,
  'trash-outline': trashOutline,
});

@Component({
  selector: 'app-branches-list',
  standalone: true,
  imports: [
    RouterLink,
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
    IonItemSliding,
    IonItemOptions,
    IonItemOption,
    IonLabel,
    IonNote,
    IonChip,
    IonButton,
    IonIcon,
    IonFab,
    IonFabButton,
    IonSpinner,
    IonText,
  ],
  templateUrl: './branches-list.page.html',
})
export class BranchesListPage {
  private readonly api = inject(BranchesApiService);
  private readonly auth = inject(AuthService);
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly branches = signal<Branch[]>([]);
  readonly meta = signal<PaginationMeta | null>(null);
  readonly loading = signal(false);
  readonly query = signal<ListBranchesQuery>({ page: 1, limit: 20 });
  readonly isAdmin = computed(
    () => this.auth.currentUser()?.roles.includes('admin') ?? false
  );
  readonly isManagerOnly = computed(
    () =>
      !this.isAdmin() &&
      (this.auth.currentUser()?.roles.includes('manager') ?? false)
  );

  constructor() {
    // Read initial query from URL
    const params = this.route.snapshot.queryParamMap;
    this.query.set({
      page: Number(params.get('page') ?? 1),
      limit: 20,
      status: (params.get('status') as 'active' | 'inactive') || undefined,
      search: params.get('search') || undefined,
    });
    this.reload();
  }

  async reload() {
    this.loading.set(true);
    try {
      const resp = await firstValueFrom(this.api.list(this.query()));
      this.branches.set(resp.data);
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
        status: q.status || null,
        search: q.search || null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  onSearch(event: Event) {
    const v = (event as CustomEvent<{ value: string }>).detail.value || '';
    this.query.update((q) => ({ ...q, page: 1, search: v || undefined }));
    this.syncUrl();
    this.reload();
  }

  onStatusChange(event: Event) {
    const v = (event as CustomEvent<{ value: string | null }>).detail.value;
    this.query.update((q) => ({
      ...q,
      page: 1,
      status: (v as 'active' | 'inactive') || undefined,
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
      component: BranchFormModal,
      componentProps: { branch: null },
    });
    await modal.present();
    const { data } = await modal.onDidDismiss<{ created: true } | undefined>();
    if (data?.created) {
      await showSuccessToast(this.toastCtrl, 'Đã tạo chi nhánh');
      await this.reload();
    }
  }

  async openEdit(branch: Branch, slidingEl: IonItemSliding) {
    await slidingEl.close();
    const modal = await this.modalCtrl.create({
      component: BranchFormModal,
      componentProps: { branch },
    });
    await modal.present();
    const { data } = await modal.onDidDismiss<{ updated: true } | undefined>();
    if (data?.updated) {
      await showSuccessToast(this.toastCtrl, 'Đã cập nhật chi nhánh');
      await this.reload();
    }
  }

  async confirmDelete(branch: Branch, slidingEl: IonItemSliding) {
    await slidingEl.close();
    const alert = await this.alertCtrl.create({
      header: 'Xác nhận xóa',
      message: `Xóa chi nhánh ${branch.code} — ${branch.name}?`,
      buttons: [
        { text: 'Hủy', role: 'cancel' },
        {
          text: 'Xóa',
          role: 'destructive',
          handler: () => {
            void this.doDelete(branch.id);
          },
        },
      ],
    });
    await alert.present();
  }

  private async doDelete(id: string) {
    try {
      await firstValueFrom(this.api.remove(id));
      await showSuccessToast(this.toastCtrl, 'Đã xóa chi nhánh');
      await this.reload();
    } catch (err) {
      await showErrorToast(this.toastCtrl, err);
    }
  }
}
