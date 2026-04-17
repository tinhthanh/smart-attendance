import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BusinessException, ErrorCode } from '@smart-attendance/api/common';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthUser } from '../interfaces/jwt-payload.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = req.user;
    if (!user) {
      throw new BusinessException(
        ErrorCode.INVALID_TOKEN,
        HttpStatus.UNAUTHORIZED,
        'Unauthenticated'
      );
    }
    const allowed = required.some((r) => user.roles.includes(r));
    if (!allowed) {
      throw new BusinessException(
        ErrorCode.FORBIDDEN,
        HttpStatus.FORBIDDEN,
        'Insufficient role',
        { required, actual: user.roles }
      );
    }
    return true;
  }
}
