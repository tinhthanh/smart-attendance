import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: ('admin' | 'manager' | 'employee')[]) =>
  SetMetadata(ROLES_KEY, roles);
