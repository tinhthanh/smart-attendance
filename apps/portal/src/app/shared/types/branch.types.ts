export interface Branch {
  id: string;
  code: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  status: 'active' | 'inactive';
  employee_count?: number;
}

export interface BranchDetail extends Branch {
  radius_meters: number;
  timezone: string;
  wifi_configs?: WifiConfig[];
  geofences?: Geofence[];
}

export interface WifiConfig {
  id: string;
  ssid: string;
  bssid: string | null;
  is_active: boolean;
  priority: number;
  notes?: string | null;
}

export interface Geofence {
  id: string;
  name: string;
  center_lat: number;
  center_lng: number;
  radius_meters: number;
  is_active: boolean;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface ListResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ItemResponse<T> {
  data: T;
}

export interface CreateBranchDto {
  code: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  radius_meters?: number;
  timezone?: string;
}

export type UpdateBranchDto = Partial<CreateBranchDto> & {
  status?: 'active' | 'inactive';
};

export interface ListBranchesQuery {
  page?: number;
  limit?: number;
  status?: 'active' | 'inactive';
  search?: string;
}

export interface CreateWifiConfigDto {
  ssid: string;
  bssid?: string;
  priority?: number;
  notes?: string;
}

export interface CreateGeofenceDto {
  name: string;
  center_lat: number;
  center_lng: number;
  radius_meters: number;
}
