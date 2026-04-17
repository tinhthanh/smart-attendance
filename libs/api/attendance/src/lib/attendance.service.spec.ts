import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import {
  BranchConfigCacheService,
  ErrorCode,
  PrismaService,
} from '@smart-attendance/api/common';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { AttendanceService } from './attendance.service';

describe('AttendanceService', () => {
  let service: AttendanceService;
  let prisma: DeepMockProxy<PrismaService>;
  let cache: DeepMockProxy<BranchConfigCacheService>;

  const employeeUser = {
    id: 'user-1',
    email: 'emp@x.com',
    roles: ['employee'],
  };

  const employeeRow = {
    id: 'emp-1',
    userId: 'user-1',
    primaryBranchId: 'br-hcm',
    employmentStatus: 'active' as const,
    primaryBranch: {
      id: 'br-hcm',
      name: 'HCM-Q1',
      status: 'active' as const,
      timezone: 'Asia/Ho_Chi_Minh',
    },
  };

  const cfg = {
    branchStatus: 'active' as const,
    timezone: 'Asia/Ho_Chi_Minh',
    geofences: [
      {
        centerLat: 10.7766,
        centerLng: 106.7009,
        radiusMeters: 150,
        isActive: true,
      },
    ],
    wifiConfigs: [
      { ssid: 'Office', bssid: 'aa:bb:cc:dd:ee:ff', isActive: true },
    ],
  };

  const scheduleRow = {
    id: 's-1',
    name: 'Standard 8h',
    startTime: '08:00',
    endTime: '17:00',
    graceMinutes: 10,
    overtimeAfterMinutes: 60,
    workdays: [1, 2, 3, 4, 5],
    createdAt: new Date(),
  };

  const deviceRow = {
    id: 'dev-1',
    employeeId: 'emp-1',
    deviceFingerprint: 'fp-abc',
    platform: 'ios' as const,
    deviceName: 'iPhone 14',
    appVersion: '1.0.0',
    isTrusted: false,
    lastSeenAt: null,
    createdAt: new Date(),
  };

  const validDto = {
    latitude: 10.7766,
    longitude: 106.7009,
    accuracy_meters: 10,
    ssid: 'Office',
    bssid: 'aa:bb:cc:dd:ee:ff',
    device_fingerprint: 'fp-abc',
    platform: 'ios' as const,
    is_mock_location: false,
  };

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    cache = mockDeep<BranchConfigCacheService>();
    const module = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: PrismaService, useValue: prisma },
        { provide: BranchConfigCacheService, useValue: cache },
      ],
    }).compile();
    service = module.get(AttendanceService);
  });

  describe('checkIn', () => {
    function setupHappyPath() {
      prisma.employee.findFirst.mockResolvedValue(employeeRow as never);
      cache.get.mockResolvedValue(cfg);
      prisma.workScheduleAssignment.findFirst.mockResolvedValue({
        schedule: scheduleRow,
      } as never);
      prisma.employeeDevice.findUnique.mockResolvedValue(deviceRow as never);
      prisma.employeeDevice.update.mockResolvedValue(deviceRow as never);
      prisma.attendanceEvent.findFirst.mockResolvedValue(null);
      (prisma.$transaction as jest.Mock).mockImplementation(
        async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)
      );
    }

    it('should return 201 payload with trusted level when valid GPS and BSSID match', async () => {
      setupHappyPath();
      prisma.attendanceSession.findUnique.mockResolvedValue(null);
      prisma.attendanceSession.upsert.mockResolvedValue({
        id: 'sess-1',
        employeeId: 'emp-1',
        branchId: 'br-hcm',
        workDate: new Date('2026-04-17T00:00:00.000Z'),
        checkInAt: new Date(),
        status: 'on_time',
        trustScore: 90,
      } as never);
      prisma.attendanceEvent.create.mockResolvedValue({ id: 'evt-1' } as never);

      const result = await service.checkIn(employeeUser, validDto, {});
      expect(result.session_id).toBe('sess-1');
      expect(result.trust_level).toBe('trusted');
      expect(result.validation_method).toBe('gps_wifi');
      expect(result.risk_flags).toContain('bssid_match');
    });

    it('should throw INVALID_LOCATION and persist failed event when outside geofence and wifi mismatch', async () => {
      setupHappyPath();
      prisma.attendanceEvent.create.mockResolvedValue({
        id: 'failed-evt',
      } as never);

      const badDto = {
        ...validDto,
        latitude: 21.0285,
        longitude: 105.8542, // Hanoi
        ssid: 'UnknownSsid',
        bssid: 'ff:ff:ff:ff:ff:ff',
      };
      await expect(
        service.checkIn(employeeUser, badDto, {})
      ).rejects.toMatchObject({
        code: ErrorCode.INVALID_LOCATION,
      });
      expect(prisma.attendanceEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'failed',
            validationMethod: 'none',
          }),
        })
      );
      expect(prisma.attendanceSession.upsert).not.toHaveBeenCalled();
    });

    it('should throw ALREADY_CHECKED_IN when session already has checkInAt', async () => {
      setupHappyPath();
      prisma.attendanceSession.findUnique.mockResolvedValue({
        id: 'sess-existing',
        checkInAt: new Date(),
      } as never);
      await expect(
        service.checkIn(employeeUser, validDto, {})
      ).rejects.toMatchObject({
        code: ErrorCode.ALREADY_CHECKED_IN,
      });
    });

    it('should throw NOT_ASSIGNED_TO_BRANCH when employee has no active branch', async () => {
      prisma.employee.findFirst.mockResolvedValue(null);
      await expect(
        service.checkIn(employeeUser, validDto, {})
      ).rejects.toMatchObject({
        code: ErrorCode.NOT_ASSIGNED_TO_BRANCH,
      });
    });
  });

  describe('checkOut', () => {
    it('should throw NOT_CHECKED_IN_YET when session missing checkInAt', async () => {
      prisma.employee.findFirst.mockResolvedValue(employeeRow as never);
      cache.get.mockResolvedValue(cfg);
      prisma.workScheduleAssignment.findFirst.mockResolvedValue({
        schedule: scheduleRow,
      } as never);
      prisma.employeeDevice.findUnique.mockResolvedValue(deviceRow as never);
      prisma.attendanceEvent.findFirst.mockResolvedValue(null);
      (prisma.$transaction as jest.Mock).mockImplementation(
        async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)
      );
      prisma.attendanceSession.findUnique.mockResolvedValue(null);

      await expect(
        service.checkOut(employeeUser, validDto, {})
      ).rejects.toMatchObject({
        code: ErrorCode.NOT_CHECKED_IN_YET,
      });
    });

    it('should throw ALREADY_CHECKED_OUT when session has checkOutAt set', async () => {
      prisma.employee.findFirst.mockResolvedValue(employeeRow as never);
      cache.get.mockResolvedValue(cfg);
      prisma.workScheduleAssignment.findFirst.mockResolvedValue({
        schedule: scheduleRow,
      } as never);
      prisma.employeeDevice.findUnique.mockResolvedValue(deviceRow as never);
      prisma.attendanceEvent.findFirst.mockResolvedValue(null);
      (prisma.$transaction as jest.Mock).mockImplementation(
        async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)
      );
      prisma.attendanceSession.findUnique.mockResolvedValue({
        id: 'sess-1',
        checkInAt: new Date(Date.now() - 60 * 60_000),
        checkOutAt: new Date(),
        status: 'on_time',
        trustScore: 90,
      } as never);

      await expect(
        service.checkOut(employeeUser, validDto, {})
      ).rejects.toMatchObject({
        code: ErrorCode.ALREADY_CHECKED_OUT,
      });
    });

    it('should compute worked_minutes when check-out after check-in', async () => {
      prisma.employee.findFirst.mockResolvedValue(employeeRow as never);
      cache.get.mockResolvedValue(cfg);
      prisma.workScheduleAssignment.findFirst.mockResolvedValue({
        schedule: scheduleRow,
      } as never);
      prisma.employeeDevice.findUnique.mockResolvedValue(deviceRow as never);
      prisma.attendanceEvent.findFirst.mockResolvedValue(null);
      (prisma.$transaction as jest.Mock).mockImplementation(
        async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)
      );
      const checkInAt = new Date(Date.now() - 8 * 60 * 60_000); // 8 hours ago
      prisma.attendanceSession.findUnique.mockResolvedValue({
        id: 'sess-1',
        checkInAt,
        checkOutAt: null,
        status: 'on_time',
        trustScore: 90,
      } as never);
      prisma.attendanceSession.update.mockResolvedValue({
        id: 'sess-1',
        checkOutAt: new Date(),
        workedMinutes: 480,
        overtimeMinutes: 0,
      } as never);
      prisma.attendanceEvent.create.mockResolvedValue({
        id: 'evt-out',
      } as never);
      prisma.employeeDevice.update.mockResolvedValue(deviceRow as never);

      const result = await service.checkOut(employeeUser, validDto, {});
      expect(result.worked_minutes).toBeGreaterThanOrEqual(475);
      expect(result.worked_minutes).toBeLessThanOrEqual(485);
    });
  });
});
void Prisma;
