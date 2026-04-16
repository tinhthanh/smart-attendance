import { HttpStatus, Injectable, Logger } from '@nestjs/common';
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
import * as bcrypt from 'bcrypt';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { ListEmployeesQueryDto } from './dto/list-employees-query.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

export interface RequestCtx {
  ipAddress?: string;
  userAgent?: string;
}

const BCRYPT_ROUNDS = 10;

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService
  ) {}

  async list(user: UserRolesContext, query: ListEmployeesQueryDto) {
    const { page, limit, branch_id, department_id, status, search } = query;
    const where: Prisma.EmployeeWhereInput = {};
    if (department_id) where.departmentId = department_id;
    if (status) where.employmentStatus = status;
    if (search) {
      where.OR = [
        { employeeCode: { contains: search, mode: 'insensitive' } },
        { user: { fullName: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    let scopeIds: string[] | null = null;
    if (!isAdmin(user)) {
      scopeIds = await getManagerBranchIds(this.prisma, user.id);
    }
    if (branch_id) {
      if (scopeIds && !scopeIds.includes(branch_id)) {
        throw new BusinessException(
          ErrorCode.NOT_FOUND,
          HttpStatus.NOT_FOUND,
          'Branch not found'
        );
      }
      where.primaryBranchId = branch_id;
    } else if (scopeIds) {
      where.primaryBranchId = {
        in: scopeIds.length > 0 ? scopeIds : ['__none__'],
      };
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.employee.count({ where }),
      this.prisma.employee.findMany({
        where,
        take: limit,
        skip: (page - 1) * limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, email: true, fullName: true, phone: true },
          },
          primaryBranch: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
        },
      }),
    ]);

    return {
      data: rows.map((r) => this.toEmployeeResponse(r)),
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async getOne(user: UserRolesContext, id: string) {
    await this.assertEmployeeScope(user, id);
    const emp = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, email: true, fullName: true, phone: true },
        },
        primaryBranch: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    });
    if (!emp) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        HttpStatus.NOT_FOUND,
        'Employee not found'
      );
    }
    return this.toEmployeeResponse(emp);
  }

  async create(
    user: UserRolesContext,
    dto: CreateEmployeeDto,
    ctx: RequestCtx
  ) {
    if (!isAdmin(user)) {
      throw new BusinessException(
        ErrorCode.FORBIDDEN,
        HttpStatus.FORBIDDEN,
        'Admin only'
      );
    }
    return this.prisma.$transaction(async (tx) => {
      // 1. Validate branch + department exist
      const [branch, dept] = await Promise.all([
        tx.branch.findUnique({ where: { id: dto.primary_branch_id } }),
        dto.department_id
          ? tx.department.findUnique({ where: { id: dto.department_id } })
          : null,
      ]);
      if (!branch) {
        throw new BusinessException(
          ErrorCode.NOT_FOUND,
          HttpStatus.NOT_FOUND,
          `Branch ${dto.primary_branch_id} not found`
        );
      }
      if (dto.department_id && !dept) {
        throw new BusinessException(
          ErrorCode.NOT_FOUND,
          HttpStatus.NOT_FOUND,
          `Department ${dto.department_id} not found`
        );
      }

      // 2. Uniqueness
      const [dupEmail, dupCode] = await Promise.all([
        tx.user.findUnique({ where: { email: dto.email } }),
        tx.employee.findUnique({ where: { employeeCode: dto.employee_code } }),
      ]);
      if (dupEmail) {
        throw new BusinessException(
          ErrorCode.EMAIL_TAKEN,
          HttpStatus.CONFLICT,
          'Email already taken',
          { field: 'email', value: dto.email }
        );
      }
      if (dupCode) {
        throw new BusinessException(
          ErrorCode.EMPLOYEE_CODE_TAKEN,
          HttpStatus.CONFLICT,
          'Employee code already taken',
          { field: 'employee_code', value: dto.employee_code }
        );
      }

      // 3. Role lookup
      const role = await tx.role.findUnique({ where: { code: dto.role } });
      if (!role) {
        throw new BusinessException(
          ErrorCode.VALIDATION_FAILED,
          HttpStatus.BAD_REQUEST,
          `Role ${dto.role} is not seeded`
        );
      }

      // 4. Create user
      const newUser = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash: bcrypt.hashSync(dto.password, BCRYPT_ROUNDS),
          fullName: dto.full_name,
          phone: dto.phone,
        },
      });

      // 5. UserRole
      await tx.userRole.create({
        data: { userId: newUser.id, roleId: role.id },
      });

      // 6. Employee
      const emp = await tx.employee.create({
        data: {
          userId: newUser.id,
          employeeCode: dto.employee_code,
          primaryBranchId: dto.primary_branch_id,
          departmentId: dto.department_id,
        },
        include: {
          user: {
            select: { id: true, email: true, fullName: true, phone: true },
          },
          primaryBranch: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
        },
      });

      // 7. Audit — admin creating admin: explicit note
      const auditNote =
        dto.role === 'admin'
          ? `Super-admin creation: actor=${user.id} created admin=${newUser.email}`
          : undefined;
      await this.audit.logInTransaction(tx, {
        userId: user.id,
        action: 'create',
        entityType: 'Employee',
        entityId: emp.id,
        after: {
          user_id: newUser.id,
          email: newUser.email,
          employee_code: emp.employeeCode,
          role: dto.role,
          primary_branch_id: emp.primaryBranchId,
          department_id: emp.departmentId,
          ...(auditNote ? { note: auditNote } : {}),
        },
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });

      if (auditNote) this.logger.warn(auditNote);
      return this.toEmployeeResponse(emp);
    });
  }

  async update(
    user: UserRolesContext,
    id: string,
    dto: UpdateEmployeeDto,
    ctx: RequestCtx
  ) {
    if (!isAdmin(user)) {
      throw new BusinessException(
        ErrorCode.FORBIDDEN,
        HttpStatus.FORBIDDEN,
        'Admin only'
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.employee.findUnique({
        where: { id },
        include: { user: { select: { fullName: true, phone: true } } },
      });
      if (!before) {
        throw new BusinessException(
          ErrorCode.NOT_FOUND,
          HttpStatus.NOT_FOUND,
          'Employee not found'
        );
      }

      const empData: Prisma.EmployeeUpdateInput = {};
      if (dto.primary_branch_id !== undefined) {
        const branch = await tx.branch.findUnique({
          where: { id: dto.primary_branch_id },
        });
        if (!branch) {
          throw new BusinessException(
            ErrorCode.NOT_FOUND,
            HttpStatus.NOT_FOUND,
            'Branch not found'
          );
        }
        empData.primaryBranch = { connect: { id: dto.primary_branch_id } };
      }
      if (dto.department_id !== undefined) {
        empData.department = dto.department_id
          ? { connect: { id: dto.department_id } }
          : { disconnect: true };
      }
      if (dto.employment_status !== undefined)
        empData.employmentStatus = dto.employment_status;

      const userData: Prisma.UserUpdateInput = {};
      if (dto.full_name !== undefined) userData.fullName = dto.full_name;
      if (dto.phone !== undefined) userData.phone = dto.phone;

      if (Object.keys(userData).length > 0) {
        await tx.user.update({ where: { id: before.userId }, data: userData });
      }
      const after = await tx.employee.update({
        where: { id },
        data: empData,
        include: {
          user: {
            select: { id: true, email: true, fullName: true, phone: true },
          },
          primaryBranch: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
        },
      });

      await this.audit.logInTransaction(tx, {
        userId: user.id,
        action: 'update',
        entityType: 'Employee',
        entityId: id,
        before: {
          employment_status: before.employmentStatus,
          primary_branch_id: before.primaryBranchId,
          department_id: before.departmentId,
          full_name: before.user.fullName,
          phone: before.user.phone,
        },
        after: {
          employment_status: after.employmentStatus,
          primary_branch_id: after.primaryBranchId,
          department_id: after.departmentId,
          full_name: after.user.fullName,
          phone: after.user.phone,
        },
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });

      return this.toEmployeeResponse(after);
    });
  }

  async assertEmployeeScope(
    user: UserRolesContext,
    employeeId: string
  ): Promise<void> {
    if (isAdmin(user)) return;
    const scopeIds = await getManagerBranchIds(this.prisma, user.id);
    const emp = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        primaryBranchId: true,
        assignments: { select: { branchId: true } },
      },
    });
    if (!emp) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        HttpStatus.NOT_FOUND,
        'Employee not found'
      );
    }
    const empBranches = [
      emp.primaryBranchId,
      ...emp.assignments.map((a) => a.branchId),
    ];
    if (!empBranches.some((b) => scopeIds.includes(b))) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        HttpStatus.NOT_FOUND,
        'Employee not found'
      );
    }
  }

  private toEmployeeResponse(emp: {
    id: string;
    employeeCode: string;
    employmentStatus: string;
    primaryBranchId: string;
    departmentId: string | null;
    user: { id: string; email: string; fullName: string; phone: string | null };
    primaryBranch: { id: string; name: string } | null;
    department: { id: string; name: string } | null;
  }) {
    return {
      id: emp.id,
      employee_code: emp.employeeCode,
      employment_status: emp.employmentStatus,
      user: {
        id: emp.user.id,
        email: emp.user.email,
        full_name: emp.user.fullName,
        phone: emp.user.phone,
      },
      primary_branch: emp.primaryBranch
        ? { id: emp.primaryBranch.id, name: emp.primaryBranch.name }
        : null,
      department: emp.department
        ? { id: emp.department.id, name: emp.department.name }
        : null,
    };
  }
}
