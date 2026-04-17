import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

export interface AuditLogInput {
  userId: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
}

// Prisma's interactive transaction client — same shape as `tx` argument in `$transaction(async (tx) => ...)`
type TxClient = Omit<
  import('@prisma/client').PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput): Promise<void> {
    await this.prisma.auditLog.create({ data: this.toCreateData(input) });
  }

  async logInTransaction(tx: TxClient, input: AuditLogInput): Promise<void> {
    await tx.auditLog.create({ data: this.toCreateData(input) });
  }

  private toCreateData(input: AuditLogInput): Prisma.AuditLogCreateInput {
    const data: Prisma.AuditLogCreateInput = {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    };
    if (input.before !== undefined) data.before = input.before;
    if (input.after !== undefined) data.after = input.after;
    if (input.userId) data.user = { connect: { id: input.userId } };
    return data;
  }
}
