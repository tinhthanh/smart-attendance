import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AdminJobsController } from './admin/admin-jobs.controller';
import { JobsScheduler } from './jobs.scheduler';
import { AnomalyProcessor } from './processors/anomaly.processor';
import { DailySummaryProcessor } from './processors/daily-summary.processor';
import { MissingCheckoutProcessor } from './processors/missing-checkout.processor';
import { QUEUE_NAMES } from './queues';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = new URL(config.getOrThrow<string>('REDIS_URL'));
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            password: url.password || undefined,
          },
        };
      },
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.SUMMARY },
      { name: QUEUE_NAMES.CHECKOUT_CLOSE },
      { name: QUEUE_NAMES.ANOMALY }
    ),
  ],
  controllers: [AdminJobsController],
  providers: [
    JobsScheduler,
    DailySummaryProcessor,
    MissingCheckoutProcessor,
    AnomalyProcessor,
  ],
  exports: [JobsScheduler],
})
export class JobsModule {}
