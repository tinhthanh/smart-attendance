import { Module } from '@nestjs/common';
import { AttendanceSessionsController } from './attendance-sessions.controller';
import { AttendanceSessionsService } from './attendance-sessions.service';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { UserThrottlerGuard } from './guards/user-throttler.guard';

@Module({
  controllers: [AttendanceController, AttendanceSessionsController],
  providers: [AttendanceService, AttendanceSessionsService, UserThrottlerGuard],
  exports: [],
})
export class AttendanceModule {}
