# T-009 Plan — Attendance check-in/out core

> Generated 2026-04-16. Branch: `feature/attendance-core`. End of Day 2 — integrates T-003/T-005/T-006/T-007/T-008.

## Pre-work verify

| Check                                                                                                        | Status           |
| ------------------------------------------------------------------------------------------------------------ | ---------------- |
| `libs/api/common` — Prisma + AuditLogService + BusinessException + ErrorCode + PaginationDto + scope helpers | ✅ reuse         |
| `libs/api/auth` — JwtAuthGuard global + @Roles + @CurrentUser + @Public                                      | ✅ reuse         |
| `libs/shared/utils` — `computeTrustScore`, `haversineDistance`, types                                        | ✅ reuse (T-008) |
| Schema — `AttendanceSession`, `AttendanceEvent`, `EmployeeDevice`, `WorkSchedule`, `WorkScheduleAssignment`  | ✅ (T-003)       |
| Seed — 30 employees + 1 WorkSchedule "Standard 8h" + 30 assignments                                          | ✅               |
| RATE_LIMITS.CHECK_IN constant (10/60s) sẵn trong libs/shared/constants                                       | ✅ (T-005)       |

## No schema change. 3 new deps.

| Package                           | Version  | Why                                     |
| --------------------------------- | -------- | --------------------------------------- |
| `@nestjs/cache-manager` (dep)     | `3.1.0`  | NestJS standard cache abstraction       |
| `cache-manager` (dep)             | `7.2.8`  | core peer                               |
| `cache-manager-ioredis-yet` (dep) | `2.1.2`  | Redis store adapter                     |
| `ioredis` (dep)                   | `5.10.1` | peer of adapter                         |
| `date-fns` (dep)                  | `4.1.0`  | date math                               |
| `date-fns-tz` (dep)               | `3.2.0`  | tz-aware formatting for branch.timezone |

## Library + file structure

```
libs/api/attendance/                            # NEW
├── src/
│   ├── index.ts
│   └── lib/
│       ├── attendance.module.ts
│       ├── attendance.controller.ts            # POST check-in/out, GET /me
│       ├── attendance-sessions.controller.ts   # GET list/:id, PATCH override
│       ├── attendance.service.ts               # check-in/out orchestration
│       ├── attendance-sessions.service.ts      # list/get/override
│       ├── branch-config-cache.service.ts      # Redis-backed branch geofences+wifi
│       ├── device-resolver.service.ts          # upsert EmployeeDevice
│       ├── schedule-resolver.service.ts        # resolve active WorkSchedule
│       ├── work-date.util.ts                   # tz-aware work_date for branch
│       ├── dto/
│       │   ├── check-in.dto.ts
│       │   ├── check-out.dto.ts
│       │   ├── list-sessions-query.dto.ts
│       │   ├── list-me-query.dto.ts
│       │   └── override-session.dto.ts
│       └── *.spec.ts

libs/api/branches/src/lib/branches.service.ts   # MODIFY — invalidate cache on mutation
libs/api/common/src/lib/error-codes.ts          # MODIFY — add ALREADY_CHECKED_IN, INVALID_LOCATION, NOT_ASSIGNED_TO_BRANCH, CHECKOUT_WITHOUT_CHECKIN

apps/api/src/app/app.module.ts                  # MODIFY — +AttendanceModule + CacheModule.registerAsync(redis)
```

## Endpoints — 6 endpoints

| Method | Path                       | Role                   | Notes                                                   |
| ------ | -------------------------- | ---------------------- | ------------------------------------------------------- |
| POST   | `/attendance/check-in`     | employee               | Throttle 10/60s per IP+employee. Atomic `$transaction`. |
| POST   | `/attendance/check-out`    | employee               | Same throttle.                                          |
| GET    | `/attendance/me`           | employee               | Own history, date range                                 |
| GET    | `/attendance/sessions`     | manager (scope), admin | Filter + pagination                                     |
| GET    | `/attendance/sessions/:id` | manager (scope), admin | With events                                             |
| PATCH  | `/attendance/sessions/:id` | manager (scope), admin | Override + **mandatory** audit                          |

