import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { EXPORTS_DIR, EXPORT_FILE_TTL_MS } from './reports.constants';

@Injectable()
export class ExportCleanupScheduler {
  private readonly logger = new Logger(ExportCleanupScheduler.name);

  @Cron('0 * * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async cleanupExpired(): Promise<void> {
    await this.runCleanup();
  }

  async runCleanup(): Promise<{ deleted: number; kept: number }> {
    let deleted = 0;
    let kept = 0;
    try {
      await fs.mkdir(EXPORTS_DIR, { recursive: true });
      const entries = await fs.readdir(EXPORTS_DIR);
      const now = Date.now();
      for (const name of entries) {
        const p = path.join(EXPORTS_DIR, name);
        try {
          const stat = await fs.stat(p);
          if (!stat.isFile()) continue;
          if (now - stat.mtimeMs > EXPORT_FILE_TTL_MS) {
            await fs.unlink(p);
            deleted++;
          } else {
            kept++;
          }
        } catch (err) {
          this.logger.warn(
            `cleanup skip ${name}: ${(err as Error).message ?? err}`
          );
        }
      }
      this.logger.log(`cleanup deleted=${deleted} kept=${kept}`);
    } catch (err) {
      this.logger.error(
        `cleanup failed: ${(err as Error).message ?? err}`,
        (err as Error).stack
      );
    }
    return { deleted, kept };
  }
}
