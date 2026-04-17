import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular/standalone';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import * as echarts from 'echarts/core';
import { BarChart, PieChart, GaugeChart, LineChart, HeatmapChart } from 'echarts/charts';
import {
  TitleComponent, TooltipComponent, GridComponent, LegendComponent,
  VisualMapComponent, CalendarComponent
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { BranchesApiService } from '../../core/branches/branches.api.service';
import { DashboardApiService } from '../../core/dashboard/dashboard.api.service';
import { getFirstManagerBranchId } from '../../core/dashboard/scope.util';
import { showErrorToast } from '../../core/util/error-toast.util';
import { AdminOverview } from '../../shared/types/dashboard.types';
import { SaIconComponent } from '../../shared/components/sa-icon.component';

echarts.use([
  BarChart, PieChart, GaugeChart, LineChart, HeatmapChart,
  TitleComponent, TooltipComponent, GridComponent, LegendComponent,
  VisualMapComponent, CalendarComponent, CanvasRenderer,
]);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, NgxEchartsDirective, SaIconComponent],
  providers: [provideEchartsCore({ echarts })],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
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

  onTimeRateGauge(): Record<string, unknown> {
    const o = this.overview();
    if (!o) return {};
    const rate = Math.round(o.today.on_time_rate * 100);
    return {
      series: [{
        type: 'gauge',
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: 100,
        progress: { show: true, width: 20, itemStyle: { color: '#16a34a' } },
        pointer: { show: false },
        axisLine: { lineStyle: { width: 20, color: [[1, '#e5e7eb']] } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        detail: {
          valueAnimation: true,
          fontSize: 36,
          fontWeight: 800,
          offsetCenter: [0, '10%'],
          formatter: '{value}%',
          color: '#16a34a',
        },
        title: {
          offsetCenter: [0, '60%'],
          fontSize: 14,
          color: '#6b7280',
          fontWeight: 600,
        },
        data: [{ value: rate, name: 'Tỷ lệ đúng giờ' }],
      }],
    };
  }

  statusPie(): Record<string, unknown> {
    const o = this.overview();
    if (!o) return {};
    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { bottom: 0, textStyle: { fontSize: 12, color: '#6b7280' } },
      series: [{
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['50%', '42%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 3 },
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 16, fontWeight: 'bold' },
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.2)' },
        },
        data: [
          { value: o.today.on_time, name: 'Đúng giờ', itemStyle: { color: '#16a34a' } },
          { value: o.today.late, name: 'Đi trễ', itemStyle: { color: '#f59e0b' } },
          { value: o.today.absent, name: 'Vắng', itemStyle: { color: '#ef4444' } },
        ],
      }],
    };
  }

  topOnTimeBar(): Record<string, unknown> {
    const o = this.overview();
    if (!o || !o.top_branches_on_time.length) return {};
    const names = o.top_branches_on_time.map(b => b.name.replace('Chi nhánh ', ''));
    const values = o.top_branches_on_time.map(b => Math.round(b.rate * 100));
    return {
      tooltip: { trigger: 'axis', formatter: '{b}: {c}%' },
      grid: { left: 120, right: 40, top: 10, bottom: 20 },
      xAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%', color: '#9ca3af' } },
      yAxis: {
        type: 'category',
        data: names,
        axisLabel: { fontSize: 12, color: '#374151', width: 100, overflow: 'truncate' },
        axisTick: { show: false },
        axisLine: { show: false },
      },
      series: [{
        type: 'bar',
        data: values.map(v => ({
          value: v,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: '#16a34a' },
              { offset: 1, color: '#4ade80' },
            ]),
            borderRadius: [0, 6, 6, 0],
          },
        })),
        barWidth: 20,
        label: { show: true, position: 'right', formatter: '{c}%', fontSize: 13, fontWeight: 600, color: '#16a34a' },
      }],
    };
  }

  topLateBar(): Record<string, unknown> {
    const o = this.overview();
    if (!o || !o.top_branches_late.length) return {};
    const names = o.top_branches_late.map(b => b.name.replace('Chi nhánh ', ''));
    const values = o.top_branches_late.map(b => b.late_count);
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 120, right: 40, top: 10, bottom: 20 },
      xAxis: { type: 'value', axisLabel: { color: '#9ca3af' } },
      yAxis: {
        type: 'category',
        data: names,
        axisLabel: { fontSize: 12, color: '#374151', width: 100, overflow: 'truncate' },
        axisTick: { show: false },
        axisLine: { show: false },
      },
      series: [{
        type: 'bar',
        data: values.map(v => ({
          value: v,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: '#f59e0b' },
              { offset: 1, color: '#fbbf24' },
            ]),
            borderRadius: [0, 6, 6, 0],
          },
        })),
        barWidth: 20,
        label: { show: true, position: 'right', fontSize: 13, fontWeight: 600, color: '#f59e0b' },
      }],
    };
  }

  heatmapOption(): Record<string, unknown> {
    const o = this.overview();
    if (!o) return {};
    const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}h`);
    const map = new Map(o.checkin_heatmap.map(h => [h.hour, h.count]));
    const data = hours.map((_, i) => [i, 0, map.get(i) ?? 0]);
    const max = Math.max(...data.map(d => d[2] as number), 1);
    return {
      tooltip: { formatter: (p: { data: number[] }) => `${hours[p.data[0]]}: ${p.data[2]} check-in` },
      grid: { left: 10, right: 30, top: 10, bottom: 30 },
      xAxis: {
        type: 'category',
        data: hours,
        splitArea: { show: true },
        axisLabel: { fontSize: 10, color: '#9ca3af', interval: 2 },
      },
      yAxis: { type: 'category', data: [''], show: false },
      visualMap: {
        min: 0,
        max,
        calculable: false,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        show: false,
        inRange: { color: ['#ebf8f9', '#47BAC1', '#208BDE', '#1664A3'] },
      },
      series: [{
        type: 'heatmap',
        data,
        label: {
          show: true,
          fontSize: 11,
          color: '#fff',
          formatter: (p: { data: number[] }) => p.data[2] > 0 ? String(p.data[2]) : ''
        },
        itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
      }],
    };
  }
}