## Check-in flow (spec §4.1)

```typescript
async checkIn(user, dto, ctx) {
  return prisma.$transaction(async (tx) => {
    // 1. Load employee + primary branch + active assignments
    const emp = await tx.employee.findFirst({
      where: { userId: user.id, employmentStatus: 'active' },
      include: { primaryBranch: true, assignments: { where: activeWindow() } },
    });
    if (!emp) throw NOT_ASSIGNED_TO_BRANCH;

    const branchId = emp.primaryBranchId;  // MVP: check-in ở primary only

    // 2. Resolve schedule (decision #5)
    const schedule = await scheduleResolver.resolve(tx, emp.id);

    // 3. Load branch config (cached 5')
    const cfg = await branchConfigCache.get(branchId);
    if (cfg.branchStatus !== 'active') throw BUSINESS('branch inactive');

    // 4. Upsert device
    const device = await deviceResolver.upsert(tx, emp.id, dto.device_fingerprint, dto.platform, dto.device_name, dto.app_version);

    // 5. Load history (last event within 2h for impossible-travel)
    const lastEvent = await tx.attendanceEvent.findFirst({
      where: { employeeId: emp.id, status: 'success', latitude: { not: null } },
      orderBy: { createdAt: 'desc' },
    });

    // 6. Compute trust score — REUSE libs/shared/utils
    const result = computeTrustScore({
      gps: { lat: dto.latitude, lng: dto.longitude, accuracyMeters: dto.accuracy_meters, isMockLocation: dto.is_mock_location },
      wifi: dto.bssid || dto.ssid ? { ssid: dto.ssid, bssid: dto.bssid } : null,
      branch: { geofences: cfg.geofences, wifiConfigs: cfg.wifiConfigs },
      device: { isTrusted: device.isTrusted, isFirstTime: device.isFirstTime },
      history: lastEvent ? { lastEventLat: lastEvent.latitude.toNumber(), lastEventLng: lastEvent.longitude.toNumber(), lastEventAt: lastEvent.createdAt, currentEventAt: new Date() } : null,
      ipMeta: { isVpnSuspected: false },  // TODO future: IP geo lookup
    });

    // 7. Hard invalid → log failed event, 422
    if (!result.isHardValid) {
      const event = await tx.attendanceEvent.create({
        data: {
          employeeId: emp.id,
          branchId,
          deviceId: device.id,
          eventType: 'check_in',
          status: 'failed',
          validationMethod: 'none',
          trustScore: 0,
          latitude: dto.latitude,
          longitude: dto.longitude,
          accuracyMeters: dto.accuracy_meters,
          ssid: dto.ssid,
          bssid: dto.bssid,
          ipAddress: ctx.ipAddress,
          riskFlags: result.flags,
          rejectReason: 'hard_validation_failed',
          deviceMeta: { fingerprint: dto.device_fingerprint, platform: dto.platform },
        },
      });
      // Distance to nearest geofence
      const distance = computeDistanceToNearest(dto, cfg.geofences);
      throw new BusinessException(ErrorCode.INVALID_LOCATION, 422, 'Vị trí ngoài geofence và WiFi không khớp', {
        event_id: event.id, trust_score: 0, risk_flags: result.flags, distance_meters: distance,
      });
    }

    // 8. Determine work_date (tz-aware per branch.timezone)
    const workDate = workDateUtil.toBranchWorkDate(new Date(), emp.primaryBranch.timezone);

    // 9. Upsert session — if already check_in_at success → 409
    const existing = await tx.attendanceSession.findUnique({ where: { employeeId_workDate: { employeeId: emp.id, workDate } } });
    if (existing?.checkInAt) throw ALREADY_CHECKED_IN;

    // 10. Compute status: on_time vs late
    const checkInAt = new Date();
    const status = isLate(checkInAt, schedule, emp.primaryBranch.timezone) ? 'late' : 'on_time';

    const session = await tx.attendanceSession.upsert({
      where: { employeeId_workDate: { employeeId: emp.id, workDate } },
      create: {
        employeeId: emp.id, branchId, workDate, checkInAt,
        status, trustScore: result.score,
      },
      update: { checkInAt, status, trustScore: result.score },
    });

    // 11. Create success event
    const event = await tx.attendanceEvent.create({
      data: {
        sessionId: session.id,
        employeeId: emp.id, branchId, deviceId: device.id,
        eventType: 'check_in', status: 'success',
        validationMethod: result.validationMethod, trustScore: result.score,
        latitude: dto.latitude, longitude: dto.longitude, accuracyMeters: dto.accuracy_meters,
        ssid: dto.ssid, bssid: dto.bssid, ipAddress: ctx.ipAddress,
        riskFlags: result.flags.length ? result.flags : undefined,
        deviceMeta: { fingerprint: dto.device_fingerprint, platform: dto.platform },
      },
    });

    // 12. Update device last_seen_at
    await tx.employeeDevice.update({ where: { id: device.id }, data: { lastSeenAt: checkInAt } });

    return { session_id: session.id, event_id: event.id, status, validation_method: result.validationMethod, trust_score: result.score, trust_level: result.level, risk_flags: result.flags, check_in_at: checkInAt, branch: { id: branchId, name: emp.primaryBranch.name } };
  });
}
```

