/**
 * Dashboard service.
 *
 * Reads from `daily_attendance_summaries` (read model per spec §7) + small
 * session queries + Redis anomaly cache populated by T-014 cron.
 *
 * Raw SQL exception (per CLAUDE.md §8 T-014 precedent):
 * - Heatmap hour-bucket with AT TIME ZONE conversion
 * - Week trend rate computation with FILTER (WHERE)
 * Inputs parameterized via tagged template literals. Results cast to
 * typed row interfaces.
 */
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import {
  BusinessException,
  ErrorCode,
  PrismaService,
  UserRolesContext,
  getManagerBranchIds,
  isAdmin,
} from '@smart-attendance/api/common';
import {
  AdminOverview,
  AnomaliesPayload,
  BranchDashboard,
} from './dashboard.types';

interface HeatmapRow {
  hour: number;
  count: number;
}

interface WeekTrendRow {
  date: string;
  on_time_rate: number;
}

interface CachedAnomaly {
  asOf: string;
  suspicious_employees: { employee_id: string; count: number }[];
  untrusted_devices: { employee_id: string; device_id: string }[];
  branches_high_late_rate: {
    branch_id: string;
    today_rate: number;
    avg_7d: number;
  }[];
}

const CACHE_TTL_MS = 60_000;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function todayWorkDate(): Date {
  // Branch timezone is Asia/Ho_Chi_Minh per seed; compute local YYYY-MM-DD
  const now = new Date();
  const local = new Date(now.getTime() + 7 * 3_600_000);
  return new Date(`${local.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache
  ) {}

  async getAdminOverview(): Promise<AdminOverview> {
    const today = todayWorkDate();
    const cacheKey = `dashboard:admin:overview:${isoDate(today)}`;
    const cached = await this.cache.get<AdminOverview>(cacheKey);
    if (cached) return cached;

    const [totalEmployees, totalBranches, summaries, heatmap, branchAgg] =
      await Promise.all([
        this.prisma.employee.count({ where: { employmentStatus: 'active' } }),
        this.prisma.branch.count({ where: { status: 'active' } }),
        this.prisma.dailyAttendanceSummary.groupBy({
          by: ['status'],
          where: { workDate: today },
          _count: true,
        }),
        this.prisma.$queryRaw<HeatmapRow[]>`
        SELECT EXTRACT(HOUR FROM check_in_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::int AS hour,
               COUNT(*)::int AS count
        FROM attendance_sessions
        WHERE work_date = ${today}
          AND check_in_at IS NOT NULL
        GROUP BY 1
        ORDER BY 1
      `,
        this.prisma.$queryRaw<
          {
            branch_id: string;
            name: string;
            total: bigint;
            on_time: bigint;
            late: bigint;
          }[]
        >`
        SELECT b.id AS branch_id, b.name,
               COUNT(*)::bigint AS total,
               COUNT(*) FILTER (WHERE das.status = 'on_time')::bigint AS on_time,
               COUNT(*) FILTER (WHERE das.status = 'late')::bigint AS late
        FROM daily_attendance_summaries das
        JOIN branches b ON b.id = das.branch_id
        WHERE das.work_date = ${today}
        GROUP BY b.id, b.name
      `,
      ]);

    const statusCount = new Map(summaries.map((s) => [s.status, s._count]));
    const onTime = statusCount.get('on_time') ?? 0;
    const late = statusCount.get('late') ?? 0;
    const absent = statusCount.get('absent') ?? 0;
    const earlyLeave = statusCount.get('early_leave') ?? 0;
    const overtime = statusCount.get('overtime') ?? 0;
    const missing = statusCount.get('missing_checkout') ?? 0;
    const checkedIn = onTime + late + earlyLeave + overtime + missing;
    const totalToday = checkedIn + absent;

    const branchRates = branchAgg.map((b) => ({
      branch_id: b.branch_id,
      name: b.name,
      total: Number(b.total),
      on_time: Number(b.on_time),
      late: Number(b.late),
      rate: Number(b.total) > 0 ? Number(b.on_time) / Number(b.total) : 0,
    }));

    const topOnTime = [...branchRates]
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 5)
      .map((b) => ({
        branch_id: b.branch_id,
        name: b.name,
        rate: Number(b.rate.toFixed(3)),
      }));

    const topLate = [...branchRates]
      .sort((a, b) => b.late - a.late)
      .slice(0, 5)
      .map((b) => ({
        branch_id: b.branch_id,
        name: b.name,
        late_count: b.late,
      }));

    const result: AdminOverview = {
      total_employees: totalEmployees,
      total_branches: totalBranches,
      today: {
        checked_in: checkedIn,
        on_time: onTime,
        late: late,
        absent,
        on_time_rate:
          totalToday > 0 ? Number((onTime / totalToday).toFixed(3)) : 0,
      },
      top_branches_on_time: topOnTime,
      top_branches_late: topLate,
      checkin_heatmap: heatmap,
    };

    await this.cache.set(cacheKey, result, CACHE_TTL_MS);
    return result;
  }

  async getManagerBranch(
    user: UserRolesContext,
    branchId: string
  ): Promise<BranchDashboard> {
    if (!isAdmin(user)) {
      const scopeIds = await getManagerBranchIds(this.prisma, user.id);
      if (!scopeIds.includes(branchId)) {
        throw new BusinessException(
          ErrorCode.NOT_FOUND,
          HttpStatus.NOT_FOUND,
          'Branch not found'
        );
      }
    }

    const today = todayWorkDate();
    const cacheKey = `dashboard:manager:${branchId}:${isoDate(today)}`;
    const cached = await this.cache.get<BranchDashboard>(cacheKey);
    if (cached) return cached;

    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, name: true },
    });
    if (!branch) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        HttpStatus.NOT_FOUND,
        'Branch not found'
      );
    }

    const totalEmployees = await this.prisma.employee.count({
      where: { primaryBranchId: branchId, employmentStatus: 'active' },
    });

    const [statusCounts, lowTrust, weekTrend] = await Promise.all([
      this.prisma.dailyAttendanceSummary.groupBy({
        by: ['status'],
        where: { branchId, workDate: today },
        _count: true,
      }),
      this.prisma.attendanceSession.findMany({
        where: {
          branchId,
          workDate: today,
          trustScore: { lt: 40, not: null },
        },
        include: {
          employee: {
            select: {
              employeeCode: true,
              user: { select: { fullName: true } },
            },
          },
          events: {
            where: { status: 'success' },
            select: { riskFlags: true },
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
        take: 20,
      }),
      this.prisma.$queryRaw<WeekTrendRow[]>`
        SELECT to_char(work_date, 'YYYY-MM-DD') AS date,
               (COUNT(*) FILTER (WHERE status = 'on_time')::float
                  / NULLIF(COUNT(*), 0))::float AS on_time_rate
        FROM daily_attendance_summaries
        WHERE branch_id = ${branchId}::uuid
          AND work_date >= ${new Date(today.getTime() - 6 * 86_400_000)}
          AND work_date <= ${today}
        GROUP BY work_date
        ORDER BY work_date
      `,
    ]);

    const countMap = new Map(statusCounts.map((c) => [c.status, c._count]));
    const onTime = countMap.get('on_time') ?? 0;
    const late = countMap.get('late') ?? 0;
    const absent = countMap.get('absent') ?? 0;
    const earlyLeave = countMap.get('early_leave') ?? 0;
    const overtime = countMap.get('overtime') ?? 0;
    const missing = countMap.get('missing_checkout') ?? 0;
    const checkedIn = onTime + late + earlyLeave + overtime + missing;
    const notYet = Math.max(0, totalEmployees - checkedIn - absent);

    const result: BranchDashboard = {
      branch: { id: branch.id, name: branch.name },
      today: {
        total: totalEmployees,
        checked_in: checkedIn,
        not_yet: notYet,
        absent,
        on_time: onTime,
        late,
      },
      low_trust_today: lowTrust.map((s) => ({
        session_id: s.id,
        employee: {
          code: s.employee.employeeCode,
          name: s.employee.user.fullName,
        },
        trust_score: s.trustScore ?? 0,
        risk_flags: Array.isArray(s.events[0]?.riskFlags)
          ? (s.events[0].riskFlags as string[])
          : [],
      })),
      week_trend: weekTrend.map((r) => ({
        date: r.date,
        on_time_rate: Number((r.on_time_rate ?? 0).toFixed(3)),
      })),
    };

    await this.cache.set(cacheKey, result, CACHE_TTL_MS);
    return result;
  }

  async getAnomalies(user: UserRolesContext): Promise<AnomaliesPayload> {
    const key = `anomaly:${isoDate(todayWorkDate())}`;
    const cached = await this.cache.get<CachedAnomaly>(key);
    if (!cached) {
      return {
        branches_late_spike: [],
        employees_low_trust: [],
        untrusted_devices_new_today: 0,
      };
    }

    const scopeIds = isAdmin(user)
      ? null
      : await getManagerBranchIds(this.prisma, user.id);

    // Branches spike — lookup names + scope filter
    const branchIds = cached.branches_high_late_rate.map((b) => b.branch_id);
    const branches = branchIds.length
      ? await this.prisma.branch.findMany({
          where: { id: { in: branchIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameMap = new Map(branches.map((b) => [b.id, b.name]));

    const branchesSpike = cached.branches_high_late_rate
      .filter((b) => (scopeIds ? scopeIds.includes(b.branch_id) : true))
      .map((b) => ({
        branch_id: b.branch_id,
        name: nameMap.get(b.branch_id) ?? b.branch_id,
        late_rate_today: Number(b.today_rate.toFixed(3)),
        late_rate_avg_7d: Number(b.avg_7d.toFixed(3)),
        spike_ratio:
          b.avg_7d > 0 ? Number((b.today_rate / b.avg_7d).toFixed(2)) : 0,
      }));

    // Employees low trust — lookup employee_code + scope filter
    const empIds = cached.suspicious_employees.map((e) => e.employee_id);
    const employees = empIds.length
      ? await this.prisma.employee.findMany({
          where: { id: { in: empIds } },
          select: { id: true, employeeCode: true, primaryBranchId: true },
        })
      : [];
    const empMap = new Map(employees.map((e) => [e.id, e]));

    const employeesLowTrust = cached.suspicious_employees
      .filter((e) => {
        if (!scopeIds) return true;
        const emp = empMap.get(e.employee_id);
        return emp ? scopeIds.includes(emp.primaryBranchId) : false;
      })
      .map((e) => ({
        employee_id: e.employee_id,
        code: empMap.get(e.employee_id)?.employeeCode ?? e.employee_id,
        low_trust_count_7d: e.count,
      }));

    // Untrusted devices — count only
    const untrustedCount = scopeIds
      ? cached.untrusted_devices.filter((d) => {
          const emp = empMap.get(d.employee_id);
          return emp ? scopeIds.includes(emp.primaryBranchId) : false;
        }).length
      : cached.untrusted_devices.length;

    return {
      branches_late_spike: branchesSpike,
      employees_low_trust: employeesLowTrust,
      untrusted_devices_new_today: untrustedCount,
    };
  }
}
