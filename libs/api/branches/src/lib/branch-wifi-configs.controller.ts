import {
  Body,
  Controller,
  Delete,
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
import { BranchWifiConfigsService } from './branch-wifi-configs.service';
import { CreateWifiConfigDto } from './dto/create-wifi-config.dto';

@Controller('branches/:branchId/wifi-configs')
export class BranchWifiConfigsController {
  constructor(private readonly wifi: BranchWifiConfigsService) {}

  @Roles('admin', 'manager')
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Param('branchId', new ParseUUIDPipe()) branchId: string
  ) {
    return this.wifi.list(user, branchId);
  }

  @Roles('admin')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthUser,
    @Param('branchId', new ParseUUIDPipe()) branchId: string,
    @Body() dto: CreateWifiConfigDto,
    @Req() req: Request
  ) {
    return this.wifi.create(user, branchId, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Roles('admin')
  @Delete(':configId')
  @HttpCode(HttpStatus.OK)
  delete(
    @CurrentUser() user: AuthUser,
    @Param('branchId', new ParseUUIDPipe()) branchId: string,
    @Param('configId', new ParseUUIDPipe()) configId: string,
    @Req() req: Request
  ) {
    return this.wifi.delete(user, branchId, configId, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
