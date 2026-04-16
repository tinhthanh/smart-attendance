import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
} from '@nestjs/common';
import { AuthUser, CurrentUser, Roles } from '@smart-attendance/api/auth';
import { Request } from 'express';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { EmployeeDevicesService } from './employee-devices.service';

@Controller('employees/:employeeId/devices')
export class EmployeeDevicesController {
  constructor(private readonly devices: EmployeeDevicesService) {}

  @Roles('admin', 'manager')
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Param('employeeId', new ParseUUIDPipe()) employeeId: string
  ) {
    return this.devices.list(user, employeeId);
  }

  @Roles('admin', 'manager')
  @Patch(':deviceId')
  @HttpCode(HttpStatus.OK)
  update(
    @CurrentUser() user: AuthUser,
    @Param('employeeId', new ParseUUIDPipe()) employeeId: string,
    @Param('deviceId', new ParseUUIDPipe()) deviceId: string,
    @Body() dto: UpdateDeviceDto,
    @Req() req: Request
  ) {
    return this.devices.update(user, employeeId, deviceId, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
