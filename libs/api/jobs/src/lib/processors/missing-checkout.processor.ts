import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '@smart-attendance/api/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queues';
import { ymdToDate } from '../util/date.util';

export interface MissingCheckoutJobData {
  forDate: string;
}

export interface MissingCheckoutResult {
  closed: number;
  duration_ms: number;
}

@Processor(QUEUE_NAMES.CHECKOUT_CLOSE, { concurrency: 1 })
export class MissingCheckoutProcessor extends WorkerHost {
  private readonly logger = new Logger(MissingCheckoutProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(
    job: Job<MissingCheckoutJobData>
  ): Promise<MissingCheckoutResult> {
    const start = Date.now();
    const { forDate } = job.data;
    const workDate = ymdToDate(forDate);
    const tag = `missing-checkout[${forDate}]`;
    this.logger.log(`${tag} START`);

    const result = await this.prisma.attendanceSession.updateMany({
      where: {
        workDate,
        checkInAt: { not: null },
        checkOutAt: null,
        // Skip sessions that managers already set via PATCH
        status: { in: ['on_time', 'late'] },
      },
      data: {
        status: 'missing_checkout',
        workedMinutes: null,
      },
    });

    const duration_ms = Date.now() - start;
    this.logger.log(`${tag} END — closed=${result.count} in ${duration_ms}ms`);
    return { closed: result.count, duration_ms };
  }
}
