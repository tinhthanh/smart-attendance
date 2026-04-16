import { HttpStatus, Injectable } from '@nestjs/common';
import {
  AuditLogService,
  BusinessException,
  ErrorCode,
  PrismaService,
  UserRolesContext,
} from '@smart-attendance/api/common';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { EmployeesService, RequestCtx } from './employees.service';

@Injectable()
export class EmployeeDevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly employees: EmployeesService
  ) {}

  async list(user: UserRolesContext, employeeId: string) {
    await this.employees.assertEmployeeScope(user, employeeId);
    const rows = await this.prisma.employeeDevice.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      device_name: r.deviceName,
      platform: r.platform,
      app_version: r.appVersion,
      is_trusted: r.isTrusted,
      last_seen_at: r.lastSeenAt,
    }));
  }

  async update(
    user: UserRolesContext,
    employeeId: string,
    deviceId: string,
    dto: UpdateDeviceDto,
    ctx: RequestCtx
  ) {
    await this.employees.assertEmployeeScope(user, employeeId);
    return this.prisma.$transaction(async (tx) => {
      const device = await tx.employeeDevice.findFirst({
        where: { id: deviceId, employeeId },
      });
      if (!device) {
        throw new BusinessException(
          ErrorCode.NOT_FOUND,
          HttpStatus.NOT_FOUND,
          'Device not found'
        );
      }
      const after = await tx.employeeDevice.update({
        where: { id: deviceId },
        data: { isTrusted: dto.is_trusted },
      });
      await this.audit.logInTransaction(tx, {
        userId: user.id,
        action: 'update',
        entityType: 'EmployeeDevice',
        entityId: deviceId,
        before: { is_trusted: device.isTrusted },
        after: { is_trusted: after.isTrusted },
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      return {
        id: after.id,
        device_name: after.deviceName,
        platform: after.platform,
        app_version: after.appVersion,
        is_trusted: after.isTrusted,
        last_seen_at: after.lastSeenAt,
      };
    });
  }
}
