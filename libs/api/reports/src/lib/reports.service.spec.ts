import { getQueueToken } from '@nestjs/bullmq';
import { HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  BusinessException,
  ErrorCode,
  PrismaService,
} from '@smart-attendance/api/common';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { Queue } from 'bullmq';
import { REPORTS_QUEUE } from './reports.constants';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: DeepMockProxy<PrismaService>;
  let queue: DeepMockProxy<Queue>;

  const adminUser = { id: 'admin-1', email: 'a@x', roles: ['admin'] };
  const managerUser = { id: 'mgr-1', email: 'm@x', roles: ['manager'] };
  const branchInScope = '11111111-1111-1111-1111-111111111111';
  const branchOutOfScope = '22222222-2222-2222-2222-222222222222';

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    queue = mockDeep<Queue>();
    const module = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: getQueueToken(REPORTS_QUEUE), useValue: queue },
      ],
    }).compile();
    service = module.get(ReportsService);
  });

  describe('createExportJob', () => {
    it('admin can create export for any branch', async () => {
      queue.add.mockResolvedValue({ id: 'generated' } as never);
      const res = await service.createExportJob(adminUser, {
        type: 'attendance_csv',
        branch_id: branchOutOfScope,
        date_from: '2026-04-01',
        date_to: '2026-04-15',
      });
      expect(res.status).toBe('queued');
      expect(res.job_id).toBeDefined();
      expect(queue.add).toHaveBeenCalledTimes(1);
      const call = queue.add.mock.calls[0];
      expect(call[0]).toBe('attendance-csv');
      const payload = call[1] as Record<string, unknown>;
      expect(payload['requestedBy']).toBe(adminUser.id);
      expect((payload['filters'] as { branchId: string }).branchId).toBe(
        branchOutOfScope
      );
    });

    it('rejects date_from > date_to', async () => {
      await expect(
        service.createExportJob(adminUser, {
          type: 'attendance_csv',
          date_from: '2026-04-20',
          date_to: '2026-04-10',
        })
      ).rejects.toMatchObject({
        code: ErrorCode.VALIDATION_FAILED,
        httpStatus: HttpStatus.BAD_REQUEST,
      });
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('manager must provide branch_id', async () => {
      (prisma.employee.findFirst as jest.Mock).mockResolvedValue({
        primaryBranchId: branchInScope,
        assignments: [],
      });
      await expect(
        service.createExportJob(managerUser, {
          type: 'attendance_csv',
          date_from: '2026-04-01',
          date_to: '2026-04-15',
        })
      ).rejects.toBeInstanceOf(BusinessException);
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('manager cannot export branch outside scope', async () => {
      (prisma.employee.findFirst as jest.Mock).mockResolvedValue({
        primaryBranchId: branchInScope,
        assignments: [],
      });
      await expect(
        service.createExportJob(managerUser, {
          type: 'attendance_csv',
          branch_id: branchOutOfScope,
          date_from: '2026-04-01',
          date_to: '2026-04-15',
        })
      ).rejects.toMatchObject({
        code: ErrorCode.FORBIDDEN,
        httpStatus: HttpStatus.FORBIDDEN,
      });
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('manager can export branch in scope', async () => {
      (prisma.employee.findFirst as jest.Mock).mockResolvedValue({
        primaryBranchId: branchInScope,
        assignments: [],
      });
      queue.add.mockResolvedValue({ id: 'generated' } as never);
      const res = await service.createExportJob(managerUser, {
        type: 'attendance_csv',
        branch_id: branchInScope,
        date_from: '2026-04-01',
        date_to: '2026-04-15',
      });
      expect(res.status).toBe('queued');
      expect(queue.add).toHaveBeenCalled();
    });
  });

  describe('getJobStatus', () => {
    it('returns completed with download_url when job finished', async () => {
      const jobId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
      queue.getJob.mockResolvedValue({
        id: jobId,
        data: {
          jobId,
          type: 'attendance_csv',
          filters: { dateFrom: '2026-04-01', dateTo: '2026-04-15' },
          requestedBy: adminUser.id,
        },
        returnvalue: {
          filePath: '/tmp/x.csv',
          rowCount: 42,
          fileSizeBytes: 1024,
          expiresAt: '2026-04-16T10:00:00.000Z',
          durationMs: 100,
        },
        getState: jest.fn().mockResolvedValue('completed'),
      } as never);
      const res = await service.getJobStatus(adminUser, jobId);
      expect(res.status).toBe('completed');
      expect(res.download_url).toBe(`/api/v1/reports/export/${jobId}/download`);
      expect(res.row_count).toBe(42);
      expect(res.expires_at).toBe('2026-04-16T10:00:00.000Z');
    });

    it('returns queued without download_url when pending', async () => {
      const jobId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
      queue.getJob.mockResolvedValue({
        id: jobId,
        data: {
          jobId,
          type: 'attendance_csv',
          filters: { dateFrom: '2026-04-01', dateTo: '2026-04-15' },
          requestedBy: adminUser.id,
        },
        getState: jest.fn().mockResolvedValue('waiting'),
      } as never);
      const res = await service.getJobStatus(adminUser, jobId);
      expect(res.status).toBe('queued');
      expect(res.download_url).toBeUndefined();
    });

    it('NOT_FOUND when missing', async () => {
      queue.getJob.mockResolvedValue(undefined as never);
      await expect(
        service.getJobStatus(adminUser, 'missing')
      ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
    });

    it('hides other users jobs behind NOT_FOUND for non-admin', async () => {
      queue.getJob.mockResolvedValue({
        id: 'j',
        data: {
          jobId: 'j',
          type: 'attendance_csv',
          filters: { dateFrom: '2026-04-01', dateTo: '2026-04-15' },
          requestedBy: 'someone-else',
        },
        getState: jest.fn().mockResolvedValue('completed'),
      } as never);
      await expect(
        service.getJobStatus(managerUser, 'j')
      ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
    });
  });
});
