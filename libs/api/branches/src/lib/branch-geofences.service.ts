import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AuditLogService,
  BusinessException,
  ErrorCode,
  PrismaService,
} from '@smart-attendance/api/common';
import { CreateGeofenceDto } from './dto/create-geofence.dto';
import { BranchesService, RequestCtx } from './branches.service';
import { UserRolesContext, isAdmin } from './branch-scope.helper';

@Injectable()
export class BranchGeofencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly branches: BranchesService
  ) {}

  async list(user: UserRolesContext, branchId: string) {
    await this.branches.assertScope(user, branchId);
    const rows = await this.prisma.branchGeofence.findMany({
      where: { branchId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      center_lat: r.centerLat.toNumber(),
      center_lng: r.centerLng.toNumber(),
      radius_meters: r.radiusMeters,
      is_active: r.isActive,
    }));
  }

  async create(
    user: UserRolesContext,
    branchId: string,
    dto: CreateGeofenceDto,
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
      const row = await tx.branchGeofence.create({
        data: {
          branchId,
          name: dto.name,
          centerLat: new Prisma.Decimal(dto.center_lat),
          centerLng: new Prisma.Decimal(dto.center_lng),
          radiusMeters: dto.radius_meters,
        },
      });
      await this.audit.logInTransaction(tx, {
        userId: user.id,
        action: 'create',
        entityType: 'BranchGeofence',
        entityId: row.id,
        after: {
          branchId,
          name: row.name,
          radius_meters: row.radiusMeters,
        },
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      return {
        id: row.id,
        name: row.name,
        center_lat: row.centerLat.toNumber(),
        center_lng: row.centerLng.toNumber(),
        radius_meters: row.radiusMeters,
        is_active: row.isActive,
      };
    });
  }
}
