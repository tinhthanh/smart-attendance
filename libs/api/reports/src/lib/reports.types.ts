export interface ExportJobData {
  jobId: string;
  type: 'attendance_csv';
  filters: {
    branchId?: string;
    dateFrom: string;
    dateTo: string;
  };
  requestedBy: string;
}

export interface ExportJobResult {
  filePath: string;
  rowCount: number;
  fileSizeBytes: number;
  expiresAt: string;
  durationMs: number;
}

export type ExportStatusState =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed';

export interface CreateExportResponse {
  job_id: string;
  status: ExportStatusState;
}

export interface ExportStatusResponse {
  job_id: string;
  status: ExportStatusState;
  download_url?: string;
  expires_at?: string;
  row_count?: number;
  error?: string;
}
