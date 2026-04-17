export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface ItemResponse<T> {
  data: T;
}

export interface ListResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface CheckInRequest {
  latitude: number;
  longitude: number;
  accuracy_meters: number;
  ssid?: string;
  bssid?: string;
  device_fingerprint: string;
  platform: 'ios' | 'android' | 'web';
  device_name?: string;
  app_version?: string;
  is_mock_location: boolean;
}

export interface CheckInResponse {
  session_id: string;
  event_id: string;
  status:
    | 'on_time'
    | 'late'
    | 'early_leave'
    | 'overtime'
    | 'missing_checkout'
    | 'absent';
  validation_method: 'gps' | 'wifi' | 'gps_wifi' | 'none';
  trust_score: number;
  trust_level: 'trusted' | 'review' | 'suspicious';
  risk_flags: string[];
  check_in_at: string;
  branch: { id: string; name: string };
}

export interface CheckOutResponse extends Omit<CheckInResponse, 'check_in_at'> {
  check_out_at: string;
  worked_minutes: number;
  overtime_minutes: number;
}

export interface AttendanceSession {
  id: string;
  work_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  worked_minutes: number | null;
  overtime_minutes: number | null;
  status: string;
  trust_score: number | null;
}
