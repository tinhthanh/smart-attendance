import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BusinessException, ErrorCode } from '@smart-attendance/api/common';
import { RolesGuard } from './roles.guard';

function makeContext(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => null,
    getClass: () => null,
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('should allow when no @Roles metadata set', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(makeContext({ roles: ['employee'] }))).toBe(true);
  });

  it('should allow when user role matches required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
    expect(
      guard.canActivate(makeContext({ id: 'u', email: 'a', roles: ['admin'] }))
    ).toBe(true);
  });

  it('should throw FORBIDDEN when user role missing required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
    try {
      guard.canActivate(
        makeContext({ id: 'u', email: 'a', roles: ['employee'] })
      );
      fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(BusinessException);
      expect((e as BusinessException).code).toBe(ErrorCode.FORBIDDEN);
    }
  });

  it('should throw INVALID_TOKEN when user missing on request', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
    try {
      guard.canActivate(makeContext(undefined));
      fail('expected throw');
    } catch (e) {
      expect((e as BusinessException).code).toBe(ErrorCode.INVALID_TOKEN);
    }
  });
});
