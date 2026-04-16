import { InjectQueue } from '@nestjs/bullmq';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  BusinessException,
  ErrorCode,
  PrismaService,
  UserRolesContext,
  getManagerBranchIds,
  isAdmin,
} from '@smart-attendance/api/common';
import { Queue } from 'bullmq';
import * as fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { CreateExportDto } from './dto/create-export.dto';
import { EXPORT_JOB_NAME, REPORTS_QUEUE } from './reports.constants';
import {
  CreateExportResponse,
  ExportJobData,
  ExportJobResult,
  ExportStatusResponse,
  ExportStatusState,
} from './reports.types';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(REPORTS_QUEUE) private readonly queue: Queue<ExportJobData>
  ) {}

  async createExportJob(
    user: UserRolesContext,
    dto: CreateExportDto
  ): Promise<CreateExportResponse> {
    if (new Date(dto.date_from) > new Date(dto.date_to)) {
      throw new BusinessException(
        ErrorCode.VALIDATION_FAILED,
        HttpStatus.BAD_REQUEST,
        'date_from phải nhỏ hơn hoặc bằng date_to'
      );
    }

    if (!isAdmin(user)) {
      const scope = await getManagerBranchIds(this.prisma, user.id);
      if (scope.length === 0) {
        throw new BusinessException(
          ErrorCode.FORBIDDEN,
          HttpStatus.FORBIDDEN,
          'Bạn không có chi nhánh nào để xuất báo cáo'
        );
      }
      if (!dto.branch_id) {
        throw new BusinessException(
          ErrorCode.VALIDATION_FAILED,
          HttpStatus.BAD_REQUEST,
          'Manager phải chọn chi nhánh cụ thể khi xuất báo cáo'
        );
      }
      if (!scope.includes(dto.branch_id)) {
        throw new BusinessException(
          ErrorCode.FORBIDDEN,
          HttpStatus.FORBIDDEN,
          'Không có quyền xuất báo cáo cho chi nhánh này'
        );
      }
    }

    const jobId = randomUUID();
    await this.queue.add(
      EXPORT_JOB_NAME,
      {
        jobId,
        type: dto.type,
        filters: {
          branchId: dto.branch_id,
          dateFrom: dto.date_from,
          dateTo: dto.date_to,
        },
        requestedBy: user.id,
      },
      {
        jobId,
        attempts: 1,
        removeOnComplete: false,
        removeOnFail: false,
      }
    );

    this.logger.log(
      `export queued job=${jobId} by=${user.id} branch=${
        dto.branch_id ?? 'ALL'
      } range=${dto.date_from}..${dto.date_to}`
    );
    return { job_id: jobId, status: 'queued' };
  }

  async getJobStatus(
    user: UserRolesContext,
    jobId: string
  ): Promise<ExportStatusResponse> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        HttpStatus.NOT_FOUND,
        'Không tìm thấy báo cáo'
      );
    }

    this.assertJobAccess(user, job.data);

    const bullState = await job.getState();
    const status = this.mapBullState(bullState);
    const result = job.returnvalue as ExportJobResult | undefined;

    return {
      job_id: jobId,
      status,
      download_url:
        status === 'completed'
          ? `/api/v1/reports/export/${jobId}/download`
          : undefined,
      expires_at: status === 'completed' ? result?.expiresAt : undefined,
      row_count: status === 'completed' ? result?.rowCount : undefined,
      error: status === 'failed' ? job.failedReason : undefined,
    };
  }

  async streamFile(
    user: UserRolesContext,
    jobId: string
  ): Promise<{ stream: Readable; filename: string; contentLength: number }> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        HttpStatus.NOT_FOUND,
        'Không tìm thấy báo cáo'
      );
    }

    // R1 — defense in depth: re-validate scope on download, in case role
    // membership changed between createExportJob and download request.
    this.assertJobAccess(user, job.data);
    if (!isAdmin(user) && job.data.filters?.branchId) {
      const scope = await getManagerBranchIds(this.prisma, user.id);
      if (!scope.includes(job.data.filters.branchId)) {
        throw new BusinessException(
          ErrorCode.FORBIDDEN,
          HttpStatus.FORBIDDEN,
          'Không có quyền tải báo cáo của chi nhánh này'
        );
      }
    }

    const state = await job.getState();
    if (state !== 'completed') {
      throw new BusinessException(
        ErrorCode.VALIDATION_FAILED,
        HttpStatus.CONFLICT,
        'Báo cáo chưa sẵn sàng'
      );
    }
    const result = job.returnvalue as ExportJobResult | undefined;
    if (!result?.filePath || !fs.existsSync(result.filePath)) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        HttpStatus.NOT_FOUND,
        'File đã hết hạn hoặc bị xóa'
      );
    }

    const stat = fs.statSync(result.filePath);
    return {
      stream: fs.createReadStream(result.filePath),
      filename: `attendance_${jobId.slice(0, 8)}.csv`,
      contentLength: stat.size,
    };
  }

  private assertJobAccess(
    user: UserRolesContext,
    data: ExportJobData | undefined
  ): void {
    if (!data) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        HttpStatus.NOT_FOUND,
        'Không tìm thấy báo cáo'
      );
    }
    if (!isAdmin(user) && data.requestedBy !== user.id) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        HttpStatus.NOT_FOUND,
        'Không tìm thấy báo cáo'
      );
    }
  }

  private mapBullState(state: string): ExportStatusState {
    switch (state) {
      case 'completed':
        return 'completed';
      case 'failed':
        return 'failed';
      case 'active':
        return 'processing';
      case 'delayed':
      case 'waiting':
      case 'waiting-children':
      case 'prioritized':
      default:
        return 'queued';
    }
  }
}
