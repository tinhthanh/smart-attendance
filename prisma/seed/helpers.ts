import * as bcrypt from 'bcrypt';
import { v5 as uuidv5 } from 'uuid';

// DO NOT CHANGE — changes break seed idempotency across all dev machines.
// Generated once via `node -e "console.log(crypto.randomUUID())"` on 2026-04-15.
export const SEED_NAMESPACE = '1e26cc03-4675-471c-ad34-63f88e1e5d19';

export const BCRYPT_ROUNDS = 10;

export function deterministicId(kind: string, ...parts: string[]): string {
  return uuidv5(`${kind}|${parts.join('|')}`, SEED_NAMESPACE);
}

export function sessionId(employeeCode: string, workDate: string): string {
  return deterministicId('session', employeeCode, workDate);
}

export function eventId(
  employeeCode: string,
  workDate: string,
  type: 'check_in' | 'check_out',
): string {
  return deterministicId('event', employeeCode, workDate, type);
}

export function userId(email: string): string {
  return deterministicId('user', email);
}

export function employeeId(employeeCode: string): string {
  return deterministicId('employee', employeeCode);
}

export function branchId(code: string): string {
  return deterministicId('branch', code);
}

export function departmentId(branchCode: string, deptName: string): string {
  return deterministicId('department', branchCode, deptName);
}

export function roleId(code: string): string {
  return deterministicId('role', code);
}

export function scheduleId(name: string): string {
  return deterministicId('schedule', name);
}

export function scheduleAssignmentId(employeeCode: string, scheduleName: string): string {
  return deterministicId('schedule-assignment', employeeCode, scheduleName);
}

export function wifiConfigId(branchCode: string, bssid: string): string {
  return deterministicId('wifi', branchCode, bssid);
}

export function geofenceId(branchCode: string, geofenceName: string): string {
  return deterministicId('geofence', branchCode, geofenceName);
}

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, BCRYPT_ROUNDS);
}

export function workDateString(base: Date, dayOffset: number): string {
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - dayOffset);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export function workDate(base: Date, dayOffset: number): Date {
  return new Date(`${workDateString(base, dayOffset)}T00:00:00.000Z`);
}

// 08:00 ICT = 01:00 UTC. Adjust by offset minutes.
export function checkInTime(workDate: Date, offsetMinutes: number): Date {
  const d = new Date(workDate);
  d.setUTCHours(1, 0 + offsetMinutes, 0, 0);
  return d;
}

// 17:00 ICT = 10:00 UTC. Negative offset = early leave.
export function checkOutTime(workDate: Date, offsetMinutes: number): Date {
  const d = new Date(workDate);
  d.setUTCHours(10, 0 + offsetMinutes, 0, 0);
  return d;
}

export function minutesBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 60000);
}
