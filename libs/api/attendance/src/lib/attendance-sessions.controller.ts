import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import { AuthUser, CurrentUser, Roles } from '@smart-attendance/api/auth';
import type { Request } from 'express';
import { AttendanceSessionsService } from './attendance-sessions.service';
import { ListSessionsQueryDto } from './dto/list-sessions-query.dto';
import { OverrideSessionDto } from './dto/override-session.dto';

@Controller('attendance/sessions')
export class AttendanceSessionsController {
  constructor(private readonly sessions: AttendanceSessionsService) {}

  @Roles('admin', 'manager')
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListSessionsQueryDto) {
    return this.sessions.list(user, query);
  }

  @Roles('admin', 'manager')
  @Get(':id')
  getOne(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string
  ) {
    return this.sessions.getOne(user, id);
  }

  @Roles('admin', 'manager')
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  override(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: OverrideSessionDto,
    @Req() req: Request
  ) {
    return this.sessions.override(user, id, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
