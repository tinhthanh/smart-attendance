import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BusinessException,
  ErrorCode,
  PrismaService,
} from '@smart-attendance/api/common';
import * as bcrypt from 'bcrypt';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: DeepMockProxy<PrismaService>;
  let jwt: DeepMockProxy<JwtService>;
  let config: DeepMockProxy<ConfigService>;

  const passwordHash = bcrypt.hashSync('CorrectPass1', 4);

  const baseUser = {
    id: 'user-1',
    email: 'a@b.com',
    passwordHash,
    fullName: 'Alice',
    phone: null,
    status: 'active' as const,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    userRoles: [
      {
        userId: 'user-1',
        roleId: 'r1',
        role: { code: 'admin', name: 'Admin', id: 'r1' },
      },
    ],
  };

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    jwt = mockDeep<JwtService>();
    config = mockDeep<ConfigService>();

    config.getOrThrow.mockImplementation((key: string) => {
      if (key === 'JWT_ACCESS_SECRET') return 'a'.repeat(32);
      if (key === 'JWT_REFRESH_SECRET') return 'b'.repeat(32);
      if (key === 'JWT_ACCESS_TTL') return '15m';
      if (key === 'JWT_REFRESH_TTL') return '7d';
      return '';
    });
    jwt.sign.mockReturnValue('signed-token');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  describe('login', () => {
    it('should return tokens and user when credentials valid', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser as never);
      prisma.$transaction.mockResolvedValue([] as never);

      const result = await service.login('a@b.com', 'CorrectPass1');

      expect(result.access_token).toBe('signed-token');
      expect(result.refresh_token).toBe('signed-token');
      expect(result.user).toEqual({
        id: 'user-1',
        email: 'a@b.com',
        full_name: 'Alice',
        roles: ['admin'],
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should throw INVALID_CREDENTIALS when email unknown', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.login('missing@b.com', 'CorrectPass1')
      ).rejects.toMatchObject({
        code: ErrorCode.INVALID_CREDENTIALS,
      });
    });

    it('should throw INVALID_CREDENTIALS when password mismatch', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser as never);
      await expect(
        service.login('a@b.com', 'WrongPass123')
      ).rejects.toMatchObject({
        code: ErrorCode.INVALID_CREDENTIALS,
      });
    });

    it('should throw ACCOUNT_INACTIVE when user suspended', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        status: 'suspended',
      } as never);
      await expect(
        service.login('a@b.com', 'CorrectPass1')
      ).rejects.toMatchObject({
        code: ErrorCode.ACCOUNT_INACTIVE,
      });
    });
  });

  describe('refresh', () => {
    it('should throw INVALID_REFRESH when JWT verify fails', async () => {
      jwt.verifyAsync.mockRejectedValue(new Error('bad sig'));
      await expect(service.refresh('bad.token')).rejects.toMatchObject({
        code: ErrorCode.INVALID_REFRESH,
      });
    });

    it('should throw INVALID_REFRESH when DB row missing', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', jti: 'jti-1' });
      (prisma.$transaction as jest.Mock).mockImplementation(
        async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)
      );
      prisma.refreshToken.findUnique.mockResolvedValue(null);
      await expect(service.refresh('valid.token')).rejects.toMatchObject({
        code: ErrorCode.INVALID_REFRESH,
      });
    });

    it('should throw REFRESH_REPLAY_DETECTED and revoke all tokens when token already revoked', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', jti: 'jti-old' });
      (prisma.$transaction as jest.Mock).mockImplementation(
        async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)
      );
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'jti-old',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 86400_000),
        revokedAt: new Date(),
        issuedAt: new Date(),
        replacedBy: null,
        userAgent: null,
        ipAddress: null,
      } as never);

      await expect(service.refresh('valid.token')).rejects.toMatchObject({
        code: ErrorCode.REFRESH_REPLAY_DETECTED,
      });
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should throw REFRESH_EXPIRED when DB row past expiresAt', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', jti: 'jti-old' });
      (prisma.$transaction as jest.Mock).mockImplementation(
        async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)
      );
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'jti-old',
        userId: 'user-1',
        expiresAt: new Date(Date.now() - 1000),
        revokedAt: null,
        issuedAt: new Date(),
        replacedBy: null,
        userAgent: null,
        ipAddress: null,
      } as never);

      await expect(service.refresh('valid.token')).rejects.toMatchObject({
        code: ErrorCode.REFRESH_EXPIRED,
      });
    });

    it('should rotate tokens and revoke old when refresh valid', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', jti: 'jti-old' });
      (prisma.$transaction as jest.Mock).mockImplementation(
        async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)
      );
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'jti-old',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 86400_000),
        revokedAt: null,
        issuedAt: new Date(),
        replacedBy: null,
        userAgent: null,
        ipAddress: null,
      } as never);
      prisma.user.findUnique.mockResolvedValue(baseUser as never);
      prisma.refreshToken.update.mockResolvedValue({} as never);
      prisma.refreshToken.create.mockResolvedValue({} as never);

      const result = await service.refresh('valid.token');
      expect(result.access_token).toBe('signed-token');
      expect(result.refresh_token).toBe('signed-token');
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'jti-old' },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      });
      expect(prisma.refreshToken.create).toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should revoke all user refresh tokens when called', async () => {
      prisma.$transaction.mockResolvedValue([] as never);
      await service.logout('user-1');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('me', () => {
    it('should throw NOT_FOUND when user missing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.me('nope')).rejects.toBeInstanceOf(
        BusinessException
      );
    });

    it('should return user with employee relation when found', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        employee: {
          id: 'emp-1',
          employeeCode: 'E001',
          primaryBranch: { id: 'b1', name: 'HCM-Q1' },
          department: { id: 'd1', name: 'Engineering' },
        },
      } as never);
      const result = await service.me('user-1');
      expect(result.employee?.employee_code).toBe('E001');
      expect(result.employee?.primary_branch?.name).toBe('HCM-Q1');
    });
  });
});
