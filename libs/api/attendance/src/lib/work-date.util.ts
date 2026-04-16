import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

/**
 * Convert timestamp → UTC midnight Date matching the calendar day in branch timezone.
 * Stored as Prisma `@db.Date` (midnight UTC anchoring the local YYYY-MM-DD).
 */
export function toBranchWorkDate(timestamp: Date, timezone: string): Date {
  const ymd = formatInTimeZone(timestamp, timezone, 'yyyy-MM-dd');
  return new Date(`${ymd}T00:00:00.000Z`);
}

/**
 * True if `checkInAt` is after schedule.startTime + graceMinutes in branch timezone.
 */
export function isLateCheckIn(
  checkInAt: Date,
  startTime: string,
  graceMinutes: number,
  timezone: string
): boolean {
  const local = toZonedTime(checkInAt, timezone);
  const [h, m] = startTime.split(':').map((n) => parseInt(n, 10));
  const scheduled = new Date(local);
  scheduled.setHours(h, m, 0, 0);
  const graceMs = graceMinutes * 60_000;
  return local.getTime() > scheduled.getTime() + graceMs;
}

/**
 * True if `checkOutAt` is before schedule.endTime in branch timezone.
 */
export function isEarlyCheckOut(
  checkOutAt: Date,
  endTime: string,
  timezone: string
): boolean {
  const local = toZonedTime(checkOutAt, timezone);
  const [h, m] = endTime.split(':').map((n) => parseInt(n, 10));
  const scheduled = new Date(local);
  scheduled.setHours(h, m, 0, 0);
  return local.getTime() < scheduled.getTime();
}
