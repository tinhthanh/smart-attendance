import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  BusinessException,
  ErrorCode,
  PrismaService,
} from '@smart-attendance/api/common';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import {
  AccessJwtPayload,
  RefreshJwtPayload,
} from './interfaces/jwt-payload.interface';

export interface LoginResult {
  access_token: string;
  refresh_token: string;
  user: { id: string; email: string; full_name: string; roles: string[] };
}

export interface LoginContext {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService
  ) {}

  async login(
    email: string,
    password: string,
    ctx: LoginContext = {}
  ): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { userRoles: { include: { role: true } } },
    });
    if (!user) {
      throw new BusinessException(
        ErrorCode.INVALID_CREDENTIALS,
        HttpStatus.UNAUTHORIZED,
        'Invalid credentials'
      );
    }
    if (user.status !== 'active') {
      throw new BusinessException(
        ErrorCode.ACCOUNT_INACTIVE,
        HttpStatus.UNAUTHORIZED,
        'Account inactive'
      );
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new BusinessException(
        ErrorCode.INVALID_CREDENTIALS,
        HttpStatus.UNAUTHORIZED,
        'Invalid credentials'
      );
    }

    const roles = user.userRoles.map((ur) => ur.role.code);
    const jti = randomUUID();
    const refreshTtlMs = this.parseTtlMs(
      this.config.getOrThrow<string>('JWT_REFRESH_TTL')
    );
    const expiresAt = new Date(Date.now() + refreshTtlMs);

    await this.prisma.$transaction([
      this.prisma.refreshToken.create({
        data: {
          id: jti,
          userId: user.id,
          expiresAt,
          userAgent: ctx.userAgent,
          ipAddress: ctx.ipAddress,
        },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'login',
          entityType: 'User',
          entityId: user.id,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
      }),
    ]);

    return {
      access_token: this.signAccess({ sub: user.id, email: user.email, roles }),
      refresh_token: this.signRefresh({ sub: user.id, jti }),
      user: {
        id: user.id,
        email: user.email,
        full_name: user.fullName,
        roles,
      },
    };
  }

  async refresh(
    token: string,
    ctx: LoginContext = {}
  ): Promise<{ access_token: string; refresh_token: string }> {
    let payload: RefreshJwtPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshJwtPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new BusinessException(
        ErrorCode.INVALID_REFRESH,
        HttpStatus.UNAUTHORIZED,
        'Invalid refresh token'
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const record = await tx.refreshToken.findUnique({
        where: { id: payload.jti },
      });
      if (!record) {
        throw new BusinessException(
          ErrorCode.INVALID_REFRESH,
          HttpStatus.UNAUTHORIZED,
          'Refresh token not found'
        );
      }
      if (record.revokedAt) {
        // Replay attack — revoke all user's active tokens
        await tx.refreshToken.updateMany({
          where: { userId: record.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        this.logger.warn(`Refresh replay detected for user=${record.userId}`);
        throw new BusinessException(
          ErrorCode.REFRESH_REPLAY_DETECTED,
          HttpStatus.UNAUTHORIZED,
          'Refresh token replay detected'
        );
      }
      if (record.expiresAt < new Date()) {
        throw new BusinessException(
          ErrorCode.REFRESH_EXPIRED,
          HttpStatus.UNAUTHORIZED,
          'Refresh token expired'
        );
      }

      const user = await tx.user.findUnique({
        where: { id: record.userId },
        include: { userRoles: { include: { role: true } } },
      });
      if (!user || user.status !== 'active') {
        throw new BusinessException(
          ErrorCode.ACCOUNT_INACTIVE,
          HttpStatus.UNAUTHORIZED,
          'Account inactive'
        );
      }

      const newJti = randomUUID();
      const refreshTtlMs = this.parseTtlMs(
        this.config.getOrThrow<string>('JWT_REFRESH_TTL')
      );
      const expiresAt = new Date(Date.now() + refreshTtlMs);

      await tx.refreshToken.update({
        where: { id: record.id },
        data: { revokedAt: new Date(), replacedBy: newJti },
      });
      await tx.refreshToken.create({
        data: {
          id: newJti,
          userId: user.id,
          expiresAt,
          userAgent: ctx.userAgent,
          ipAddress: ctx.ipAddress,
        },
      });

      const roles = user.userRoles.map((ur) => ur.role.code);
      return {
        access_token: this.signAccess({
          sub: user.id,
          email: user.email,
          roles,
        }),
        refresh_token: this.signRefresh({ sub: user.id, jti: newJti }),
      };
    });
  }

  async logout(userId: string, ctx: LoginContext = {}): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          userId,
          action: 'logout',
          entityType: 'User',
          entityId: userId,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
      }),
    ]);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: { include: { role: true } },
        employee: {
          include: {
            primaryBranch: true,
            department: true,
          },
        },
      },
    });
    if (!user) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        HttpStatus.NOT_FOUND,
        'User not found'
      );
    }
    return {
      id: user.id,
      email: user.email,
      full_name: user.fullName,
      roles: user.userRoles.map((ur) => ur.role.code),
      employee: user.employee
        ? {
            id: user.employee.id,
            employee_code: user.employee.employeeCode,
            primary_branch: user.employee.primaryBranch
              ? {
                  id: user.employee.primaryBranch.id,
                  name: user.employee.primaryBranch.name,
                }
              : null,
            department: user.employee.department
              ? {
                  id: user.employee.department.id,
                  name: user.employee.department.name,
                }
              : null,
          }
        : null,
    };
  }

  private signAccess(payload: AccessJwtPayload): string {
    return this.jwt.sign(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      // cast: ms' StringValue template literal not inferable from env string
      expiresIn: this.config.getOrThrow<string>(
        'JWT_ACCESS_TTL'
      ) as unknown as number,
    });
  }

  private signRefresh(payload: RefreshJwtPayload): string {
    return this.jwt.sign(payload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.getOrThrow<string>(
        'JWT_REFRESH_TTL'
      ) as unknown as number,
    });
  }

  private parseTtlMs(ttl: string): number {
    const m = /^(\d+)([smhd])$/.exec(ttl);
    if (!m) throw new Error(`Invalid TTL format: ${ttl}`);
    const n = parseInt(m[1], 10);
    switch (m[2]) {
      case 's':
        return n * 1000;
      case 'm':
        return n * 60_000;
      case 'h':
        return n * 3_600_000;
      case 'd':
        return n * 86_400_000;
      default:
        throw new Error(`Unknown TTL unit: ${m[2]}`);
    }
  }
}
