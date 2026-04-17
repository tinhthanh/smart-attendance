export const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  on_time: 'Đúng giờ',
  late: 'Đi trễ',
  early_leave: 'Về sớm',
  overtime: 'Tăng ca',
  missing_checkout: 'Quên checkout',
  absent: 'Vắng',
};

export const EVENT_TYPE_LABELS: Record<string, string> = {
  check_in: 'Check in',
  check_out: 'Check out',
};

export function formatAttendanceStatus(
  status: string | undefined | null
): string {
  if (!status) return '--';
  return ATTENDANCE_STATUS_LABELS[status] || status;
}

export function formatEventType(type: string | undefined | null): string {
  if (!type) return '--';
  return EVENT_TYPE_LABELS[type] || type;
}
