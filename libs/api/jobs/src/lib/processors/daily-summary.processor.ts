import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '@smart-attendance/api/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queues';
import { ymdToDate } from '../util/date.util';

export interface DailySummaryJobData {
  forDate: string; // YYYY-MM-DD
}

export interface DailySummaryResult {
  upserted: number;
  absent: number;
  duration_ms: number;
}

@Processor(QUEUE_NAMES.SUMMARY, { concurrency: 1 })
export class DailySummaryProcessor extends WorkerHost {
  private readonly logger = new Logger(DailySummaryProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<DailySummaryJobData>): Promise<DailySummaryResult> {
    const start = Date.now();
    const { forDate } = job.data;
    const workDate = ymdToDate(forDate);
    const tag = `daily-summary[${forDate}]`;
    this.logger.log(`${tag} START`);

    const employees = await this.prisma.employee.findMany({
      where: { employmentStatus: 'active' },
      select: { id: true, primaryBranchId: true },
    });

    // R5: Only aggregate sessions already closed (check-out recorded or missing_checkout status)
    const sessions = await this.prisma.attendanceSession.findMany({
      where: {
        workDate,
        OR: [
          { checkOutAt: { not: null } },
          { status: 'missing_checkout' },
          { status: 'absent' },
        ],
      },
    });
    const sessionByEmp = new Map(sessions.map((s) => [s.employeeId, s]));

    let upserted = 0;
    let absent = 0;
    for (const emp of employees) {
      const s = sessionByEmp.get(emp.id);
      if (s) {
        await this.prisma.dailyAttendanceSummary.upsert({
          where: { employeeId_workDate: { employeeId: emp.id, workDate } },
          create: {
            employeeId: emp.id,
            branchId: s.branchId,
            workDate,
            status: s.status,
            workedMinutes: s.workedMinutes ?? 0,
            overtimeMinutes: s.overtimeMinutes ?? 0,
            lateMinutes: 0,
            trustScoreAvg: s.trustScore,
          },
          update: {
            status: s.status,
            workedMinutes: s.workedMinutes ?? 0,
            overtimeMinutes: s.overtimeMinutes ?? 0,
            trustScoreAvg: s.trustScore,
          },
        });
      } else {
        await this.prisma.dailyAttendanceSummary.upsert({
          where: { employeeId_workDate: { employeeId: emp.id, workDate } },
          create: {
            employeeId: emp.id,
            branchId: emp.primaryBranchId,
            workDate,
            status: 'absent',
            workedMinutes: 0,
            overtimeMinutes: 0,
            lateMinutes: 0,
          },
          update: {
            status: 'absent',
            workedMinutes: 0,
            overtimeMinutes: 0,
          },
        });
        absent++;
      }
      upserted++;
    }

    const duration_ms = Date.now() - start;
    this.logger.log(
      `${tag} END — upserted=${upserted} absent=${absent} in ${duration_ms}ms`
    );
    return { upserted, absent, duration_ms };
  }
}
