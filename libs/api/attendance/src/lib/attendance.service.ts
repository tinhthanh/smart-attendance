import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  BranchConfigCacheService,
  BusinessException,
  CachedGeofence,
  ErrorCode,
  PrismaService,
  UserRolesContext,
  buildPaginationMeta,
} from '@smart-attendance/api/common';
import {
  computeTrustScore,
  haversineDistance,
} from '@smart-attendance/shared/utils';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { ListMeQueryDto } from './dto/list-me-query.dto';
import {
  isEarlyCheckOut,
  isLateCheckIn,
  toBranchWorkDate,
} from './work-date.util';

export interface RequestCtx {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: BranchConfigCacheService
  ) {}

  async checkIn(user: UserRolesContext, dto: CheckInDto, ctx: RequestCtx) {
    const employee = await this.loadEmployee(user.id);
    const branch = employee.primaryBranch;
    const cfg = await this.cache.get(branch.id);
    if (cfg.branchStatus !== 'active') {
      throw new BusinessException(
        ErrorCode.NOT_ASSIGNED_TO_BRANCH,
        HttpStatus.UNPROCESSABLE_ENTITY,
        'Branch inactive'
      );
    }

    const schedule = await this.resolveSchedule(employee.id);

    const device = await this.upsertDevice(
      employee.id,
      dto.device_fingerprint,
      dto.platform,
      dto.device_name,
      dto.app_version
    );

    const lastEvent = await this.prisma.attendanceEvent.findFirst({
      where: {
        employeeId: employee.id,
        status: 'success',
        latitude: { not: null },
        longitude: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });

    const checkInAt = new Date();

    const scoreResult = computeTrustScore({
      gps: {
        lat: dto.latitude,
        lng: dto.longitude,
        accuracyMeters: dto.accuracy_meters,
        isMockLocation: dto.is_mock_location,
      },
      wifi:
        dto.ssid || dto.bssid
          ? { ssid: dto.ssid ?? '', bssid: dto.bssid ?? null }
          : null,
      branch: { geofences: cfg.geofences, wifiConfigs: cfg.wifiConfigs },
      device: { isTrusted: device.isTrusted, isFirstTime: device.isFirstTime },
      history: lastEvent
        ? {
            lastEventLat: lastEvent.latitude?.toNumber(),
            lastEventLng: lastEvent.longitude?.toNumber(),
            lastEventAt: lastEvent.createdAt,
            currentEventAt: checkInAt,
          }
        : null,
      ipMeta: { isVpnSuspected: false },
    });

    if (!scoreResult.isHardValid) {
      const event = await this.prisma.attendanceEvent.create({
        data: {
          employeeId: employee.id,
          branchId: branch.id,
          deviceId: device.id,
          eventType: 'check_in',
          status: 'failed',
          validationMethod: 'none',
          trustScore: 0,
          latitude: new Prisma.Decimal(dto.latitude),
          longitude: new Prisma.Decimal(dto.longitude),
          accuracyMeters: dto.accuracy_meters,
          ssid: dto.ssid,
          bssid: dto.bssid,
          ipAddress: ctx.ipAddress,
          riskFlags: scoreResult.flags,
          rejectReason: 'hard_validation_failed',
          deviceMeta: {
            fingerprint: dto.device_fingerprint,
            platform: dto.platform,
            app_version: dto.app_version,
          },
        },
      });
      const distance = this.computeDistanceToNearest(
        dto.latitude,
        dto.longitude,
        cfg.geofences
      );
      throw new BusinessException(
        ErrorCode.INVALID_LOCATION,
        HttpStatus.UNPROCESSABLE_ENTITY,
        'Vị trí ngoài geofence và WiFi không khớp',
        {
          event_id: event.id,
          trust_score: 0,
          risk_flags: scoreResult.flags,
          distance_meters: distance,
        }
      );
    }

    const workDate = toBranchWorkDate(checkInAt, cfg.timezone);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.attendanceSession.findUnique({
        where: { employeeId_workDate: { employeeId: employee.id, workDate } },
      });
      if (existing?.checkInAt) {
        throw new BusinessException(
          ErrorCode.ALREADY_CHECKED_IN,
          HttpStatus.CONFLICT,
          'Already checked in today',
          { session_id: existing.id, check_in_at: existing.checkInAt }
        );
      }

      const status = isLateCheckIn(
        checkInAt,
        schedule.startTime,
        schedule.graceMinutes,
        cfg.timezone
      )
        ? 'late'
        : 'on_time';

      const session = await tx.attendanceSession.upsert({
        where: { employeeId_workDate: { employeeId: employee.id, workDate } },
        create: {
          employeeId: employee.id,
          branchId: branch.id,
          workDate,
          checkInAt,
          status,
          trustScore: scoreResult.score,
        },
        update: { checkInAt, status, trustScore: scoreResult.score },
      });

      const event = await tx.attendanceEvent.create({
        data: {
          sessionId: session.id,
          employeeId: employee.id,
          branchId: branch.id,
          deviceId: device.id,
          eventType: 'check_in',
          status: 'success',
          validationMethod: scoreResult.validationMethod,
          trustScore: scoreResult.score,
          latitude: new Prisma.Decimal(dto.latitude),
          longitude: new Prisma.Decimal(dto.longitude),
          accuracyMeters: dto.accuracy_meters,
          ssid: dto.ssid,
          bssid: dto.bssid,
          ipAddress: ctx.ipAddress,
          riskFlags: scoreResult.flags.length ? scoreResult.flags : undefined,
          deviceMeta: {
            fingerprint: dto.device_fingerprint,
            platform: dto.platform,
            app_version: dto.app_version,
          },
        },
      });

      await tx.employeeDevice.update({
        where: { id: device.id },
        data: { lastSeenAt: checkInAt },
      });

      return {
        session_id: session.id,
        event_id: event.id,
        status,
        validation_method: scoreResult.validationMethod,
        trust_score: scoreResult.score,
        trust_level: scoreResult.level,
        risk_flags: scoreResult.flags,
        check_in_at: checkInAt,
        branch: { id: branch.id, name: branch.name },
      };
    });
  }

  async checkOut(user: UserRolesContext, dto: CheckOutDto, ctx: RequestCtx) {
    const employee = await this.loadEmployee(user.id);
    const branch = employee.primaryBranch;
    const cfg = await this.cache.get(branch.id);
    const schedule = await this.resolveSchedule(employee.id);

    const checkOutAt = new Date();
    const workDate = toBranchWorkDate(checkOutAt, cfg.timezone);

    const device = await this.upsertDevice(
      employee.id,
      dto.device_fingerprint,
      dto.platform,
      dto.device_name,
      dto.app_version
    );

    const lastEvent = await this.prisma.attendanceEvent.findFirst({
      where: {
        employeeId: employee.id,
        status: 'success',
        latitude: { not: null },
        longitude: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });

    const scoreResult = computeTrustScore({
      gps: {
        lat: dto.latitude,
        lng: dto.longitude,
        accuracyMeters: dto.accuracy_meters,
        isMockLocation: dto.is_mock_location,
      },
      wifi:
        dto.ssid || dto.bssid
          ? { ssid: dto.ssid ?? '', bssid: dto.bssid ?? null }
          : null,
      branch: { geofences: cfg.geofences, wifiConfigs: cfg.wifiConfigs },
      device: { isTrusted: device.isTrusted, isFirstTime: device.isFirstTime },
      history: lastEvent
        ? {
            lastEventLat: lastEvent.latitude?.toNumber(),
            lastEventLng: lastEvent.longitude?.toNumber(),
            lastEventAt: lastEvent.createdAt,
            currentEventAt: checkOutAt,
          }
        : null,
      ipMeta: { isVpnSuspected: false },
    });

    return this.prisma.$transaction(async (tx) => {
      const session = await tx.attendanceSession.findUnique({
        where: { employeeId_workDate: { employeeId: employee.id, workDate } },
      });
      if (!session || !session.checkInAt) {
        throw new BusinessException(
          ErrorCode.NOT_CHECKED_IN_YET,
          HttpStatus.CONFLICT,
          'No check-in recorded yet today'
        );
      }
      if (session.checkOutAt) {
        throw new BusinessException(
          ErrorCode.ALREADY_CHECKED_OUT,
          HttpStatus.CONFLICT,
          'Already checked out today',
          { session_id: session.id, check_out_at: session.checkOutAt }
        );
      }

      const workedMinutes = Math.floor(
        (checkOutAt.getTime() - session.checkInAt.getTime()) / 60_000
      );
      const overtimeMinutes = Math.max(
        0,
        workedMinutes - 8 * 60 - schedule.overtimeAfterMinutes
      );
      const early = isEarlyCheckOut(checkOutAt, schedule.endTime, cfg.timezone);

      let status: 'on_time' | 'late' | 'early_leave' | 'overtime' =
        session.status as 'on_time' | 'late' | 'early_leave' | 'overtime';
      if (early && status === 'on_time') status = 'early_leave';
      if (overtimeMinutes > 0 && status === 'on_time') status = 'overtime';

      const finalTrust = Math.min(session.trustScore ?? 100, scoreResult.score);

      const updated = await tx.attendanceSession.update({
        where: { id: session.id },
        data: {
          checkOutAt,
          workedMinutes,
          overtimeMinutes,
          status,
          trustScore: finalTrust,
        },
      });

      const event = await tx.attendanceEvent.create({
        data: {
          sessionId: session.id,
          employeeId: employee.id,
          branchId: branch.id,
          deviceId: device.id,
          eventType: 'check_out',
          status: scoreResult.isHardValid ? 'success' : 'failed',
          validationMethod: scoreResult.validationMethod,
          trustScore: scoreResult.score,
          latitude: new Prisma.Decimal(dto.latitude),
          longitude: new Prisma.Decimal(dto.longitude),
          accuracyMeters: dto.accuracy_meters,
          ssid: dto.ssid,
          bssid: dto.bssid,
          ipAddress: ctx.ipAddress,
          riskFlags: scoreResult.flags.length ? scoreResult.flags : undefined,
        },
      });

      await tx.employeeDevice.update({
        where: { id: device.id },
        data: { lastSeenAt: checkOutAt },
      });

      return {
        session_id: updated.id,
        event_id: event.id,
        status,
        validation_method: scoreResult.validationMethod,
        trust_score: finalTrust,
        trust_level: scoreResult.level,
        risk_flags: scoreResult.flags,
        check_out_at: checkOutAt,
        worked_minutes: workedMinutes,
        overtime_minutes: overtimeMinutes,
      };
    });
  }

  async listMe(user: UserRolesContext, query: ListMeQueryDto) {
    const employee = await this.prisma.employee.findFirst({
      where: { userId: user.id },
    });
    if (!employee) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        HttpStatus.NOT_FOUND,
        'Employee profile not found'
      );
    }
    const where: Prisma.AttendanceSessionWhereInput = {
      employeeId: employee.id,
    };
    if (query.date_from) where.workDate = { gte: new Date(query.date_from) };
    if (query.date_to) {
      where.workDate = {
        ...((where.workDate as Prisma.DateTimeFilter) ?? {}),
        lte: new Date(query.date_to),
      };
    }
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.attendanceSession.count({ where }),
      this.prisma.attendanceSession.findMany({
        where,
        take: query.limit,
        skip: (query.page - 1) * query.limit,
        orderBy: { workDate: 'desc' },
      }),
    ]);
    return {
      data: rows.map((r) => ({
        id: r.id,
        work_date: r.workDate.toISOString().slice(0, 10),
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

  private async loadEmployee(userId: string) {
    const emp = await this.prisma.employee.findFirst({
      where: { userId, employmentStatus: 'active' },
      include: {
        primaryBranch: {
          select: { id: true, name: true, status: true, timezone: true },
        },
      },
    });
    if (!emp || emp.primaryBranch.status !== 'active') {
      throw new BusinessException(
        ErrorCode.NOT_ASSIGNED_TO_BRANCH,
        HttpStatus.UNPROCESSABLE_ENTITY,
        'Employee not assigned to an active branch'
      );
    }
    return emp;
  }

  private async resolveSchedule(employeeId: string) {
    const today = new Date();
    const assignment = await this.prisma.workScheduleAssignment.findFirst({
      where: {
        employeeId,
        effectiveFrom: { lte: today },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }],
      },
      include: { schedule: true },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!assignment) {
      // fallback defaults — should not happen with seed, but safe
      return {
        startTime: '08:00',
        endTime: '17:00',
        graceMinutes: 10,
        overtimeAfterMinutes: 60,
      };
    }
    return assignment.schedule;
  }

  private async upsertDevice(
    employeeId: string,
    fingerprint: string,
    platform: 'ios' | 'android' | 'web',
    deviceName?: string,
    appVersion?: string
  ) {
    const existing = await this.prisma.employeeDevice.findUnique({
      where: {
        employeeId_deviceFingerprint: {
          employeeId,
          deviceFingerprint: fingerprint,
        },
      },
    });
    if (existing) {
      const updated = await this.prisma.employeeDevice.update({
        where: { id: existing.id },
        data: {
          deviceName: deviceName ?? existing.deviceName,
          appVersion: appVersion ?? existing.appVersion,
        },
      });
      return { ...updated, isFirstTime: false };
    }
    const created = await this.prisma.employeeDevice.create({
      data: {
        employeeId,
        deviceFingerprint: fingerprint,
        platform,
        deviceName,
        appVersion,
        isTrusted: false,
      },
    });
    return { ...created, isFirstTime: true };
  }

  private computeDistanceToNearest(
    lat: number,
    lng: number,
    geofences: CachedGeofence[]
  ): number {
    const active = geofences.filter((g) => g.isActive);
    if (active.length === 0) return -1;
    let min = Number.POSITIVE_INFINITY;
    for (const g of active) {
      const d = haversineDistance(lat, lng, g.centerLat, g.centerLng);
      if (d < min) min = d;
    }
    return Math.round(min);
  }
}
