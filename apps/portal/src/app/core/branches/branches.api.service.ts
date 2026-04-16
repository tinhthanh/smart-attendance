import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Branch,
  BranchDetail,
  CreateBranchDto,
  CreateGeofenceDto,
  CreateWifiConfigDto,
  Geofence,
  ItemResponse,
  ListBranchesQuery,
  ListResponse,
  UpdateBranchDto,
  WifiConfig,
} from '../../shared/types/branch.types';
import { ApiService } from '../api/api.service';

function qs(q: Record<string, unknown>): string {
  const entries = Object.entries(q).filter(
    ([, v]) => v !== undefined && v !== null && v !== ''
  );
  if (entries.length === 0) return '';
  return (
    '?' +
    entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')
  );
}

@Injectable({ providedIn: 'root' })
export class BranchesApiService {
  private readonly api = inject(ApiService);

  list(query: ListBranchesQuery): Observable<ListResponse<Branch>> {
    return this.api.get<ListResponse<Branch>>(
      `/branches${qs(query as Record<string, unknown>)}`
    );
  }

  get(id: string): Observable<ItemResponse<BranchDetail>> {
    return this.api.get<ItemResponse<BranchDetail>>(`/branches/${id}`);
  }

  create(dto: CreateBranchDto): Observable<ItemResponse<BranchDetail>> {
    return this.api.post<ItemResponse<BranchDetail>>('/branches', dto);
  }

  update(
    id: string,
    dto: UpdateBranchDto
  ): Observable<ItemResponse<BranchDetail>> {
    return this.api.patch<ItemResponse<BranchDetail>>(`/branches/${id}`, dto);
  }

  remove(id: string): Observable<ItemResponse<{ success: boolean }>> {
    return this.api.delete<ItemResponse<{ success: boolean }>>(
      `/branches/${id}`
    );
  }

  listWifi(branchId: string): Observable<ItemResponse<WifiConfig[]>> {
    return this.api.get<ItemResponse<WifiConfig[]>>(
      `/branches/${branchId}/wifi-configs`
    );
  }

  createWifi(
    branchId: string,
    dto: CreateWifiConfigDto
  ): Observable<ItemResponse<WifiConfig>> {
    return this.api.post<ItemResponse<WifiConfig>>(
      `/branches/${branchId}/wifi-configs`,
      dto
    );
  }

  deleteWifi(
    branchId: string,
    configId: string
  ): Observable<ItemResponse<{ success: boolean }>> {
    return this.api.delete<ItemResponse<{ success: boolean }>>(
      `/branches/${branchId}/wifi-configs/${configId}`
    );
  }

  listGeofences(branchId: string): Observable<ItemResponse<Geofence[]>> {
    return this.api.get<ItemResponse<Geofence[]>>(
      `/branches/${branchId}/geofences`
    );
  }

  createGeofence(
    branchId: string,
    dto: CreateGeofenceDto
  ): Observable<ItemResponse<Geofence>> {
    return this.api.post<ItemResponse<Geofence>>(
      `/branches/${branchId}/geofences`,
      dto
    );
  }
}
