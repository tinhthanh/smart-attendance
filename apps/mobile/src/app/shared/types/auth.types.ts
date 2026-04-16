export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  roles: string[];
  employee?: {
    id: string;
    employee_code: string;
    primary_branch: { id: string; name: string } | null;
    department: { id: string; name: string } | null;
  } | null;
}

export interface LoginResponse {
  data: {
    access_token: string;
    refresh_token: string;
    user: Omit<AuthUser, 'employee'>;
  };
}

export interface RefreshResponse {
  data: { access_token: string; refresh_token: string };
}

export interface MeResponse {
  data: AuthUser;
}
