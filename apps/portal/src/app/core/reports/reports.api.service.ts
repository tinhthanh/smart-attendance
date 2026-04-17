import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ItemResponse } from '../../shared/types/branch.types';
import { ApiService } from '../api/api.service';

export interface CreateExportDto {
  type: 'attendance_csv';
  branch_id?: string;
  date_from: string;
  date_to: string;
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

export interface ExportStatus {
  job_id: string;
  status: ExportStatusState;
  download_url?: string;
  expires_at?: string;
  row_count?: number;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class ReportsApiService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  createExport(
    dto: CreateExportDto
  ): Observable<ItemResponse<CreateExportResponse>> {
    return this.api.post<ItemResponse<CreateExportResponse>>(
      '/reports/export',
      dto
    );
  }

  getStatus(jobId: string): Observable<ItemResponse<ExportStatus>> {
    return this.api.get<ItemResponse<ExportStatus>>(`/reports/export/${jobId}`);
  }

  downloadFile(jobId: string): Observable<Blob> {
    return this.http.get(`${this.base}/reports/export/${jobId}/download`, {
      responseType: 'blob',
    });
  }
}
