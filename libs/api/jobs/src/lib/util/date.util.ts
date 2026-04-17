import { formatInTimeZone } from 'date-fns-tz';

export function todayIso(tz = 'Asia/Ho_Chi_Minh'): string {
  return formatInTimeZone(new Date(), tz, 'yyyy-MM-dd');
}

export function yesterdayIso(tz = 'Asia/Ho_Chi_Minh'): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return formatInTimeZone(d, tz, 'yyyy-MM-dd');
}

export function ymdToDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}
