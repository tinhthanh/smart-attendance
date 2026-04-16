import {
  isEarlyCheckOut,
  isLateCheckIn,
  toBranchWorkDate,
} from './work-date.util';

const TZ = 'Asia/Ho_Chi_Minh';

describe('toBranchWorkDate', () => {
  it('should return local calendar date when near midnight ICT', () => {
    // 23:30 ICT on 2026-04-17 == 16:30 UTC on 2026-04-17
    const ts = new Date('2026-04-17T16:30:00.000Z');
    const workDate = toBranchWorkDate(ts, TZ);
    expect(workDate.toISOString().slice(0, 10)).toBe('2026-04-17');
  });

  it('should use local date when UTC crosses into previous day', () => {
    // 00:30 ICT on 2026-04-18 == 17:30 UTC on 2026-04-17
    const ts = new Date('2026-04-17T17:30:00.000Z');
    const workDate = toBranchWorkDate(ts, TZ);
    expect(workDate.toISOString().slice(0, 10)).toBe('2026-04-18');
  });
});

describe('isLateCheckIn', () => {
  it('should return false when check-in before start + grace', () => {
    // 08:05 ICT on 2026-04-17 == 01:05 UTC
    expect(
      isLateCheckIn(new Date('2026-04-17T01:05:00.000Z'), '08:00', 10, TZ)
    ).toBe(false);
  });

  it('should return true when check-in after start + grace', () => {
    // 08:15 ICT → late with 10m grace
    expect(
      isLateCheckIn(new Date('2026-04-17T01:15:00.000Z'), '08:00', 10, TZ)
    ).toBe(true);
  });
});

describe('isEarlyCheckOut', () => {
  it('should return true when check-out before scheduled end', () => {
    // 16:30 ICT == 09:30 UTC
    expect(
      isEarlyCheckOut(new Date('2026-04-17T09:30:00.000Z'), '17:00', TZ)
    ).toBe(true);
  });

  it('should return false when check-out after scheduled end', () => {
    // 17:30 ICT
    expect(
      isEarlyCheckOut(new Date('2026-04-17T10:30:00.000Z'), '17:00', TZ)
    ).toBe(false);
  });
});
