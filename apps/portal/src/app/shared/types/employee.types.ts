export interface Employee {
  id: string;
  employee_code: string;
  employment_status: 'active' | 'on_leave' | 'terminated';
  user: {
    id: string;
    email: string;
    full_name: string;
    phone: string | null;
  };
  primary_branch: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
}

export interface CreateEmployeeDto {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  employee_code: string;
  primary_branch_id: string;
  department_id?: string;
  role: 'admin' | 'manager' | 'employee';
}

export interface UpdateEmployeeDto {
  full_name?: string;
  phone?: string;
  primary_branch_id?: string;
  department_id?: string;
  employment_status?: 'active' | 'on_leave' | 'terminated';
}

export interface ListEmployeesQuery {
  page?: number;
  limit?: number;
  branch_id?: string;
  department_id?: string;
  status?: 'active' | 'on_leave' | 'terminated';
  search?: string;
}

export interface EmployeeDevice {
  id: string;
  device_name: string | null;
  platform: 'ios' | 'android' | 'web';
  app_version: string | null;
  is_trusted: boolean;
  last_seen_at: string | null;
}

export interface CreateAssignmentDto {
  branch_id: string;
  assignment_type: 'secondary' | 'temporary';
  effective_from: string;
  effective_to?: string;
}