## Check-out flow (spec §4.2)

Similar structure:

- Require session with `checkInAt !== null`, `checkOutAt === null` → else 409
- Compute `workedMinutes = (checkOutAt - checkInAt) / 60000`
- Compute `overtimeMinutes = max(0, workedMinutes - schedule.defaultHours*60 - schedule.overtimeAfterMinutes)` (conservative for MVP — refine later)
- If `checkOutAt` before scheduled end → status `early_leave` (unless already `late`)
- `session.trustScore = min(prev, newScore)`
- Log success event; update device lastSeenAt

## Redis cache — branch config

```typescript
@Injectable()
export class BranchConfigCacheService {
  constructor(@Inject(CACHE_MANAGER) private cache: Cache, private prisma: PrismaService) {}

  async get(branchId: string) {
    const key = `branch:${branchId}:config`;
    const hit = await this.cache.get<CachedBranchConfig>(key);
    if (hit) return hit;
    const [branch, geofences, wifiConfigs] = await Promise.all([this.prisma.branch.findUniqueOrThrow({ where: { id: branchId }, select: { status: true, timezone: true } }), this.prisma.branchGeofence.findMany({ where: { branchId, isActive: true } }), this.prisma.branchWifiConfig.findMany({ where: { branchId, isActive: true } })]);
    const value: CachedBranchConfig = {
      branchStatus: branch.status,
      timezone: branch.timezone,
      geofences: geofences.map((g) => ({ centerLat: g.centerLat.toNumber(), centerLng: g.centerLng.toNumber(), radiusMeters: g.radiusMeters, isActive: g.isActive })),
      wifiConfigs: wifiConfigs.map((w) => ({ ssid: w.ssid, bssid: w.bssid, isActive: w.isActive })),
    };
    await this.cache.set(key, value, 300_000); // 5 min
    return value;
  }

  async invalidate(branchId: string) {
    await this.cache.del(`branch:${branchId}:config`);
  }
}
```

**Invalidate hooks in BranchesService**: after each mutation (update, softDelete) AND in Wifi/Geofence services' create/delete → call `branchConfigCache.invalidate(branchId)`. Add dependency `BranchConfigCacheService` to those services.

## Manager override (PATCH /sessions/:id)

