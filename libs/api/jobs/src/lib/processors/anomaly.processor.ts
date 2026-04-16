/**
 * Anomaly detection processor.
 *
 * EXCEPTION to CLAUDE.md §8 "NO raw SQL — Prisma only":
 * Analytics aggregation uses `$queryRaw` for CTEs + GROUP BY HAVING +
 * ratio comparisons beyond Prisma's fluent API. All inputs parameterized
 * via tagged template literals to prevent SQL injection. Results cast to
 * typed interfaces (see R2 constraint). This exception is scoped to
 * analytics processors only — CRUD paths continue to use Prisma.
 */
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '@smart-attendance/api/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queues';
import { ymdToDate } from '../util/date.util';

export interface AnomalyJobData {
  asOf: string;
}

interface SuspiciousEmployeeRow {
  employee_id: string;
  low_count: bigint;
}

interface UntrustedDeviceRow {
  employee_id: string;
  device_id: string;
}

interface BranchLateRateRow {
  branch_id: string;
  today_rate: number;
  avg_7d: number;
}

export interface AnomalyResult {
  asOf: string;
  suspicious_employees: { employee_id: string; count: number }[];
  untrusted_devices: { employee_id: string; device_id: string }[];
  branches_high_late_rate: {
    branch_id: string;
    today_rate: number;
    avg_7d: number;
  }[];
  generated_at: string;
}

const CACHE_TTL_MS = 3_600_000;

@Processor(QUEUE_NAMES.ANOMALY, { concurrency: 1 })
export class AnomalyProcessor extends WorkerHost {
  private readonly logger = new Logger(AnomalyProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache
  ) {
    super();
  }

  async process(job: Job<AnomalyJobData>): Promise<AnomalyResult> {
    const start = Date.now();
    const { asOf } = job.data;
    const asOfDate = ymdToDate(asOf);
    const sevenDaysAgo = new Date(asOfDate.getTime() - 7 * 86_400_000);
    const tag = `anomaly[${asOf}]`;
    this.logger.log(`${tag} START`);

    const suspicious = await this.prisma.$queryRaw<SuspiciousEmployeeRow[]>`
      SELECT employee_id, COUNT(*) AS low_count
      FROM attendance_sessions
      WHERE work_date >= ${sevenDaysAgo}
        AND work_date <= ${asOfDate}
        AND trust_score IS NOT NULL
        AND trust_score < 40
      GROUP BY employee_id
      HAVING COUNT(*) >= 3
    `;

    const untrustedDevices = await this.prisma.$queryRaw<UntrustedDeviceRow[]>`
      SELECT DISTINCT ae.employee_id, ae.device_id
      FROM attendance_events ae
      JOIN employee_devices ed ON ed.id = ae.device_id
      WHERE ae.created_at >= ${asOfDate}
        AND ed.is_trusted = false
        AND ae.device_id IS NOT NULL
    `;

    const branchLateRate = await this.prisma.$queryRaw<BranchLateRateRow[]>`
      WITH today AS (
        SELECT branch_id,
               COUNT(*) FILTER (WHERE status = 'late')::float
                 / NULLIF(COUNT(*), 0) AS rate
        FROM attendance_sessions
        WHERE work_date = ${asOfDate}
        GROUP BY branch_id
      ),
      week AS (
        SELECT branch_id,
               COUNT(*) FILTER (WHERE status = 'late')::float
                 / NULLIF(COUNT(*), 0) AS rate
        FROM attendance_sessions
        WHERE work_date >= ${sevenDaysAgo} AND work_date < ${asOfDate}
        GROUP BY branch_id
      )
      SELECT today.branch_id,
             today.rate AS today_rate,
             week.rate AS avg_7d
      FROM today
      JOIN week ON today.branch_id = week.branch_id
      WHERE today.rate > week.rate * 2
        AND week.rate > 0
    `;

    const payload: AnomalyResult = {
      asOf,
      suspicious_employees: suspicious.map((r) => ({
        employee_id: r.employee_id,
        count: Number(r.low_count),
      })),
      untrusted_devices: untrustedDevices,
      branches_high_late_rate: branchLateRate,
      generated_at: new Date().toISOString(),
    };

    await this.cache.set(`anomaly:${asOf}`, payload, CACHE_TTL_MS);

    const duration_ms = Date.now() - start;
    this.logger.log(
      `${tag} END — suspicious=${suspicious.length} untrusted=${untrustedDevices.length} late_spike=${branchLateRate.length} in ${duration_ms}ms`
    );
    return payload;
  }
}
