import { HttpStatus, Injectable } from '@nestjs/common';
import {
  AuditLogService,
  BusinessException,
  ErrorCode,
  PrismaService,
  UserRolesContext,
  isAdmin,
} from '@smart-attendance/api/common';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { RequestCtx } from './employees.service';

@Injectable()
export class EmployeeAssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService
  ) {}

  async create(
    user: UserRolesContext,
    employeeId: string,
    dto: CreateAssignmentDto,
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
      const emp = await tx.employee.findUnique({ where: { id: employeeId } });
      if (!emp) {
        throw new BusinessException(
          ErrorCode.NOT_FOUND,
          HttpStatus.NOT_FOUND,
          'Employee not found'
        );
      }
      const branch = await tx.branch.findUnique({
        where: { id: dto.branch_id },
      });
      if (!branch) {
        throw new BusinessException(
          ErrorCode.NOT_FOUND,
          HttpStatus.NOT_FOUND,
          'Branch not found'
        );
      }

      const row = await tx.employeeBranchAssignment.create({
        data: {
          employeeId,
          branchId: dto.branch_id,
          assignmentType: dto.assignment_type,
          effectiveFrom: new Date(dto.effective_from),
          effectiveTo: dto.effective_to ? new Date(dto.effective_to) : null,
        },
      });
      await this.audit.logInTransaction(tx, {
        userId: user.id,
        action: 'create',
        entityType: 'EmployeeBranchAssignment',
        entityId: row.id,
        after: {
          employee_id: employeeId,
          branch_id: dto.branch_id,
          assignment_type: dto.assignment_type,
          effective_from: dto.effective_from,
          effective_to: dto.effective_to ?? null,
        },
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      return {
        id: row.id,
        employee_id: employeeId,
        branch_id: dto.branch_id,
        assignment_type: dto.assignment_type,
        effective_from: dto.effective_from,
        effective_to: dto.effective_to ?? null,
      };
    });
  }
}
