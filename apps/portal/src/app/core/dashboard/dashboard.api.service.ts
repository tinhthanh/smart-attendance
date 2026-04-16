import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ItemResponse } from '../../shared/types/branch.types';
import {
  AdminOverview,
  AnomaliesPayload,
  BranchDashboard,
} from '../../shared/types/dashboard.types';
import { ApiService } from '../api/api.service';

@Injectable({ providedIn: 'root' })
export class DashboardApiService {
  private readonly api = inject(ApiService);

  getAdminOverview(): Observable<ItemResponse<AdminOverview>> {
    return this.api.get<ItemResponse<AdminOverview>>(
      '/dashboard/admin/overview'
    );
  }

  getManagerBranch(
    branchId: string
  ): Observable<ItemResponse<BranchDashboard>> {
    return this.api.get<ItemResponse<BranchDashboard>>(
      `/dashboard/manager/${branchId}`
    );
  }

  getAnomalies(): Observable<ItemResponse<AnomaliesPayload>> {
    return this.api.get<ItemResponse<AnomaliesPayload>>('/dashboard/anomalies');
  }
}
