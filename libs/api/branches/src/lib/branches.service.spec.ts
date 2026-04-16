import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import {
  AuditLogService,
  BranchConfigCacheService,
  BusinessException,
  ErrorCode,
  PrismaService,
} from '@smart-attendance/api/common';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { BranchesService } from './branches.service';

describe('BranchesService', () => {
  let service: BranchesService;
  let prisma: DeepMockProxy<PrismaService>;
  let audit: DeepMockProxy<AuditLogService>;
  let cache: DeepMockProxy<BranchConfigCacheService>;

  const adminUser = { id: 'admin-1', email: 'admin@x', roles: ['admin'] };
  const managerUser = { id: 'manager-1', email: 'mgr@x', roles: ['manager'] };

  const branchRow = {
    id: 'br-1',
    code: 'HCM-Q1',
    name: 'HCM Q1',
    address: '123 Le Loi',
    latitude: new Prisma.Decimal('10.7766'),
    longitude: new Prisma.Decimal('106.7009'),
    radiusMeters: 150,
    timezone: 'Asia/Ho_Chi_Minh',
    status: 'active' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { primaryEmployees: 5 },
  };

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    audit = mockDeep<AuditLogService>();
    cache = mockDeep<BranchConfigCacheService>();
    const module = await Test.createTestingModule({
      providers: [
        BranchesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: audit },
        { provide: BranchConfigCacheService, useValue: cache },
      ],
    }).compile();
    service = module.get(BranchesService);
  });

  describe('list', () => {
    it('should return all branches when user has admin role', async () => {
      (prisma.$transaction as jest.Mock).mockResolvedValue([1, [branchRow]]);
      const result = await service.list(adminUser, { page: 1, limit: 20 });
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      });
      expect(result.data[0].code).toBe('HCM-Q1');
      expect(result.data[0].employee_count).toBe(5);
    });

    it('should return only assigned branches when user has manager role', async () => {
      (prisma.$transaction as jest.Mock).mockResolvedValue([1, [branchRow]]);
      prisma.employee.findFirst.mockResolvedValue({
        primaryBranchId: 'br-1',
        assignments: [],
      } as never);
      const result = await service.list(managerUser, { page: 1, limit: 20 });
      expect(prisma.employee.findFirst).toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
    });

    it('should scope to no branches when manager has no employee record', async () => {
      prisma.employee.findFirst.mockResolvedValue(null);
      (prisma.$transaction as jest.Mock).mockResolvedValue([0, []]);
      const result = await service.list(managerUser, { page: 1, limit: 20 });
      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });

    it('should apply pagination meta correctly when page 2 requested', async () => {
      (prisma.$transaction as jest.Mock).mockResolvedValue([45, []]);
      const result = await service.list(adminUser, { page: 2, limit: 20 });
      expect(result.meta).toEqual({
        page: 2,
        limit: 20,
        total: 45,
        total_pages: 3,
      });
    });
  });

  describe('create', () => {
    it('should create branch and log audit when admin calls create', async () => {
      (prisma.$transaction as jest.Mock).mockImplementation(
        async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)
      );
      prisma.branch.findUnique.mockResolvedValue(null);
      prisma.branch.create.mockResolvedValue({
        ...branchRow,
        _count: undefined,
      } as never);

      const result = await service.create(
        adminUser,
        {
          code: 'HCM-Q1',
          name: 'HCM Q1',
          latitude: 10.7766,
          longitude: 106.7009,
        },
        {}
      );
      expect(result.code).toBe('HCM-Q1');
      const [, auditPayload] = audit.logInTransaction.mock.calls[0] ?? [];
      expect(auditPayload).toMatchObject({
        action: 'create',
        entityType: 'Branch',
      });
    });

    it('should throw CONFLICT when branch code already exists', async () => {
      (prisma.$transaction as jest.Mock).mockImplementation(
        async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)
      );
      prisma.branch.findUnique.mockResolvedValue(branchRow as never);
      await expect(
        service.create(
          adminUser,
          { code: 'HCM-Q1', name: 'x', latitude: 10, longitude: 106 },
          {}
        )
      ).rejects.toMatchObject({ code: ErrorCode.CONFLICT });
    });
  });

  describe('softDelete', () => {
    it('should throw BRANCH_HAS_ACTIVE_EMPLOYEES when active employees exist', async () => {
      (prisma.$transaction as jest.Mock).mockImplementation(
        async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)
      );
      prisma.branch.findUnique.mockResolvedValue(branchRow as never);
      prisma.employee.count.mockResolvedValue(3);
      await expect(
        service.softDelete(adminUser, 'br-1', {})
      ).rejects.toMatchObject({
        code: ErrorCode.BRANCH_HAS_ACTIVE_EMPLOYEES,
      });
    });

    it('should soft delete and log audit when no active employees', async () => {
      (prisma.$transaction as jest.Mock).mockImplementation(
        async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)
      );
      prisma.branch.findUnique.mockResolvedValue(branchRow as never);
      prisma.employee.count.mockResolvedValue(0);
      prisma.branch.update.mockResolvedValue({
        ...branchRow,
        status: 'inactive',
      } as never);
      const result = await service.softDelete(adminUser, 'br-1', {});
      expect(result).toEqual({ success: true });
      const [, deletePayload] = audit.logInTransaction.mock.calls[0] ?? [];
      expect(deletePayload).toMatchObject({
        action: 'delete',
        entityType: 'Branch',
      });
    });

    it('should throw FORBIDDEN when non-admin calls softDelete', async () => {
      await expect(
        service.softDelete(managerUser, 'br-1', {})
      ).rejects.toBeInstanceOf(BusinessException);
    });
  });

  describe('assertScope', () => {
    it('should pass when admin accesses any branch', async () => {
      await expect(
        service.assertScope(adminUser, 'any')
      ).resolves.toBeUndefined();
    });

    it('should throw NOT_FOUND when manager accesses branch outside scope', async () => {
      prisma.employee.findFirst.mockResolvedValue({
        primaryBranchId: 'br-1',
        assignments: [],
      } as never);
      await expect(
        service.assertScope(managerUser, 'br-999')
      ).rejects.toMatchObject({
        code: ErrorCode.NOT_FOUND,
      });
    });
  });
});
