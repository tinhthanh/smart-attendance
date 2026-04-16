import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AuditLogService,
  BusinessException,
  ErrorCode,
  PrismaService,
  UserRolesContext,
  buildPaginationMeta,
  getManagerBranchIds,
  isAdmin,
} from '@smart-attendance/api/common';
import { ListSessionsQueryDto } from './dto/list-sessions-query.dto';
import { OverrideSessionDto } from './dto/override-session.dto';

export interface RequestCtx {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AttendanceSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService
  ) {}

  async list(user: UserRolesContext, query: ListSessionsQueryDto) {
    const where: Prisma.AttendanceSessionWhereInput = {};
    if (query.employee_id) where.employeeId = query.employee_id;
    if (query.status) where.status = query.status;
    if (query.date_from) where.workDate = { gte: new Date(query.date_from) };
    if (query.date_to) {
      where.workDate = {
        ...((where.workDate as Prisma.DateTimeFilter) ?? {}),
        lte: new Date(query.date_to),
      };
    }

    if (!isAdmin(user)) {
      const scopeIds = await getManagerBranchIds(this.prisma, user.id);
      if (query.branch_id) {
        if (!scopeIds.includes(query.branch_id)) {
          throw new BusinessException(
            ErrorCode.NOT_FOUND,
            HttpStatus.NOT_FOUND,
            'Branch not found'
          );
        }
        where.branchId = query.branch_id;
      } else {
        where.branchId = { in: scopeIds.length > 0 ? scopeIds : ['__none__'] };
      }
    } else if (query.branch_id) {
      where.branchId = query.branch_id;
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.attendanceSession.count({ where }),
      this.prisma.attendanceSession.findMany({
        where,
        take: query.limit,
        skip: (query.page - 1) * query.limit,
        orderBy: { workDate: 'desc' },
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              user: { select: { fullName: true } },
            },
          },
          branch: { select: { id: true, name: true } },
        },
      }),
    ]);

    return {
      data: rows.map((r) => ({
        id: r.id,
        work_date: r.workDate.toISOString().slice(0, 10),
        employee: {
          id: r.employee.id,
          employee_code: r.employee.employeeCode,
          full_name: r.employee.user.fullName,
        },
        branch: { id: r.branch.id, name: r.branch.name },
        check_in_at: r.checkInAt,
        check_out_at: r.checkOutAt,
        worked_minutes: r.workedMinutes,
        overtime_minutes: r.overtimeMinutes,
        status: r.status,
        trust_score: r.trustScore,
      })),
      meta: buildPaginationMeta(total, query.page, query.limit),
    };
  }

  async getOne(user: UserRolesContext, id: string) {
    const session = await this.prisma.attendanceSession.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            user: { select: { fullName: true, email: true } },
          },
        },
        branch: { select: { id: true, name: true } },
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!session) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        HttpStatus.NOT_FOUND,
        'Session not found'
      );
    }
    await this.assertScope(user, session.branchId);
    return {
      id: session.id,
      work_date: session.workDate.toISOString().slice(0, 10),
      employee: {
        id: session.employee.id,
        employee_code: session.employee.employeeCode,
        full_name: session.employee.user.fullName,
      },
      branch: { id: session.branch.id, name: session.branch.name },
      check_in_at: session.checkInAt,
      check_out_at: session.checkOutAt,
      worked_minutes: session.workedMinutes,
      overtime_minutes: session.overtimeMinutes,
      status: session.status,
      trust_score: session.trustScore,
      events: session.events.map((e) => ({
        id: e.id,
        event_type: e.eventType,
        status: e.status,
        validation_method: e.validationMethod,
        trust_score: e.trustScore,
        latitude: e.latitude?.toNumber() ?? null,
        longitude: e.longitude?.toNumber() ?? null,
        accuracy_meters: e.accuracyMeters,
        ssid: e.ssid,
        bssid: e.bssid,
        risk_flags: e.riskFlags,
        created_at: e.createdAt,
      })),
    };
  }

  async override(
    user: UserRolesContext,
    id: string,
    dto: OverrideSessionDto,
    ctx: RequestCtx
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.attendanceSession.findUnique({ where: { id } });
      if (!before) {
        throw new BusinessException(
          ErrorCode.NOT_FOUND,
          HttpStatus.NOT_FOUND,
          'Session not found'
        );
      }
      await this.assertScope(user, before.branchId);

      const after = await tx.attendanceSession.update({
        where: { id },
        data: { status: dto.status ?? before.status },
      });

      await this.audit.logInTransaction(tx, {
        userId: user.id,
        action: 'override',
        entityType: 'AttendanceSession',
        entityId: id,
        before: { status: before.status },
        after: { status: after.status, note: dto.note },
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });

      return {
        id: after.id,
        status: after.status,
        note: dto.note,
      };
    });
  }

  private async assertScope(user: UserRolesContext, branchId: string) {
    if (isAdmin(user)) return;
    const scopeIds = await getManagerBranchIds(this.prisma, user.id);
    if (!scopeIds.includes(branchId)) {
      throw new BusinessException(
        ErrorCode.FORBIDDEN,
        HttpStatus.FORBIDDEN,
        'Session outside your scope'
      );
    }
  }
}
