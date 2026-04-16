import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Job, Queue } from 'bullmq';
import {
  DEFAULT_JOB_OPTIONS,
  JOB_NAMES,
  JobName,
  QUEUE_NAMES,
  TIMEZONE,
} from './queues';
import { todayIso, yesterdayIso } from './util/date.util';

@Injectable()
export class JobsScheduler {
  private readonly logger = new Logger(JobsScheduler.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.SUMMARY) private readonly summary: Queue,
    @InjectQueue(QUEUE_NAMES.CHECKOUT_CLOSE) private readonly closeQueue: Queue,
    @InjectQueue(QUEUE_NAMES.ANOMALY) private readonly anomaly: Queue
  ) {}

  @Cron('30 0 * * *', { timeZone: TIMEZONE })
  async scheduleDailySummary() {
    const forDate = yesterdayIso();
    const job = await this.summary.add(
      JOB_NAMES.DAILY_SUMMARY,
      { forDate },
      { ...DEFAULT_JOB_OPTIONS, jobId: `daily-summary-${forDate}` }
    );
    this.logger.log(`Scheduled daily-summary jobId=${job.id} for ${forDate}`);
  }

  @Cron('59 23 * * *', { timeZone: TIMEZONE })
  async scheduleMissingCheckout() {
    const forDate = todayIso();
    const job = await this.closeQueue.add(
      JOB_NAMES.MISSING_CHECKOUT_CLOSE,
      { forDate },
      { ...DEFAULT_JOB_OPTIONS, jobId: `close-${forDate}` }
    );
    this.logger.log(
      `Scheduled missing-checkout jobId=${job.id} for ${forDate}`
    );
  }

  @Cron('0 1 * * *', { timeZone: TIMEZONE })
  async scheduleAnomaly() {
    const asOf = yesterdayIso();
    const job = await this.anomaly.add(
      JOB_NAMES.ANOMALY_DETECTION,
      { asOf },
      { ...DEFAULT_JOB_OPTIONS, jobId: `anomaly-${asOf}` }
    );
    this.logger.log(`Scheduled anomaly jobId=${job.id} for ${asOf}`);
  }

  async runNow(
    name: JobName,
    overrides?: { forDate?: string; asOf?: string }
  ): Promise<Job> {
    switch (name) {
      case JOB_NAMES.DAILY_SUMMARY: {
        const forDate = overrides?.forDate ?? yesterdayIso();
        return this.summary.add(
          name,
          { forDate },
          {
            ...DEFAULT_JOB_OPTIONS,
            jobId: `daily-summary-manual-${Date.now()}`,
          }
        );
      }
      case JOB_NAMES.MISSING_CHECKOUT_CLOSE: {
        const forDate = overrides?.forDate ?? todayIso();
        return this.closeQueue.add(
          name,
          { forDate },
          { ...DEFAULT_JOB_OPTIONS, jobId: `close-manual-${Date.now()}` }
        );
      }
      case JOB_NAMES.ANOMALY_DETECTION: {
        const asOf = overrides?.asOf ?? todayIso();
        return this.anomaly.add(
          name,
          { asOf },
          { ...DEFAULT_JOB_OPTIONS, jobId: `anomaly-manual-${Date.now()}` }
        );
      }
      default:
        throw new Error(`Unknown job name: ${name}`);
    }
  }

  async getJobStatus(
    name: JobName,
    jobId: string
  ): Promise<{
    state: string;
    result?: unknown;
    failedReason?: string;
  } | null> {
    const queue = this.queueFor(name);
    const job = await queue.getJob(jobId);
    if (!job) return null;
    const state = await job.getState();
    return {
      state,
      result: job.returnvalue,
      failedReason: job.failedReason,
    };
  }

  private queueFor(name: JobName): Queue {
    switch (name) {
      case JOB_NAMES.DAILY_SUMMARY:
        return this.summary;
      case JOB_NAMES.MISSING_CHECKOUT_CLOSE:
        return this.closeQueue;
      case JOB_NAMES.ANOMALY_DETECTION:
        return this.anomaly;
    }
  }
}
