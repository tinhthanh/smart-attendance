export interface AccessJwtPayload {
  sub: string;
  email: string;
  roles: string[];
}

export interface RefreshJwtPayload {
  sub: string;
  jti: string;
}

export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
}
