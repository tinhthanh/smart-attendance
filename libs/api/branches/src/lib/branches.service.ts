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
import { CreateBranchDto } from './dto/create-branch.dto';
import { ListBranchesQueryDto } from './dto/list-branches-query.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

export interface RequestCtx {
  ipAddress?: string;
  userAgent?: string;
}

type BranchRow = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  latitude: Prisma.Decimal;
  longitude: Prisma.Decimal;
  radiusMeters: number;
  timezone: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService
  ) {}

  async list(user: UserRolesContext, query: ListBranchesQueryDto) {
    const { page, limit, status, search } = query;
    const where: Prisma.BranchWhereInput = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (!isAdmin(user)) {
      const ids = await getManagerBranchIds(this.prisma, user.id);
      where.id = { in: ids.length > 0 ? ids : ['__none__'] };
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.branch.count({ where }),
      this.prisma.branch.findMany({
        where,
        take: limit,
        skip: (page - 1) * limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              primaryEmployees: { where: { employmentStatus: 'active' } },
            },
          },
        },
      }),
    ]);

    return {
      data: rows.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        address: r.address,
        latitude: r.latitude.toNumber(),
        longitude: r.longitude.toNumber(),
        status: r.status,
        employee_count: r._count.primaryEmployees,
      })),
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async getOne(user: UserRolesContext, id: string) {
    await this.assertScope(user, id);
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: {
        wifiConfigs: { orderBy: { priority: 'desc' } },
        geofences: { where: { isActive: true } },
      },
    });
    if (!branch) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        HttpStatus.NOT_FOUND,
        'Branch not found'
      );
    }
    return this.toBranchResponse(branch);
  }

  async create(user: UserRolesContext, dto: CreateBranchDto, ctx: RequestCtx) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.branch.findUnique({
        where: { code: dto.code },
      });
      if (existing) {
        throw new BusinessException(
          ErrorCode.CONFLICT,
          HttpStatus.CONFLICT,
          `Branch code ${dto.code} already exists`
        );
      }
      const branch = await tx.branch.create({
        data: {
          code: dto.code,
          name: dto.name,
          address: dto.address,
          latitude: new Prisma.Decimal(dto.latitude),
          longitude: new Prisma.Decimal(dto.longitude),
          radiusMeters: dto.radius_meters ?? 150,
          timezone: dto.timezone ?? 'Asia/Ho_Chi_Minh',
        },
      });
      await this.audit.logInTransaction(tx, {
        userId: user.id,
        action: 'create',
        entityType: 'Branch',
        entityId: branch.id,
        after: this.toAuditJson(branch),
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      return this.toBranchResponse({
        ...branch,
        wifiConfigs: [],
        geofences: [],
      });
    });
  }

  async update(
    user: UserRolesContext,
    id: string,
    dto: UpdateBranchDto,
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
      const before = await tx.branch.findUnique({ where: { id } });
      if (!before) {
        throw new BusinessException(
          ErrorCode.NOT_FOUND,
          HttpStatus.NOT_FOUND,
          'Branch not found'
        );
      }
      const data: Prisma.BranchUpdateInput = {};
      if (dto.code !== undefined) data.code = dto.code;
      if (dto.name !== undefined) data.name = dto.name;
      if (dto.address !== undefined) data.address = dto.address;
      if (dto.latitude !== undefined)
        data.latitude = new Prisma.Decimal(dto.latitude);
      if (dto.longitude !== undefined)
        data.longitude = new Prisma.Decimal(dto.longitude);
      if (dto.radius_meters !== undefined)
        data.radiusMeters = dto.radius_meters;
      if (dto.timezone !== undefined) data.timezone = dto.timezone;
      if (dto.status !== undefined) data.status = dto.status;
      const after = await tx.branch.update({ where: { id }, data });
      await this.audit.logInTransaction(tx, {
        userId: user.id,
        action: 'update',
        entityType: 'Branch',
        entityId: id,
        before: this.toAuditJson(before),
        after: this.toAuditJson(after),
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      return this.toBranchResponse({
        ...after,
        wifiConfigs: [],
        geofences: [],
      });
    });
  }

  async softDelete(user: UserRolesContext, id: string, ctx: RequestCtx) {
    if (!isAdmin(user)) {
      throw new BusinessException(
        ErrorCode.FORBIDDEN,
        HttpStatus.FORBIDDEN,
        'Admin only'
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.branch.findUnique({ where: { id } });
      if (!before) {
        throw new BusinessException(
          ErrorCode.NOT_FOUND,
          HttpStatus.NOT_FOUND,
          'Branch not found'
        );
      }
      const activeCount = await tx.employee.count({
        where: { primaryBranchId: id, employmentStatus: 'active' },
      });
      if (activeCount > 0) {
        throw new BusinessException(
          ErrorCode.BRANCH_HAS_ACTIVE_EMPLOYEES,
          HttpStatus.CONFLICT,
          `Cannot delete branch with ${activeCount} active employees`,
          { activeCount }
        );
      }
      const after = await tx.branch.update({
        where: { id },
        data: { status: 'inactive' },
      });
      await this.audit.logInTransaction(tx, {
        userId: user.id,
        action: 'delete',
        entityType: 'Branch',
        entityId: id,
        before: this.toAuditJson(before),
        after: this.toAuditJson(after),
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      return { success: true };
    });
  }

  async assertScope(user: UserRolesContext, branchId: string): Promise<void> {
    if (isAdmin(user)) return;
    const ids = await getManagerBranchIds(this.prisma, user.id);
    if (!ids.includes(branchId)) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        HttpStatus.NOT_FOUND,
        'Branch not found'
      );
    }
  }

  private toBranchResponse(
    b: BranchRow & { wifiConfigs?: unknown[]; geofences?: unknown[] }
  ) {
    return {
      id: b.id,
      code: b.code,
      name: b.name,
      address: b.address,
      latitude: b.latitude.toNumber(),
      longitude: b.longitude.toNumber(),
      radius_meters: b.radiusMeters,
      timezone: b.timezone,
      status: b.status,
      wifi_configs: b.wifiConfigs,
      geofences: b.geofences,
    };
  }

  private toAuditJson(b: BranchRow): Prisma.InputJsonValue {
    return {
      id: b.id,
      code: b.code,
      name: b.name,
      address: b.address,
      latitude: b.latitude.toNumber(),
      longitude: b.longitude.toNumber(),
      radiusMeters: b.radiusMeters,
      timezone: b.timezone,
      status: b.status,
    };
  }
}
