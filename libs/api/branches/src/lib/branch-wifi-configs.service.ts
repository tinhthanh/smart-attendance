import { HttpStatus, Injectable } from '@nestjs/common';
import {
  AuditLogService,
  BranchConfigCacheService,
  BusinessException,
  ErrorCode,
  PrismaService,
  UserRolesContext,
  isAdmin,
} from '@smart-attendance/api/common';
import { CreateWifiConfigDto } from './dto/create-wifi-config.dto';
import { BranchesService, RequestCtx } from './branches.service';

@Injectable()
export class BranchWifiConfigsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly branches: BranchesService,
    private readonly cache: BranchConfigCacheService
  ) {}

  async list(user: UserRolesContext, branchId: string) {
    await this.branches.assertScope(user, branchId);
    const rows = await this.prisma.branchWifiConfig.findMany({
      where: { branchId },
      orderBy: { priority: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      ssid: r.ssid,
      bssid: r.bssid,
      is_active: r.isActive,
      priority: r.priority,
      notes: r.notes,
    }));
  }

  async create(
    user: UserRolesContext,
    branchId: string,
    dto: CreateWifiConfigDto,
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
      const branch = await tx.branch.findUnique({ where: { id: branchId } });
      if (!branch) {
        throw new BusinessException(
          ErrorCode.NOT_FOUND,
          HttpStatus.NOT_FOUND,
          'Branch not found'
        );
      }
      const row = await tx.branchWifiConfig.create({
        data: {
          branchId,
          ssid: dto.ssid,
          bssid: dto.bssid,
          priority: dto.priority ?? 0,
          notes: dto.notes,
        },
      });
      await this.audit.logInTransaction(tx, {
        userId: user.id,
        action: 'create',
        entityType: 'BranchWifiConfig',
        entityId: row.id,
        after: {
          branchId,
          ssid: row.ssid,
          bssid: row.bssid,
          priority: row.priority,
        },
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      await this.cache.invalidate(branchId);
      return {
        id: row.id,
        ssid: row.ssid,
        bssid: row.bssid,
        is_active: row.isActive,
        priority: row.priority,
        notes: row.notes,
      };
    });
  }

  async delete(
    user: UserRolesContext,
    branchId: string,
    configId: string,
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
      const row = await tx.branchWifiConfig.findFirst({
        where: { id: configId, branchId },
      });
      if (!row) {
        throw new BusinessException(
          ErrorCode.NOT_FOUND,
          HttpStatus.NOT_FOUND,
          'WiFi config not found'
        );
      }
      await tx.branchWifiConfig.delete({ where: { id: configId } });
      await this.audit.logInTransaction(tx, {
        userId: user.id,
        action: 'delete',
        entityType: 'BranchWifiConfig',
        entityId: configId,
        before: { branchId, ssid: row.ssid, bssid: row.bssid },
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      await this.cache.invalidate(branchId);
      return { success: true };
    });
  }
}
