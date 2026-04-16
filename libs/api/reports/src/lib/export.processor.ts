import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { AuditLogService, PrismaService } from '@smart-attendance/api/common';
import { Job } from 'bullmq';
import { stringify, Stringifier } from 'csv-stringify';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  EXPORTS_DIR,
  EXPORT_BATCH_SIZE,
  EXPORT_FILE_TTL_MS,
  EXPORT_MAX_ROWS,
  REPORTS_QUEUE,
  REPORT_COLUMNS,
} from './reports.constants';
import { ExportJobData, ExportJobResult } from './reports.types';

@Processor(REPORTS_QUEUE, { concurrency: 1 })
export class ExportProcessor extends WorkerHost {
  private readonly logger = new Logger(ExportProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService
  ) {
    super();
  }

  async process(job: Job<ExportJobData>): Promise<ExportJobResult> {
    const start = Date.now();
    const { jobId, type, filters, requestedBy } = job.data;
    const tag = `export[${jobId}]`;
    this.logger.log(
      `${tag} START type=${type} filters=${JSON.stringify(filters)}`
    );

    fs.mkdirSync(EXPORTS_DIR, { recursive: true });
    const filePath = path.join(EXPORTS_DIR, `${jobId}.csv`);
    const writeStream = fs.createWriteStream(filePath);
    // UTF-8 BOM for Excel Vietnamese compatibility
    writeStream.write('\uFEFF');

    const stringifier: Stringifier = stringify({
      header: true,
      columns: REPORT_COLUMNS as unknown as string[],
    });
    stringifier.pipe(writeStream);

    const where = {
      workDate: {
        gte: new Date(`${filters.dateFrom}T00:00:00.000Z`),
        lte: new Date(`${filters.dateTo}T00:00:00.000Z`),
      },
      ...(filters.branchId && { branchId: filters.branchId }),
    };

    let rowCount = 0;
    let truncated = false;
    let cursor: string | undefined;

    while (rowCount < EXPORT_MAX_ROWS) {
      const remaining = EXPORT_MAX_ROWS - rowCount;
      const take = Math.min(EXPORT_BATCH_SIZE, remaining + 1);
      const batch = await this.prisma.attendanceSession.findMany({
        where,
        take,
        ...(cursor && { skip: 1, cursor: { id: cursor } }),
        orderBy: { id: 'asc' },
        include: {
          employee: {
            select: {
              employeeCode: true,
              user: { select: { fullName: true } },
              department: { select: { name: true } },
            },
          },
          branch: { select: { name: true } },
        },
      });
      if (batch.length === 0) break;

      for (const s of batch) {
        if (rowCount >= EXPORT_MAX_ROWS) {
          truncated = true;
          break;
        }
        stringifier.write([
          s.workDate.toISOString().slice(0, 10),
          s.employee.employeeCode,
          s.employee.user.fullName,
          s.branch.name,
          s.employee.department?.name ?? '',
          s.checkInAt ? s.checkInAt.toISOString() : '',
          s.checkOutAt ? s.checkOutAt.toISOString() : '',
          s.workedMinutes ?? '',
          s.overtimeMinutes ?? '',
          s.status,
          s.trustScore ?? '',
        ]);
        rowCount++;
      }
      cursor = batch[batch.length - 1].id;
      if (batch.length < take || truncated) break;
    }

    stringifier.end();
    await new Promise<void>((resolve, reject) => {
      writeStream.on('close', () => resolve());
      writeStream.on('error', reject);
    });

    const fileSizeBytes = fs.statSync(filePath).size;
    const expiresAt = new Date(Date.now() + EXPORT_FILE_TTL_MS).toISOString();

    await this.audit.log({
      userId: requestedBy,
      action: 'create',
      entityType: 'AttendanceReport',
      entityId: jobId,
      after: {
        type,
        filters,
        rowCount,
        fileSizeBytes,
        jobId,
        truncated,
      },
    });

    const durationMs = Date.now() - start;
    this.logger.log(
      `${tag} END rows=${rowCount} bytes=${fileSizeBytes} truncated=${truncated} in ${durationMs}ms`
    );

    return {
      filePath,
      rowCount,
      fileSizeBytes,
      expiresAt,
      durationMs,
    };
  }
}
