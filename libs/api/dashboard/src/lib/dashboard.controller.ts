import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { AuthUser, CurrentUser, Roles } from '@smart-attendance/api/auth';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Roles('admin')
  @Get('admin/overview')
  getAdminOverview() {
    return this.service.getAdminOverview();
  }

  @Roles('admin', 'manager')
  @Get('manager/:branchId')
  getManagerBranch(
    @CurrentUser() user: AuthUser,
    @Param('branchId', new ParseUUIDPipe()) branchId: string
  ) {
    return this.service.getManagerBranch(user, branchId);
  }

  @Roles('admin', 'manager')
  @Get('anomalies')
  getAnomalies(@CurrentUser() user: AuthUser) {
    return this.service.getAnomalies(user);
  }
}
