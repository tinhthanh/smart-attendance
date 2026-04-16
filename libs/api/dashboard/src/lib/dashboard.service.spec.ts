import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test } from '@nestjs/testing';
import { ErrorCode, PrismaService } from '@smart-attendance/api/common';
import type { Cache } from 'cache-manager';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: DeepMockProxy<PrismaService>;
  let cache: DeepMockProxy<Cache>;

  const adminUser = { id: 'admin-1', email: 'a@x', roles: ['admin'] };
  const managerUser = { id: 'mgr-1', email: 'm@x', roles: ['manager'] };

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    cache = mockDeep<Cache>();
    const module = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();
    service = module.get(DashboardService);
  });

  describe('getAdminOverview', () => {
    it('should return cached result when key hit', async () => {
      cache.get.mockResolvedValue({
        total_employees: 30,
        total_branches: 3,
        today: {
          checked_in: 25,
          on_time: 20,
          late: 5,
          absent: 5,
          on_time_rate: 0.8,
        },
        top_branches_on_time: [],
        top_branches_late: [],
        checkin_heatmap: [],
      } as never);
      const result = await service.getAdminOverview();
      expect(result.total_employees).toBe(30);
      expect(prisma.employee.count).not.toHaveBeenCalled();
    });

    it('should compute KPIs and cache when miss', async () => {
      cache.get.mockResolvedValue(null);
      prisma.employee.count.mockResolvedValue(30);
      prisma.branch.count.mockResolvedValue(3);
      (prisma.dailyAttendanceSummary.groupBy as jest.Mock).mockResolvedValue([
        { status: 'on_time', _count: 20 },
        { status: 'late', _count: 4 },
        { status: 'absent', _count: 6 },
      ]);
      (prisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ hour: 8, count: 18 }])
        .mockResolvedValueOnce([
          {
            branch_id: 'b1',
            name: 'HCM-Q1',
            total: BigInt(10),
            on_time: BigInt(9),
            late: BigInt(1),
          },
        ]);

      const result = await service.getAdminOverview();
      expect(result.today.on_time).toBe(20);
      expect(result.today.absent).toBe(6);
      expect(result.checkin_heatmap[0].hour).toBe(8);
      expect(cache.set).toHaveBeenCalled();
    });
  });

  describe('getManagerBranch', () => {
    it('should throw NOT_FOUND when manager outside scope', async () => {
      prisma.employee.findFirst.mockResolvedValue({
        primaryBranchId: 'b-hcm',
        assignments: [],
      } as never);
      await expect(
        service.getManagerBranch(managerUser, 'b-other')
      ).rejects.toMatchObject({
        code: ErrorCode.NOT_FOUND,
      });
    });

    it('should bypass scope check when admin', async () => {
      cache.get.mockResolvedValue(null);
      prisma.branch.findUnique.mockResolvedValue({
        id: 'b-other',
        name: 'X',
      } as never);
      prisma.employee.count.mockResolvedValue(10);
      (prisma.dailyAttendanceSummary.groupBy as jest.Mock).mockResolvedValue(
        []
      );
      prisma.attendanceSession.findMany.mockResolvedValue([]);
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      const result = await service.getManagerBranch(adminUser, 'b-other');
      expect(result.branch.name).toBe('X');
    });
  });

  describe('getAnomalies', () => {
    it('should return empty when cache miss', async () => {
      cache.get.mockResolvedValue(undefined as never);
      const result = await service.getAnomalies(adminUser);
      expect(result.branches_late_spike).toEqual([]);
      expect(result.untrusted_devices_new_today).toBe(0);
    });

    it('should map cached anomaly to api shape', async () => {
      cache.get.mockResolvedValue({
        asOf: '2026-04-15',
        suspicious_employees: [{ employee_id: 'e1', count: 4 }],
        untrusted_devices: [{ employee_id: 'e1', device_id: 'd1' }],
        branches_high_late_rate: [
          { branch_id: 'b1', today_rate: 0.3, avg_7d: 0.1 },
        ],
      } as never);
      prisma.branch.findMany.mockResolvedValue([
        { id: 'b1', name: 'HCM-Q1' },
      ] as never);
      prisma.employee.findMany.mockResolvedValue([
        { id: 'e1', employeeCode: 'EMP-1', primaryBranchId: 'b1' },
      ] as never);

      const result = await service.getAnomalies(adminUser);
      expect(result.branches_late_spike[0].name).toBe('HCM-Q1');
      expect(result.branches_late_spike[0].spike_ratio).toBe(3);
      expect(result.employees_low_trust[0].code).toBe('EMP-1');
      expect(result.untrusted_devices_new_today).toBe(1);
    });

    it('should scope-filter anomalies for manager', async () => {
      cache.get.mockResolvedValue({
        asOf: '2026-04-15',
        suspicious_employees: [{ employee_id: 'e-other', count: 4 }],
        untrusted_devices: [{ employee_id: 'e-other', device_id: 'd1' }],
        branches_high_late_rate: [
          { branch_id: 'b-hcm', today_rate: 0.3, avg_7d: 0.1 },
          { branch_id: 'b-other', today_rate: 0.3, avg_7d: 0.1 },
        ],
      } as never);
      prisma.employee.findFirst.mockResolvedValue({
        primaryBranchId: 'b-hcm',
        assignments: [],
      } as never);
      prisma.branch.findMany.mockResolvedValue([
        { id: 'b-hcm', name: 'HCM' },
        { id: 'b-other', name: 'Other' },
      ] as never);
      prisma.employee.findMany.mockResolvedValue([
        { id: 'e-other', employeeCode: 'EMP-O', primaryBranchId: 'b-other' },
      ] as never);

      const result = await service.getAnomalies(managerUser);
      expect(result.branches_late_spike).toHaveLength(1);
      expect(result.branches_late_spike[0].branch_id).toBe('b-hcm');
      expect(result.employees_low_trust).toEqual([]);
      expect(result.untrusted_devices_new_today).toBe(0);
    });
  });
});
