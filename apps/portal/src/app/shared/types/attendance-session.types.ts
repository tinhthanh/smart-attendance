export type SessionStatus =
  | 'on_time'
  | 'late'
  | 'early_leave'
  | 'overtime'
  | 'missing_checkout'
  | 'absent';

export interface Session {
  id: string;
  work_date: string;
  employee: { id: string; employee_code: string; full_name: string };
  branch: { id: string; name: string };
  check_in_at: string | null;
  check_out_at: string | null;
  worked_minutes: number | null;
  overtime_minutes: number | null;
  status: SessionStatus;
  trust_score: number | null;
}

export interface AttendanceEvent {
  id: string;
  event_type: 'check_in' | 'check_out';
  status: 'success' | 'failed';
  validation_method: 'gps' | 'wifi' | 'gps_wifi' | 'none';
  trust_score: number;
  latitude: number | null;
  longitude: number | null;
  accuracy_meters: number | null;
  ssid: string | null;
  bssid: string | null;
  risk_flags: string[] | null;
  created_at: string;
}

export interface SessionWithEvents extends Session {
  events: AttendanceEvent[];
}

export interface ListSessionsQuery {
  page?: number;
  limit?: number;
  branch_id?: string;
  employee_id?: string;
  date_from?: string;
  date_to?: string;
  status?: SessionStatus;
}

export interface OverrideSessionDto {
  status?: Exclude<SessionStatus, 'overtime'>;
  note: string;
}

export const OVERRIDE_STATUS_OPTIONS: Exclude<SessionStatus, 'overtime'>[] = [
  'on_time',
  'late',
  'early_leave',
  'missing_checkout',
  'absent',
];
