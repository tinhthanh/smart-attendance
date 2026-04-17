import { Global, Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { BranchConfigCacheService } from './branch-config-cache.service';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService, AuditLogService, BranchConfigCacheService],
  exports: [PrismaService, AuditLogService, BranchConfigCacheService],
})
export class CommonModule {}
