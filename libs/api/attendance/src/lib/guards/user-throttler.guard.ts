import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

/**
 * Per-user rate limiter for attendance endpoints.
 * Tracker prefers `req.user.id` so that shared office IPs don't starve
 * individual employees during 7:45-8:15 peak check-in.
 *
 * Must be applied LOCALLY on endpoints behind JwtAuthGuard (global), e.g.:
 *   @SkipThrottle()
 *   @UseGuards(UserThrottlerGuard)
 *   @Throttle({ default: { ttl: 60_000, limit: 10 } })
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Request): Promise<string> {
    const user = (req as Request & { user?: { id?: string } }).user;
    if (user?.id) return `user:${user.id}`;
    return `ip:${req.ip ?? 'unknown'}`;
  }

  // Override canActivate to avoid double-count from APP_GUARD ThrottlerGuard
  // (AttendanceController uses @SkipThrottle() to disable global one).
  override async canActivate(ctx: ExecutionContext): Promise<boolean> {
    return super.canActivate(ctx);
  }
}
