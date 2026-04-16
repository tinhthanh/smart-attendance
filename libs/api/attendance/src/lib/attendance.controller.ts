import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { AuthUser, CurrentUser, Roles } from '@smart-attendance/api/auth';
import { RATE_LIMITS } from '@smart-attendance/shared/constants';
import type { Request } from 'express';
import { AttendanceService } from './attendance.service';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { ListMeQueryDto } from './dto/list-me-query.dto';
import { UserThrottlerGuard } from './guards/user-throttler.guard';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Roles('employee', 'manager', 'admin')
  @SkipThrottle()
  @UseGuards(UserThrottlerGuard)
  @Throttle({
    default: {
      ttl: RATE_LIMITS.CHECK_IN.ttl,
      limit: RATE_LIMITS.CHECK_IN.limit,
    },
  })
  @Post('check-in')
  @HttpCode(HttpStatus.CREATED)
  checkIn(
    @CurrentUser() user: AuthUser,
    @Body() dto: CheckInDto,
    @Req() req: Request
  ) {
    return this.attendance.checkIn(user, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Roles('employee', 'manager', 'admin')
  @SkipThrottle()
  @UseGuards(UserThrottlerGuard)
  @Throttle({
    default: {
      ttl: RATE_LIMITS.CHECK_IN.ttl,
      limit: RATE_LIMITS.CHECK_IN.limit,
    },
  })
  @Post('check-out')
  @HttpCode(HttpStatus.OK)
  checkOut(
    @CurrentUser() user: AuthUser,
    @Body() dto: CheckOutDto,
    @Req() req: Request
  ) {
    return this.attendance.checkOut(user, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Roles('employee', 'manager', 'admin')
  @Get('me')
  listMe(@CurrentUser() user: AuthUser, @Query() query: ListMeQueryDto) {
    return this.attendance.listMe(user, query);
  }
}
