export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  roles: string[];
}

export interface LoginResponse {
  data: {
    access_token: string;
    refresh_token: string;
    user: AuthUser;
  };
}

export interface RefreshResponse {
  data: {
    access_token: string;
    refresh_token: string;
  };
}

export interface MeResponse {
  data: AuthUser;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
