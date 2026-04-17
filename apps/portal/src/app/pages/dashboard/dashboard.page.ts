import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  ToastController,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonChip,
  IonContent,
  IonGrid,
  IonHeader,
  IonLabel,
  IonMenuButton,
  IonRow,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { NgApexchartsModule } from 'ng-apexcharts';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { BranchesApiService } from '../../core/branches/branches.api.service';
import { DashboardApiService } from '../../core/dashboard/dashboard.api.service';
import { getFirstManagerBranchId } from '../../core/dashboard/scope.util';
import { showErrorToast } from '../../core/util/error-toast.util';
import { AdminOverview } from '../../shared/types/dashboard.types';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    NgApexchartsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonMenuButton,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonGrid,
    IonRow,
    IonChip,
    IonLabel,
    IonText,
    IonSpinner,
  ],
  templateUrl: './dashboard.page.html',
})
export class DashboardPage {
  private readonly api = inject(DashboardApiService);
  private readonly branchesApi = inject(BranchesApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastController);
  private readonly router = inject(Router);

  readonly overview = signal<AdminOverview | null>(null);
  readonly loading = signal(false);
  readonly isAdmin = computed(
    () => this.auth.currentUser()?.roles.includes('admin') ?? false
  );
  readonly isManager = computed(
    () => this.auth.currentUser()?.roles.includes('manager') ?? false
  );

  async ngOnInit() {
    if (this.isAdmin()) {
      await this.loadOverview();
    } else if (this.isManager()) {
      const branchId = await getFirstManagerBranchId(this.branchesApi);
      if (branchId) {
        await this.router.navigate(['/dashboard/branch', branchId]);
      }
    }
  }

  async loadOverview() {
    this.loading.set(true);
    try {
      const resp = await firstValueFrom(this.api.getAdminOverview());
      this.overview.set(resp.data);
    } catch (err) {
      await showErrorToast(this.toast, err);
    } finally {
      this.loading.set(false);
    }
  }

  topOnTimeChart() {
    const o = this.overview();
    if (!o) return null;
    return {
      series: [
        {
          name: 'On-time rate',
          data: o.top_branches_on_time.map((b) => Math.round(b.rate * 100)),
        },
      ],
      chart: { type: 'bar' as const, height: 250, toolbar: { show: false } },
      plotOptions: { bar: { horizontal: true } },
      xaxis: {
        categories: o.top_branches_on_time.map((b) => b.name),
        max: 100,
      },
      colors: ['#2dd36f'],
      title: { text: 'Top 5 chi nhánh đúng giờ (%)' },
    };
  }

  topLateChart() {
    const o = this.overview();
    if (!o) return null;
    return {
      series: [
        {
          name: 'Late count',
          data: o.top_branches_late.map((b) => b.late_count),
        },
      ],
      chart: { type: 'bar' as const, height: 250, toolbar: { show: false } },
      plotOptions: { bar: { horizontal: true } },
      xaxis: { categories: o.top_branches_late.map((b) => b.name) },
      colors: ['#ffc409'],
      title: { text: 'Top 5 chi nhánh đi trễ' },
    };
  }

  heatmapChart() {
    const o = this.overview();
    if (!o) return null;
    const map = new Map(o.checkin_heatmap.map((h) => [h.hour, h.count]));
    const data = Array.from({ length: 24 }, (_, h) => ({
      x: String(h).padStart(2, '0'),
      y: map.get(h) ?? 0,
    }));
    return {
      series: [{ name: 'Check-in', data }],
      chart: {
        type: 'heatmap' as const,
        height: 180,
        toolbar: { show: false },
      },
      colors: ['#3880ff'],
      title: { text: 'Phân bố check-in theo giờ' },
      dataLabels: { enabled: false },
    };
  }
}
