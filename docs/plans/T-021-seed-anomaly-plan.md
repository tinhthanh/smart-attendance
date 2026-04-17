# T-021 Plan — Enrich seed with anomaly-triggering data

> Generated 2026-04-17. Branch: `feature/seed-anomaly-data`. 30-45' task.

## Pre-work verify

| Check                                                                        | Finding                                                                                                                         |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Seed: 30 employees (10/branch), 3 branches, 7 days, 210 sessions, 420 events | ✅ all success, trust 60-100+                                                                                                   |
| EmployeeDevice rows seeded                                                   | ❌ ZERO — anomaly untrusted device query returns empty                                                                          |
| Trust scores in seed                                                         | All high (60-100+) → anomaly processor `trust_score < 40 && count >= 3` NEVER triggers                                          |
| Session statuses in seed                                                     | Mix of on_time/late/early_leave/overtime — BUT late distribution uniform → no 2× spike                                          |
| DailyAttendanceSummary                                                       | NOT seeded — populated by cron only. Anomaly processor reads `attendance_sessions` directly → OK                                |
| Idempotency pattern                                                          | UUID v5 via `deterministicId(kind, ...parts)` + Prisma `upsert`                                                                 |
| Anomaly processor thresholds                                                 | suspicious: `trust < 40 && count ≥ 3`, late spike: `today > 2× avg_7d && avg > 0`, untrusted: `is_trusted=false && event today` |
| Existing test suite (148 tests)                                              | All use mocked Prisma → seed content irrelevant to test pass/fail                                                               |

## No schema change. No new dep.

## Scope

Modify 2 existing seed files only:

```
prisma/seed/helpers.ts        # ADD 2 factories: deviceId(), anomalyEventId()
prisma/seed.ts                # ADD seedAnomalyScenarios() after seedAttendance()
```

## 4 scenarios to seed

### S1 — Suspicious employees (anomaly processor: `trust < 40 && count ≥ 3`)

Pick 3 employees from **different branches** (spread):

- `HN-HoanKiem-EMP-022` (HN) — 4 sessions with trust 25
- `DN-HaiChau-EMP-026` (DN) — 5 sessions with trust 18
- `HCMQ1-EMP-005` (HCM) — 3 sessions with trust 32

For each, UPDATE existing sessions' `trustScore` to target value. Sessions already exist from `seedAttendance()`. Update via `prisma.attendanceSession.update()` with deterministic where clause `{ employeeId_workDate }`.

Also update matching `attendance_events` (check-in) with risk_flags:

- EMP-022: `['mock_location', 'device_untrusted']`
- EMP-026: `['vpn_suspected', 'impossible_travel']`
- EMP-026 also gets `['mock_location']` on 2 days
- EMP-005: `['accuracy_poor', 'wifi_mismatch']`

### S2 — Branch late spike on DN-HaiChau

DN-HaiChau has 10 employees. For **today** (dynamic date, see D1):

- 7 of 10 employees: set session `status = 'late'`, `checkInAt = 08:35` (past grace)
- 3 of 10: keep `status = 'on_time'` (already seeded)
- Today late rate = 7/10 = 70%
- Previous 6 days average: ~1-2 late / 10 = 10-20% → spike ratio ~4× > 2× threshold

Implementation: `prisma.attendanceSession.updateMany` for DN employees on today's date, set `status: 'late'` + `checkInAt: 08:35 local`.

**Edge case**: "today" must be within ATTENDANCE_DAYS range. Since seed generates `today - 6` through `today`, the last day IS today — safe.

### S3 — Untrusted devices (3 new EmployeeDevice rows)

Create via `prisma.employeeDevice.upsert`:

- Employee HCMQ1-EMP-003: device `untrusted-device-hcm`, platform `android`, isTrusted: false, lastSeenAt: today
- Employee HN-HoanKiem-EMP-024: device `untrusted-device-hn`, platform `ios`, isTrusted: false, lastSeenAt: today
- Employee DN-HaiChau-EMP-028: device `untrusted-device-dn`, platform `android`, isTrusted: false, lastSeenAt: today

Also create 1 `attendance_event` each today with `deviceId` pointing to the new device (so anomaly `JOIN attendance_events ae JOIN employee_devices ed ON ed.id = ae.device_id` can find them).

### S4 — Failed events for audit visual (5 events, session_id = NULL)

```
Day -5: EMP-022 failed check-in → risk_flags: ['gps_outside_geofence', 'wifi_mismatch']
Day -3: EMP-026 failed check-in → risk_flags: ['mock_location']
Day -2: EMP-005 failed check-in → risk_flags: ['vpn_suspected', 'accuracy_poor']
Day -1: EMP-028 failed check-in → risk_flags: ['impossible_travel']
Day  0: EMP-024 failed check-in → risk_flags: ['mock_location', 'wifi_mismatch', 'device_untrusted']
```

All: `sessionId: null`, `status: 'failed'`, `validationMethod: 'none'`, `trustScore: 0`.

## Helpers to add

```typescript
// prisma/seed/helpers.ts — add 2 factories
export function deviceId(employeeCode: string, fingerprint: string): string {
  return deterministicId('device', employeeCode, fingerprint);
}

export function anomalyEventId(employeeCode: string, workDate: string, suffix: string): string {
  return deterministicId('anomaly-event', employeeCode, workDate, suffix);
}
```

## seedAnomalyScenarios() function outline

