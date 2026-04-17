import { Test } from '@nestjs/testing';
import {
  AuditLogService,
  ErrorCode,
  PrismaService,
} from '@smart-attendance/api/common';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { EmployeesService } from './employees.service';

describe('EmployeesService', () => {
  let service: EmployeesService;
  let prisma: DeepMockProxy<PrismaService>;
  let audit: DeepMockProxy<AuditLogService>;

  const adminUser = { id: 'admin-1', email: 'admin@x', roles: ['admin'] };
  const managerUser = { id: 'manager-1', email: 'mgr@x', roles: ['manager'] };

  const baseEmp = {
    id: 'emp-1',
    employeeCode: 'EMP-001',
    employmentStatus: 'active' as const,
    primaryBranchId: 'br-hcm',
    departmentId: 'dep-1',
    userId: 'u-1',
    user: { id: 'u-1', email: 'a@x.com', fullName: 'Alice', phone: null },
    primaryBranch: { id: 'br-hcm', name: 'HCM-Q1' },
    department: { id: 'dep-1', name: 'Engineering' },
    createdAt: new Date(),
    updatedAt: new Date(),
    joinedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    audit = mockDeep<AuditLogService>();
    const module = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: audit },
      ],
    }).compile();
    service = module.get(EmployeesService);
  });

  describe('list', () => {
    it('should return all employees when user has admin role', async () => {
      (prisma.$transaction as jest.Mock).mockResolvedValue([1, [baseEmp]]);
      const result = await service.list(adminUser, { page: 1, limit: 20 });
      expect(result.meta.total).toBe(1);
      expect(result.data[0].user).not.toHaveProperty('passwordHash');
    });

    it('should scope by manager branches when user has manager role', async () => {
      prisma.employee.findFirst.mockResolvedValue({
        primaryBranchId: 'br-hcm',
        assignments: [],
      } as never);
      (prisma.$transaction as jest.Mock).mockResolvedValue([1, [baseEmp]]);
      const result = await service.list(managerUser, { page: 1, limit: 20 });
      expect(prisma.employee.findFirst).toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
    });

    it('should throw NOT_FOUND when manager queries branch_id outside scope', async () => {
      prisma.employee.findFirst.mockResolvedValue({
        primaryBranchId: 'br-hcm',
        assignments: [],
      } as never);
      await expect(
        service.list(managerUser, { page: 1, limit: 20, branch_id: 'br-other' })
      ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
    });
  });

  describe('create', () => {
    const validDto = {
      email: 'new@x.com',
      password: 'Pass1234',
      full_name: 'New Emp',
      employee_code: 'EMP-100',
      primary_branch_id: 'br-hcm',
      role: 'employee' as const,
    };

    it('should create user employee userRole atomically when admin calls create', async () => {
      (prisma.$transaction as jest.Mock).mockImplementation(
        async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)
      );
      prisma.branch.findUnique.mockResolvedValue({ id: 'br-hcm' } as never);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.employee.findUnique.mockResolvedValue(null);
      prisma.role.findUnique.mockResolvedValue({
        id: 'r-emp',
        code: 'employee',
      } as never);
      prisma.user.create.mockResolvedValue({
        id: 'u-new',
        email: 'new@x.com',
      } as never);
      prisma.userRole.create.mockResolvedValue({} as never);
      prisma.employee.create.mockResolvedValue(baseEmp as never);

      const result = await service.create(adminUser, validDto, {});
      expect(result.employee_code).toBe('EMP-001');
      expect(prisma.user.create).toHaveBeenCalled();
      expect(prisma.userRole.create).toHaveBeenCalled();
      expect(prisma.employee.create).toHaveBeenCalled();
      const [, auditPayload] = audit.logInTransaction.mock.calls[0] ?? [];
      expect(auditPayload).toMatchObject({
        action: 'create',
        entityType: 'Employee',
      });
    });

    it('should throw NOT_FOUND when primary_branch_id does not exist', async () => {
      (prisma.$transaction as jest.Mock).mockImplementation(
        async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)
      );
      prisma.branch.findUnique.mockResolvedValue(null);
      await expect(
        service.create(adminUser, validDto, {})
      ).rejects.toMatchObject({
        code: ErrorCode.NOT_FOUND,
      });
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('should throw EMAIL_TAKEN when email already exists', async () => {
      (prisma.$transaction as jest.Mock).mockImplementation(
        async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)
      );
      prisma.branch.findUnique.mockResolvedValue({ id: 'br-hcm' } as never);
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' } as never);
      prisma.employee.findUnique.mockResolvedValue(null);
      await expect(
        service.create(adminUser, validDto, {})
      ).rejects.toMatchObject({
        code: ErrorCode.EMAIL_TAKEN,
      });
    });

    it('should throw EMPLOYEE_CODE_TAKEN when code already exists', async () => {
      (prisma.$transaction as jest.Mock).mockImplementation(
        async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)
      );
      prisma.branch.findUnique.mockResolvedValue({ id: 'br-hcm' } as never);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.employee.findUnique.mockResolvedValue(baseEmp as never);
      await expect(
        service.create(adminUser, validDto, {})
      ).rejects.toMatchObject({
        code: ErrorCode.EMPLOYEE_CODE_TAKEN,
      });
    });

    it('should throw FORBIDDEN when non-admin calls create', async () => {
      await expect(
        service.create(managerUser, validDto, {})
      ).rejects.toMatchObject({
        code: ErrorCode.FORBIDDEN,
      });
    });
  });

  describe('update', () => {
    it('should set employment_status to terminated when admin calls update', async () => {
      (prisma.$transaction as jest.Mock).mockImplementation(
        async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)
      );
      prisma.employee.findUnique.mockResolvedValue({
        ...baseEmp,
        user: { fullName: 'Alice', phone: null },
      } as never);
      prisma.employee.update.mockResolvedValue({
        ...baseEmp,
        employmentStatus: 'terminated',
      } as never);

      const result = await service.update(
        adminUser,
        'emp-1',
        { employment_status: 'terminated' },
        {}
      );
      expect(result.employment_status).toBe('terminated');
    });
  });

  describe('assertEmployeeScope', () => {
    it('should pass when admin accesses any employee', async () => {
      await expect(
        service.assertEmployeeScope(adminUser, 'any')
      ).resolves.toBeUndefined();
    });

    it('should throw NOT_FOUND when manager accesses employee outside scope', async () => {
      prisma.employee.findFirst.mockResolvedValue({
        primaryBranchId: 'br-hcm',
        assignments: [],
      } as never);
      prisma.employee.findUnique.mockResolvedValue({
        primaryBranchId: 'br-other',
        assignments: [],
      } as never);
      await expect(
        service.assertEmployeeScope(managerUser, 'emp-other')
      ).rejects.toMatchObject({
        code: ErrorCode.NOT_FOUND,
      });
    });
  });
});
