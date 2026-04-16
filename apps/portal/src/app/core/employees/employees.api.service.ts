import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ItemResponse, ListResponse } from '../../shared/types/branch.types';
import {
  CreateAssignmentDto,
  CreateEmployeeDto,
  Employee,
  EmployeeDevice,
  ListEmployeesQuery,
  UpdateEmployeeDto,
} from '../../shared/types/employee.types';
import { ApiService } from '../api/api.service';

function qs(q: Record<string, unknown>): string {
  const entries = Object.entries(q).filter(
    ([, v]) => v !== undefined && v !== null && v !== ''
  );
  if (entries.length === 0) return '';
  return (
    '?' +
    entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')
  );
}

@Injectable({ providedIn: 'root' })
export class EmployeesApiService {
  private readonly api = inject(ApiService);

  list(query: ListEmployeesQuery): Observable<ListResponse<Employee>> {
    return this.api.get<ListResponse<Employee>>(
      `/employees${qs(query as Record<string, unknown>)}`
    );
  }

  get(id: string): Observable<ItemResponse<Employee>> {
    return this.api.get<ItemResponse<Employee>>(`/employees/${id}`);
  }

  create(dto: CreateEmployeeDto): Observable<ItemResponse<Employee>> {
    return this.api.post<ItemResponse<Employee>>('/employees', dto);
  }

  update(
    id: string,
    dto: UpdateEmployeeDto
  ): Observable<ItemResponse<Employee>> {
    return this.api.patch<ItemResponse<Employee>>(`/employees/${id}`, dto);
  }

  createAssignment(
    employeeId: string,
    dto: CreateAssignmentDto
  ): Observable<ItemResponse<unknown>> {
    return this.api.post<ItemResponse<unknown>>(
      `/employees/${employeeId}/assignments`,
      dto
    );
  }

  listDevices(employeeId: string): Observable<ItemResponse<EmployeeDevice[]>> {
    return this.api.get<ItemResponse<EmployeeDevice[]>>(
      `/employees/${employeeId}/devices`
    );
  }

  updateDevice(
    employeeId: string,
    deviceId: string,
    is_trusted: boolean
  ): Observable<ItemResponse<EmployeeDevice>> {
    return this.api.patch<ItemResponse<EmployeeDevice>>(
      `/employees/${employeeId}/devices/${deviceId}`,
      { is_trusted }
    );
  }
}
