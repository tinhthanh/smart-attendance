import * as path from 'node:path';
import * as os from 'node:os';

export const REPORTS_QUEUE = 'report-export';
export const EXPORT_JOB_NAME = 'attendance-csv';

export const EXPORTS_DIR = path.join(os.tmpdir(), 'smart-attendance-reports');

export const EXPORT_MAX_ROWS = 10_000;
export const EXPORT_BATCH_SIZE = 500;
export const EXPORT_FILE_TTL_MS = 3_600_000;

export const REPORT_COLUMNS = [
  'Ngày',
  'Mã NV',
  'Họ tên',
  'Chi nhánh',
  'Phòng ban',
  'Check-in',
  'Check-out',
  'Số phút làm',
  'Overtime',
  'Trạng thái',
  'Trust Score',
] as const;