```typescript
async function seedAnomalyScenarios() {
  const today = workDate(0);     // dynamic: today
  const todayStr = workDateString(0);

  // S1: Update trust scores for suspicious employees
  for (const emp of SUSPICIOUS_EMPLOYEES) {
    for (let day = 0; day < emp.daysCount; day++) {
      const wd = workDate(day - 6); // last 7 days
      await prisma.attendanceSession.updateMany({
        where: { employeeId: employeeId(emp.code), workDate: wd },
        data: { trustScore: emp.trustScore },
      });
      await prisma.attendanceEvent.updateMany({
        where: { employeeId: employeeId(emp.code), /* check_in event on that date */ },
        data: { trustScore: emp.trustScore, riskFlags: emp.flags },
      });
    }
  }

  // S2: DN late spike today
  const dnEmployees = [...generateEmployees for DN-HaiChau...].slice(0, 7);
  await prisma.attendanceSession.updateMany({
    where: {
      branchId: branchId('DN-HaiChau'),
      workDate: today,
      employeeId: { in: dnEmployees.map(e => employeeId(e.code)) },
    },
    data: { status: 'late', checkInAt: lateCheckInTime(today) },
  });

  // S3: Untrusted devices
  for (const dev of UNTRUSTED_DEVICES) {
    await prisma.employeeDevice.upsert({
      where: { employeeId_deviceFingerprint: { employeeId: ..., deviceFingerprint: ... } },
      update: { lastSeenAt: today },
      create: { id: deviceId(...), ..., isTrusted: false, lastSeenAt: today },
    });
    // + 1 event with deviceId reference
  }

  // S4: Failed events (sessionId: null)
  for (const fail of FAILED_EVENTS) {
    await prisma.attendanceEvent.upsert({
      where: { id: anomalyEventId(...) },
      update: {},
      create: { id: ..., sessionId: null, status: 'failed', ... },
    });
  }
}
```

## Decisions

| #   | Câu hỏi                        | Recommend                                                                                                                               | Alt                                          |
| --- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 1   | "Today" in seed                | **Dynamic `new Date()`** via existing `workDate(0)` helper — anomaly always fresh for demo                                              | Constant `2026-04-16` — demo breaks tomorrow |
| 2   | Seed approach                  | **Append (Option A)**: `seedAnomalyScenarios()` runs AFTER `seedAttendance()` — non-destructive UPDATE + CREATE                         | Full reset — wipes user-added demo data      |
| 3   | Trust score distribution       | **Specific values** per employee (25/18/32) — memorable for demo narrative ("EMP-026 has 5 sessions at 18 = highly suspicious")         | Random 15-35 — unpredictable demo            |
| 4   | Failed events need audit_logs? | **No** — failed events self-documenting via risk_flags; audit_logs reserved for admin actions (create/update/override) per T-009 design | Add audit — scope creep                      |
| 5   | Test suite impact              | **None** — all 148 tests use mocked Prisma, seed content irrelevant. Run `pnpm nx run-many -t test --all` after seed to confirm         | Skip verification — risky                    |

## Risk

| Risk                                                                             | Mitigation                                                                                                                           |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| S2 late spike: "today" sessions may not exist yet if seed runs before work hours | `seedAttendance()` creates sessions for day 0 (today) — confirmed in seed.ts lines 220-230                                           |
| S1 trust update hits wrong sessions (employee code mismatch)                     | UUID v5 ensures `employeeId('HN-HoanKiem-EMP-022')` is deterministic — same ID every run                                             |
| S3 EmployeeDevice.id not in UUID format expected by anomaly JOIN                 | Use UUID v5 via `deviceId()` helper — valid UUID                                                                                     |
| Anomaly processor cron hasn't run → cache empty                                  | After seed, trigger `POST /admin/jobs/anomaly-detection/run` manually for demo. OR seed data is enough — next cron cycle picks it up |
| `updateMany` on sessions affects historical data → dashboard numbers shift       | Intentional — only 3-7 employees affected out of 30; shifts are minimal and improve demo visual                                      |
| DailyAttendanceSummary stale after trust/status update                           | Summary populated by cron — trigger `POST /admin/jobs/daily-summary/run` after seed for fresh numbers                                |

## Execution steps (sau confirm)

1. Add `deviceId()` + `anomalyEventId()` to `prisma/seed/helpers.ts`
2. Add `SUSPICIOUS_EMPLOYEES`, `UNTRUSTED_DEVICES`, `FAILED_EVENTS` constants to `prisma/seed/data.ts` (or inline in seed.ts)
3. Add `seedAnomalyScenarios()` function in `prisma/seed.ts`
4. Call it after `seedAttendance()` in main()
5. Run `pnpm prisma db seed` (verify no crash)
6. Run `pnpm prisma db seed` AGAIN (verify idempotent — no errors, same counts)
7. `pnpm nx run-many -t test --all` → 148/148 pass
8. Start api (`pnpm nx serve api`) + trigger anomaly job + daily-summary job
9. Verify anomaly API returns:
   - `suspicious_employees`: 3 rows
   - `branches_high_late_rate`: ≥1 row (DN)
   - `untrusted_devices_new_today`: ≥3
10. Start portal → admin /anomalies → visual confirm 3 sections have content
11. **Không commit**

## Smoke verify (5 cases)

```bash
# After seed + trigger anomaly/summary jobs:

# 1. Suspicious employees
curl /dashboard/anomalies → employees_low_trust.length >= 3

# 2. Late spike
curl /dashboard/anomalies → branches_late_spike.length >= 1
# Verify DN-HaiChau shows spike_ratio > 2

# 3. Untrusted devices
curl /dashboard/anomalies → untrusted_devices_new_today >= 3

# 4. Failed events visible
docker exec sa-postgres psql -c "SELECT count(*) FROM attendance_events WHERE status='failed'" → >= 5

# 5. Idempotency
pnpm prisma db seed  # run twice, no crash
```

Reply `OK hết` hoặc cần đổi → exec.
