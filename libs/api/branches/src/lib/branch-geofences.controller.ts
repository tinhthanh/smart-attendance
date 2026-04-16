import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { AuthUser, CurrentUser, Roles } from '@smart-attendance/api/auth';
import { Request } from 'express';
import { BranchGeofencesService } from './branch-geofences.service';
import { CreateGeofenceDto } from './dto/create-geofence.dto';

@Controller('branches/:branchId/geofences')
export class BranchGeofencesController {
  constructor(private readonly geofences: BranchGeofencesService) {}

  @Roles('admin', 'manager')
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Param('branchId', new ParseUUIDPipe()) branchId: string
  ) {
    return this.geofences.list(user, branchId);
  }

  @Roles('admin')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthUser,
    @Param('branchId', new ParseUUIDPipe()) branchId: string,
    @Body() dto: CreateGeofenceDto,
    @Req() req: Request
  ) {
    return this.geofences.create(user, branchId, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
