import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { Roles } from '@smart-attendance/api/auth';
import { JobsScheduler } from '../jobs.scheduler';
import { JOB_NAMES, JobName } from '../queues';
import { AdminJobRunDto } from './admin-job.dto';

const VALID_JOBS: JobName[] = [
  JOB_NAMES.DAILY_SUMMARY,
  JOB_NAMES.MISSING_CHECKOUT_CLOSE,
  JOB_NAMES.ANOMALY_DETECTION,
];

@Controller('admin/jobs')
export class AdminJobsController {
  constructor(private readonly scheduler: JobsScheduler) {}

  @Roles('admin')
  @Post(':name/run')
  @HttpCode(HttpStatus.ACCEPTED)
  async run(@Param('name') name: string, @Body() dto: AdminJobRunDto) {
    if (!VALID_JOBS.includes(name as JobName)) {
      return {
        error: {
          code: 'VALIDATION_FAILED',
          message: `Unknown job name "${name}". Valid: ${VALID_JOBS.join(
            ', '
          )}`,
        },
      };
    }
    const job = await this.scheduler.runNow(name as JobName, {
      forDate: dto.for_date,
      asOf: dto.as_of,
    });

    // Wait briefly so we can report initial state — BullMQ finishes fast jobs synchronously
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    await sleep(100);

    const status = await this.scheduler.getJobStatus(
      name as JobName,
      job.id as string
    );
    return {
      job_id: job.id,
      status: status?.state ?? 'queued',
      started_at: new Date(job.timestamp).toISOString(),
      result: status?.result,
      error: status?.failedReason,
    };
  }
}
