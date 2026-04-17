import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { AuthUser, CurrentUser, Roles } from '@smart-attendance/api/auth';
import { Request } from 'express';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { EmployeeAssignmentsService } from './employee-assignments.service';

@Controller('employees/:employeeId/assignments')
export class EmployeeAssignmentsController {
  constructor(private readonly assignments: EmployeeAssignmentsService) {}

  @Roles('admin')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthUser,
    @Param('employeeId', new ParseUUIDPipe()) employeeId: string,
    @Body() dto: CreateAssignmentDto,
    @Req() req: Request
  ) {
    return this.assignments.create(user, employeeId, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
