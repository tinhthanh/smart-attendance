export interface AdminOverview {
  total_employees: number;
  total_branches: number;
  today: {
    checked_in: number;
    on_time: number;
    late: number;
    absent: number;
    on_time_rate: number;
  };
  top_branches_on_time: { branch_id: string; name: string; rate: number }[];
  top_branches_late: { branch_id: string; name: string; late_count: number }[];
  checkin_heatmap: { hour: number; count: number }[];
}

export interface BranchDashboard {
  branch: { id: string; name: string };
  today: {
    total: number;
    checked_in: number;
    not_yet: number;
    absent: number;
    on_time: number;
    late: number;
  };
  low_trust_today: {
    session_id: string;
    employee: { code: string; name: string };
    trust_score: number;
    risk_flags: string[];
  }[];
  week_trend: { date: string; on_time_rate: number }[];
}

export interface AnomaliesPayload {
  branches_late_spike: {
    branch_id: string;
    name: string;
    late_rate_today: number;
    late_rate_avg_7d: number;
    spike_ratio: number;
  }[];
  employees_low_trust: {
    employee_id: string;
    code: string;
    low_trust_count_7d: number;
  }[];
  untrusted_devices_new_today: number;
}
