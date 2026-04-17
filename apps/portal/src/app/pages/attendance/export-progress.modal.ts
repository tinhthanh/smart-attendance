import { Component, inject, signal, OnDestroy, Input, OnInit } from '@angular/core';
import { ModalController, ToastController } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import {
  CreateExportDto,
  ExportStatus,
  ReportsApiService,
} from '../../core/reports/reports.api.service';
import { showErrorToast } from '../../core/util/error-toast.util';


const POLL_MS = 2_000;
const MAX_POLLS = 150; // 5 minutes

@Component({
  selector: 'app-export-progress-modal',
  standalone: true,
  templateUrl: './export-progress.modal.html',
  styleUrl: './export-progress.modal.scss',
})
export class ExportProgressModal implements OnInit, OnDestroy {
  private readonly api = inject(ReportsApiService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toastCtrl = inject(ToastController);

  @Input() dto!: CreateExportDto;

  readonly status = signal<ExportStatus | null>(null);
  readonly state = signal<
    'idle' | 'starting' | 'polling' | 'completed' | 'failed'
  >('idle');
  readonly errorMsg = signal<string | null>(null);

  private jobId: string | null = null;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private pollCount = 0;
  private blobUrl: string | null = null;

  async ngOnInit(): Promise<void> {
    await this.startExport();
  }

  ngOnDestroy(): void {
    this.stopPolling();
    this.revokeBlob();
  }

  async startExport(): Promise<void> {
    this.state.set('starting');
    try {
      const res = await firstValueFrom(this.api.createExport(this.dto));
      this.jobId = res.data.job_id;
      this.status.set({ job_id: res.data.job_id, status: res.data.status });
      this.state.set('polling');
      this.pollCount = 0;
      this.scheduleNextPoll();
    } catch (err) {
      this.state.set('failed');
      this.errorMsg.set(this.pickError(err));
      await showErrorToast(this.toastCtrl, err);
    }
  }

  private scheduleNextPoll(): void {
    this.pollTimer = setTimeout(() => this.pollStatus(), POLL_MS);
  }

  private async pollStatus(): Promise<void> {
    if (!this.jobId) return;
    this.pollCount++;
    if (this.pollCount > MAX_POLLS) {
      this.state.set('failed');
      this.errorMsg.set('Timeout — chưa có kết quả sau 5 phút');
      return;
    }
    try {
      const res = await firstValueFrom(this.api.getStatus(this.jobId));
      this.status.set(res.data);
      if (res.data.status === 'completed') {
        this.state.set('completed');
        await this.triggerDownload();
        return;
      }
      if (res.data.status === 'failed') {
        this.state.set('failed');
        this.errorMsg.set(res.data.error ?? 'Job thất bại');
        return;
      }
      this.scheduleNextPoll();
    } catch (err) {
      this.state.set('failed');
      this.errorMsg.set(this.pickError(err));
    }
  }

  private async triggerDownload(): Promise<void> {
    if (!this.jobId) return;
    try {
      const blob = await firstValueFrom(this.api.downloadFile(this.jobId));
      this.revokeBlob();
      this.blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = this.blobUrl;
      a.download = `attendance_${this.jobId.slice(0, 8)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      this.errorMsg.set(this.pickError(err));
      await showErrorToast(this.toastCtrl, err);
    }
  }

  private revokeBlob(): void {
    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl);
      this.blobUrl = null;
    }
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private pickError(err: unknown): string {
    const e = err as { error?: { error?: { message?: string } } };
    return e?.error?.error?.message ?? 'Đã xảy ra lỗi';
  }

  async close(): Promise<void> {
    this.stopPolling();
    await this.modalCtrl.dismiss();
  }

  retry(): void {
    this.errorMsg.set(null);
    void this.startExport();
  }
}