```typescript
// DTO
class OverrideSessionDto {
  @IsOptional() @IsIn(['on_time', 'late', 'early_leave', 'overtime', 'missing_checkout', 'absent']) status?: string;
  @IsString() @Length(5, 500) note!: string; // mandatory
}

// Service
await prisma.$transaction(async (tx) => {
  const before = await tx.attendanceSession.findUnique({ where: { id } });
  if (!before) throw NOT_FOUND;
  await assertScope(user, before.branchId);
  const after = await tx.attendanceSession.update({ where: { id }, data: { status: dto.status ?? before.status } });
  await audit.logInTransaction(tx, {
    userId: user.id,
    action: 'override',
    entityType: 'AttendanceSession',
    entityId: id,
    before: { status: before.status },
    after: { status: after.status, note: dto.note },
  });
});
```

Note lưu trong `audit_logs.after.note` (Decision G plan — approved trước bởi user).

## Time zone handling

```typescript
// work-date.util.ts
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';

export function toBranchWorkDate(timestamp: Date, timezone: string): Date {
  const zoned = formatInTimeZone(timestamp, timezone, 'yyyy-MM-dd');
  return new Date(`${zoned}T00:00:00.000Z`); // stored as @db.Date UTC boundary
}

export function isLate(checkInAt: Date, schedule: WorkSchedule, timezone: string): boolean {
  const local = toZonedTime(checkInAt, timezone);
  const [h, m] = schedule.startTime.split(':').map(Number);
  const scheduledStart = new Date(local);
  scheduledStart.setHours(h, m, 0, 0);
  const grace = schedule.graceMinutes * 60_000;
  return local.getTime() > scheduledStart.getTime() + grace;
}
```

## DTOs (JSON snake_case → per api-spec)

```typescript
// check-in.dto.ts
export class CheckInDto {
  @Type(() => Number) @IsLatitude() latitude!: number;
  @Type(() => Number) @IsLongitude() longitude!: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(5000) accuracy_meters!: number;
  @IsOptional() @IsString() @Length(1, 32) ssid?: string;
  @IsOptional() @Matches(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/) bssid?: string;
  @IsString() @Length(8, 128) device_fingerprint!: string;
  @IsIn(['ios', 'android', 'web']) platform!: string;
  @IsOptional() @IsString() @Length(1, 100) device_name?: string;
  @IsOptional() @IsString() @Length(1, 20) app_version?: string;
  @IsBoolean() is_mock_location!: boolean;
}
// check-out.dto.ts — same fields (no session_id — derive from employee+today)
```

## Unit tests (target ≥60%)

**AttendanceService**:

