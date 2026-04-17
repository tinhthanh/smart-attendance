import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';

import { NgApexchartsModule } from 'ng-apexcharts';
import { firstValueFrom } from 'rxjs';
import { DashboardApiService } from '../../core/dashboard/dashboard.api.service';
import { RiskFlagChipComponent } from '../../shared/components/risk-flag-chip.component';
import { BranchDashboard } from '../../shared/types/dashboard.types';

@Component({
  selector: 'app-branch-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    NgApexchartsModule,
    RiskFlagChipComponent,
  ],
  templateUrl: './branch-dashboard.page.html',
  styleUrl: './branch-dashboard.page.scss',
})
export class BranchDashboardPage {
  private readonly api = inject(DashboardApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly data = signal<BranchDashboard | null>(null);
  readonly loading = signal(false);
  private branchId = '';

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.branchId = id;
    await this.load();
  }

  async load() {
    this.loading.set(true);
    try {
      const resp = await firstValueFrom(
        this.api.getManagerBranch(this.branchId)
      );
      this.data.set(resp.data);
    } catch (err) {
      console.error(err);
      await this.router.navigate(['/dashboard']);
    } finally {
      this.loading.set(false);
    }
  }

  weekTrendChart() {
    const d = this.data();
    if (!d) return null;
    return {
      series: [
        {
          name: 'Tỷ lệ đúng giờ',
          data: d.week_trend.map((w) => Math.round(w.on_time_rate * 100)),
        },
      ],
      chart: { type: 'line' as const, height: 250, toolbar: { show: false } },
      xaxis: { categories: d.week_trend.map((w) => w.date) },
      yaxis: { min: 0, max: 100 },
      stroke: { curve: 'smooth' as const, width: 3 },
      colors: ['#10b981'],
      title: { text: '' },
    };
  }
}
