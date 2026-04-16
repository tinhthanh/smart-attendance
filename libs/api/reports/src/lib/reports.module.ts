import { BullModule } from '@nestjs/bullmq';
import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';
import { ExportCleanupScheduler } from './export-cleanup.scheduler';
import { ExportProcessor } from './export.processor';
import { EXPORTS_DIR, REPORTS_QUEUE } from './reports.constants';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
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
    BullModule.registerQueue({ name: REPORTS_QUEUE }),
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ExportProcessor, ExportCleanupScheduler],
  exports: [ReportsService],
})
export class ReportsModule implements OnModuleInit {
  onModuleInit(): void {
    fs.mkdirSync(EXPORTS_DIR, { recursive: true });
  }
}
