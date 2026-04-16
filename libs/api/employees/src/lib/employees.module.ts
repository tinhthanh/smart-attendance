import { Module } from '@nestjs/common';
import { EmployeeAssignmentsController } from './employee-assignments.controller';
import { EmployeeAssignmentsService } from './employee-assignments.service';
import { EmployeeDevicesController } from './employee-devices.controller';
import { EmployeeDevicesService } from './employee-devices.service';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';

@Module({
  controllers: [
    EmployeesController,
    EmployeeAssignmentsController,
    EmployeeDevicesController,
  ],
  providers: [
    EmployeesService,
    EmployeeAssignmentsService,
    EmployeeDevicesService,
  ],
  exports: [EmployeesService],
})
export class EmployeesModule {}