- `should return 201 with on_time status when check-in valid before grace period`
- `should return 201 with late status when check-in after grace period`
- `should throw INVALID_LOCATION 422 and persist failed event when outside geofence and wifi mismatch`
- `should throw ALREADY_CHECKED_IN 409 when check-in twice same day`
- `should throw NOT_ASSIGNED_TO_BRANCH when employee missing primary branch`
- `should flag mock_location but still allow check-in when wifi BSSID matches` (mock doesn't hard-reject — only flag)
- `should throw CHECKOUT_WITHOUT_CHECKIN 409 when check-out before check-in`
- `should compute worked_minutes correctly when check-out after check-in`
- `should upsert device and increment last_seen_at`
- `should emit failed event with risk_flags when trust score hard invalid`

**BranchConfigCacheService**:

- `should return cached value when key hit`
- `should fetch from DB and set cache when key miss`
- `should invalidate key when invalidate called`

**AttendanceSessionsService**:

- `should scope list to manager branches when user has manager role`
- `should list all when user has admin role`
- `should throw NOT_FOUND when manager accesses session outside scope`
- `should require note and log audit when admin overrides session`

## Smoke test (curl)

```bash
EMP=$(login employee001@demo.com)
MANAGER=$(login manager.hcm@demo.com)

# 1. Valid check-in → 201 (GPS within HCM-Q1 geofence + BSSID match)
curl -sS -X POST /attendance/check-in -H "Bearer $EMP" -d '{"latitude":10.7766,"longitude":106.7009,"accuracy_meters":10,"ssid":"SA-HCMQ1-Office","bssid":"AA:BB:CC:11:22:01","device_fingerprint":"test-fp-001","platform":"ios","is_mock_location":false}'
# expect: data.status=on_time (assuming test time ≤ 08:10 ICT) or late, trust_score ≥ 70

# 2. Double check-in → 409 ALREADY_CHECKED_IN
curl ... /check-in ... → expect 409

# 3. Check-out → 200 with worked_minutes
sleep 5; curl -sS -X POST /attendance/check-out ...

# 4. Invalid location (Hanoi coords) → 422 INVALID_LOCATION + event logged
curl ... /check-in ... latitude=21.0285, longitude=105.8542 ... (new employee to avoid 409)
# verify: DB count attendance_events where status='failed' increased

# 5. Rate limit: 11 rapid requests → last 1 = 429

# 6. Cache hit verify: log contains "cache hit" second call within 5 min

# 7. Manager PATCH session override (need admin scope correct branch) → audit log entry with action=override
```

## Decisions — recommendations

| #   | Câu hỏi                                                   | Recommend                                                                                                                                                 | Alt                                                   |
| --- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1   | Cache lib                                                 | **`@nestjs/cache-manager` + `cache-manager-ioredis-yet`** (NestJS standard)                                                                               | Raw `ioredis` — lose Nest DI ergonomics               |
| 2   | Rate limit storage                                        | **In-memory** (tiếp tục T-005 pattern) + plan redis storage trong scale phase                                                                             | Redis-backed now — scope creep                        |
| 3   | Cache invalidate                                          | **Direct call** `branchConfigCache.invalidate()` từ BranchesService mutations. Requires modifying `branches` lib to depend on `BranchConfigCacheService`. | Event-based BullMQ — out of T-009 scope               |
| 4   | Date lib                                                  | **`date-fns` + `date-fns-tz`** (lightweight, tree-shake)                                                                                                  | luxon (heavier), dayjs (plugin ecosystem fragile)     |
| 5   | Work schedule resolve                                     | **Option A** (seed default, all inherit via `WorkScheduleAssignment`) — already done in T-003                                                             | B (branch default) needs schema, C (hardcode) brittle |
| 6   | Trust score session aggregation                           | **MIN(checkIn, checkOut)** (conservative — spec §4.2 exact)                                                                                               | AVG — spec says "thấp nhất"                           |
| 7   | Device fingerprint format                                 | **Accept any string length 8-128** — no regex (fingerprint is opaque client-side hash)                                                                    | Strict regex — client churn                           |
| 8   | Failed events retention                                   | **Keep forever, no archive in MVP** — partition in T-014/T-020                                                                                            | Archive 30d — lose audit                              |
| 9   | IP capture                                                | **`req.ip`** (Express) — store in `ipAddress` column                                                                                                      | `@Ip()` decorator (same underlying)                   |
| 10  | Override session — adjusted flag or direct status change? | **Direct status change + audit trail mandatory**. `audit_logs.action='override'` provides trail.                                                          | Extra column `is_adjusted` — redundant with audit     |

## Extra decisions

- **D-extra-1** — `checkInAt` time source: `new Date()` server-side (not client). Prevents clock skew abuse. Already in design.
- **D-extra-2** — `check-out` flow trust score recompute: use `computeTrustScore` again with new GPS/WiFi from check-out payload. Final `session.trustScore = min(check-in score, check-out score)`.
- **D-extra-3** — Cache key namespace: `branch:<id>:config` (namespace to avoid collision with future caches).
- **D-extra-4** — If check-in succeeds but user hits check-in again same day → spec says 409 `ALREADY_CHECKED_IN` (no re-entry; manager must override for corrections).

## Risk

| Risk                                                                                                      | Mitigation                                                                                                                              |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Cache stale after admin updates branch config — wrong validation for up to 5'                             | Direct invalidate in `BranchesService` on all 4 mutation points (branch update, wifi create/delete, geofence create)                    |
| `$transaction` with cache call outside tx — cache returns old value during race                           | Cache read BEFORE transaction open; worst case: stale geofence used for 1 check-in → acceptable given 5' TTL + manager override tool    |
| Work date tz edge case: employee in DN checks in at 23:55 ICT, server UTC 16:55 — date calc off by 1      | `toBranchWorkDate` uses `formatInTimeZone(ts, 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd')` — correct by design. Unit test: tz boundary cases.     |
| `is_mock_location: true` from client — don't hard-reject but flag + -50                                   | Handled in trust-score (T-008). Test verifies flag.                                                                                     |
| Rate limit 10/60s per IP includes shared office IP — multiple employees same IP could throttle each other | Use compound key `ip + user.id` via `Throttle.getTracker()` override. **OR** just accept for MVP — document.                            |
| Distance calc for failed event needs nearest geofence (not first)                                         | Helper `computeDistanceToNearest(gps, geofences)` iterate + min                                                                         |
| Failed event row has `sessionId: null` — session not yet exists; schema allows null — OK                  | Schema already optional                                                                                                                 |
| Redis not running → `@nestjs/cache-manager` fallback to in-memory by default?                             | `cache-manager-ioredis-yet` throws on connect fail. Docker compose T-002 already has redis. CI: add service (already in T-004 CI YAML). |
| Override PATCH sessions/:id requires note min 5 chars — prevents empty "."                                | DTO `@Length(5, 500)`                                                                                                                   |
| Testing trust-score real (not mocked per task spec) → need valid geofence in test data                    | Spec files provide HCM geofence. Test uses `DEFAULT_GEOFENCE`.                                                                          |

## Execution steps (sau confirm)

1. Install deps: `pnpm add -w @nestjs/cache-manager@3.1.0 cache-manager@7.2.8 cache-manager-ioredis-yet@2.1.2 ioredis@5.10.1 date-fns@4.1.0 date-fns-tz@3.2.0`
2. Add `ALREADY_CHECKED_IN, INVALID_LOCATION, NOT_ASSIGNED_TO_BRANCH, CHECKOUT_WITHOUT_CHECKIN` to `ErrorCode`
3. Generate `libs/api/attendance` via `@nx/nest:lib`
4. Write all files listed (14 files incl specs)
5. Update `BranchesService` + `BranchWifiConfigsService` + `BranchGeofencesService` to inject `BranchConfigCacheService` and call `invalidate` after mutations (4 mutation points total)
6. Update `app.module.ts`:
   - Register `CacheModule.registerAsync` with `cache-manager-ioredis-yet` store
   - Add `AttendanceModule`
7. Unit tests
8. `pnpm nx reset && pnpm nx run-many --target=test --all` (incl branches regression after DI change)
9. Start api (requires redis up — `docker compose up -d redis postgres`)
10. Smoke 7 scenarios + audit log check
11. Cleanup test sessions/events generated
12. `git status` — user review
13. **Không commit.**

## Acceptance mapping

- [ ] Check-in valid → 201 with trust_score, validation_method → unit + smoke ✅
- [ ] Failed validation still creates event → unit `should throw INVALID_LOCATION and persist event` ✅
- [ ] Trust score in event + session → unit + smoke inspect DB ✅
- [ ] Cache hit lần 2 → log inspection `Cache HIT for branch:<id>:config` ✅
- [ ] Rate limit 10/60s → smoke 11-request loop → 429 at 11th ✅

## Review checklist

- [ ] `$transaction` wraps session + event create (step 9-11) ✅
- [ ] `is_mock_location` from client = flag only, not hard reject ✅
- [ ] Cache invalidate on branch mutations — 4 integration points ✅
- [ ] PATCH session audit log with before/after JSON + note ✅

Reply `OK hết` hoặc # + extra# cần đổi → exec. No install/gen/migrate yet.
