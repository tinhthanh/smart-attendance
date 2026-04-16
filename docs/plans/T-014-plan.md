# T-014 Plan — Cron jobs with BullMQ (daily summary, missing checkout, anomaly)

> Generated 2026-04-16. Branch: `feature/cron-jobs-bullmq`. Start Day 4 — backend polish.

## Pre-work verify

| Check                                                                                          | Status      |
| ---------------------------------------------------------------------------------------------- | ----------- |
| Schema: `AttendanceSession`, `AttendanceEvent`, `DailyAttendanceSummary`, `Employee`, `Branch` | ✅ (T-003)  |
| `libs/api/common`: Prisma + AuditLog + BranchConfigCache                                       | ✅ reuse    |
| Redis service running via `docker-compose`                                                     | ✅ (T-002)  |
| `REDIS_URL` env validated in Joi schema                                                        | ✅ (T-005)  |
| BullMQ NOT installed                                                                           | ⚠️ new deps |
| `@nestjs/schedule` NOT installed                                                               | ⚠️ new dep  |

## No schema change. 3 new deps.

| Package                  | Version  | Why                                             |
| ------------------------ | -------- | ----------------------------------------------- |
| `@nestjs/bullmq` (dep)   | `11.0.4` | NestJS wrapper — peer NestJS 11 ✅, bullmq 5 ✅ |
| `bullmq` (dep)           | `5.74.1` | queue engine                                    |
| `@nestjs/schedule` (dep) | `6.1.3`  | `@Cron` decorator for scheduling                |

`ioredis` reused from T-009 cache.

## Library + file structure

```
libs/api/jobs/                                   # NEW
├── src/
│   ├── index.ts
│   └── lib/
│       ├── jobs.module.ts                      # register BullModule + ScheduleModule + 3 queues
│       ├── queues.ts                            # queue name constants
│       ├── schedulers/
│       │   └── jobs.scheduler.ts               # @Cron decorators → enqueue to queues
│       ├── processors/
│       │   ├── daily-summary.processor.ts      # @Processor('attendance-summary')
│       │   ├── missing-checkout.processor.ts   # @Processor('attendance-checkout-close')
│       │   └── anomaly.processor.ts            # @Processor('anomaly')
│       ├── admin/
│       │   ├── jobs.controller.ts               # POST /admin/jobs/:name/run
│       │   └── admin-job.dto.ts
│       └── *.spec.ts                           # processor logic unit tests

apps/api/src/app/app.module.ts                  # MODIFY: +JobsModule
```

Import path: `@smart-attendance/api/jobs`.

## Queue design

| Queue name                  | Processor                | Cron                   | Concurrency        |
| --------------------------- | ------------------------ | ---------------------- | ------------------ |
| `attendance-summary`        | DailySummaryProcessor    | 00:30 Asia/Ho_Chi_Minh | **1** (sequential) |
| `attendance-checkout-close` | MissingCheckoutProcessor | 23:59 ICT              | 1                  |
| `anomaly`                   | AnomalyProcessor         | 01:00 ICT              | 1                  |

**Default Job options**:

- `attempts: 3`, `backoff: { type: 'exponential', delay: 60_000 }`
- `removeOnComplete: { age: 7 * 24 * 3600, count: 1000 }` — keep last 7 days
- `removeOnFail: { age: 30 * 24 * 3600 }` — keep fails 30 days for investigation

## Scheduler (simple façade)

```typescript
// jobs.scheduler.ts
@Injectable()
export class JobsScheduler {
  constructor(
    @InjectQueue('attendance-summary') private summary: Queue,
    @InjectQueue('attendance-checkout-close') private missing: Queue,
    @InjectQueue('anomaly') private anomaly: Queue,
  ) {}

  @Cron('30 0 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async triggerDailySummary() {
    await this.summary.add('daily-summary', { forDate: yesterdayIso() }, { jobId: `daily-summary-${yesterdayIso()}` });
  }

  @Cron('59 23 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async triggerMissingCheckout() {
    await this.missing.add('close', { forDate: todayIso() }, { jobId: `close-${todayIso()}` });
  }

  @Cron('0 1 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async triggerAnomaly() {
    await this.anomaly.add('detect', { asOf: todayIso() }, { jobId: `anomaly-${todayIso()}` });
  }

  // Manual trigger
  async runNow(name: 'daily-summary' | 'missing-checkout-close' | 'anomaly-detection', payload?: unknown) { ... }
}
```

**Idempotency via `jobId`**: BullMQ skips duplicate active/waiting jobs with same `jobId`. Combined with upsert in processors, re-run = no duplicate rows.

## Daily summary processor logic

```typescript
@Processor('attendance-summary', { concurrency: 1 })
export class DailySummaryProcessor extends WorkerHost {
  async process(job: Job<{ forDate: string }>) {
    const start = Date.now();
    const workDate = new Date(`${job.data.forDate}T00:00:00.000Z`);
    const logger = new Logger(`daily-summary[${job.data.forDate}]`);

    // 1. All active employees
    const employees = await this.prisma.employee.findMany({
      where: { employmentStatus: 'active' },
      select: { id: true, primaryBranchId: true },
    });

    // 2. Sessions for the date
    const sessions = await this.prisma.attendanceSession.findMany({
      where: { workDate },
    });
    const sessionByEmp = new Map(sessions.map((s) => [s.employeeId, s]));

    let upserted = 0;
    // 3. For each employee, upsert summary
    for (const emp of employees) {
      const s = sessionByEmp.get(emp.id);
      await this.prisma.dailyAttendanceSummary.upsert({
        where: { employeeId_workDate: { employeeId: emp.id, workDate } },
        create: s
          ? {
              employeeId: emp.id,
              branchId: s.branchId,
              workDate,
              status: s.status,
              workedMinutes: s.workedMinutes ?? 0,
              overtimeMinutes: s.overtimeMinutes ?? 0,
              lateMinutes: 0, // TODO compute from check_in_at vs schedule
              trustScoreAvg: s.trustScore,
            }
          : {
              employeeId: emp.id,
              branchId: emp.primaryBranchId,
              workDate,
              status: 'absent',
              workedMinutes: 0,
              overtimeMinutes: 0,
              lateMinutes: 0,
            },
        update: s ? { status: s.status, workedMinutes: s.workedMinutes ?? 0, overtimeMinutes: s.overtimeMinutes ?? 0, trustScoreAvg: s.trustScore } : { status: 'absent', workedMinutes: 0, overtimeMinutes: 0 },
      });
      upserted++;
    }

    logger.log(`Summarized ${upserted} employees in ${Date.now() - start}ms`);
    return { upserted, duration_ms: Date.now() - start };
  }
}
```

## Missing checkout processor logic

```typescript
@Processor('attendance-checkout-close', { concurrency: 1 })
export class MissingCheckoutProcessor extends WorkerHost {
  async process(job: Job<{ forDate: string }>) {
    const workDate = new Date(`${job.data.forDate}T00:00:00.000Z`);
    const logger = new Logger(`missing-checkout[${job.data.forDate}]`);
    const start = Date.now();

    const result = await this.prisma.attendanceSession.updateMany({
      where: {
        workDate,
        checkInAt: { not: null },
        checkOutAt: null,
        status: { in: ['on_time', 'late'] }, // don't overwrite manual override
      },
      data: {
        status: 'missing_checkout',
        workedMinutes: null,
      },
    });

    logger.log(`Closed ${result.count} missing-checkout sessions in ${Date.now() - start}ms`);
    return { closed: result.count, duration_ms: Date.now() - start };
  }
}
```

## Anomaly processor logic

```typescript
@Processor('anomaly', { concurrency: 1 })
export class AnomalyProcessor extends WorkerHost {
  async process(job: Job<{ asOf: string }>) {
    const asOf = new Date(`${job.data.asOf}T00:00:00.000Z`);
    const sevenDaysAgo = new Date(asOf.getTime() - 7 * 86_400_000);
    const logger = new Logger(`anomaly[${job.data.asOf}]`);
    const start = Date.now();

    // 1. Employees with >= 3 suspicious sessions in 7 days
    const suspicious = await this.prisma.$queryRaw<{ employee_id: string; low_count: bigint }[]>`
      SELECT employee_id, COUNT(*) as low_count
      FROM attendance_sessions
      WHERE work_date >= ${sevenDaysAgo}
        AND work_date <= ${asOf}
        AND trust_score IS NOT NULL
        AND trust_score < 40
      GROUP BY employee_id
      HAVING COUNT(*) >= 3
    `;

    // 2. Untrusted devices active today
    const untrustedDevices = await this.prisma.$queryRaw<{ employee_id: string; device_id: string }[]>`
      SELECT DISTINCT ae.employee_id, ae.device_id
      FROM attendance_events ae
      JOIN employee_devices ed ON ed.id = ae.device_id
      WHERE ae.created_at >= ${asOf}
        AND ed.is_trusted = false
    `;

    // 3. Branches with late_rate today > avg 7d * 2
    const branchLateRate = await this.prisma.$queryRaw<{ branch_id: string; today_rate: number; avg_7d: number }[]>`
      WITH today AS (
        SELECT branch_id, COUNT(*) FILTER (WHERE status='late')::float / NULLIF(COUNT(*),0) AS rate
        FROM attendance_sessions WHERE work_date = ${asOf} GROUP BY branch_id
      ), week AS (
        SELECT branch_id, COUNT(*) FILTER (WHERE status='late')::float / NULLIF(COUNT(*),0) AS rate
        FROM attendance_sessions WHERE work_date >= ${sevenDaysAgo} AND work_date < ${asOf}
        GROUP BY branch_id
      )
      SELECT today.branch_id, today.rate AS today_rate, week.rate AS avg_7d
      FROM today JOIN week ON today.branch_id = week.branch_id
      WHERE today.rate > week.rate * 2 AND week.rate > 0
    `;

    const payload = {
      asOf: job.data.asOf,
      suspicious_employees: suspicious.map((r) => ({ employee_id: r.employee_id, count: Number(r.low_count) })),
      untrusted_devices: untrustedDevices,
      branches_high_late_rate: branchLateRate,
      generated_at: new Date().toISOString(),
    };

    // Cache to Redis for dashboard consumption (TTL 1h)
    await this.cache.set(`anomaly:${job.data.asOf}`, payload, 3_600_000);

    logger.log(`Anomaly: ${suspicious.length} suspicious, ${untrustedDevices.length} untrusted, ${branchLateRate.length} branches; ${Date.now() - start}ms`);
    return payload;
  }
}
```

## Admin manual trigger

```typescript
// admin/jobs.controller.ts
@Controller('admin/jobs')
export class AdminJobsController {
  constructor(private scheduler: JobsScheduler) {}

  @Roles('admin')
  @Post(':name/run')
  @HttpCode(HttpStatus.ACCEPTED)
  async run(@Param('name') name: string, @Body() dto: AdminJobDto) {
    const job = await this.scheduler.runNow(name as JobName, dto);
    return { job_id: job.id, status: 'queued', started_at: new Date().toISOString() };
  }
}
```

Admin-only guard via existing `@Roles('admin')`. Audit log via existing pattern — optional for T-014, defer.

## Decisions — recommendations

| #   | Câu hỏi                            | Recommend                                                                                                                                      | Alt                                                                  |
| --- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | Cron library                       | **`@nestjs/schedule` @Cron decorator → enqueue BullMQ job** (hybrid: cron decides timing, BullMQ handles retry/persistence)                    | BullMQ repeatable jobs — ties cron to queue state; harder to inspect |
| 2   | Anomaly storage                    | **Compute on-demand + cache Redis 1h** (spec-aligned) — processor writes to cache; dashboard reads from cache                                  | Persist table — over-engineering for MVP                             |
| 3   | Manual trigger endpoint visibility | **Admin-only** via `@Roles('admin')` guard. Document in README. No Swagger yet (out of scope).                                                 | Public dev-only env flag — footgun                                   |
| 4   | Daily summary scope                | **Previous day only** (00:30 runs at start of new day, summarizes yesterday). Aligns with spec §4.3                                            | Current day — incomplete data at 00:30                               |
| 5   | Missing checkout worked_minutes    | **`null`** per spec + status=`missing_checkout`. Manager override can correct.                                                                 | Fill end_of_shift — assumes 8h arbitrarily                           |
| 6   | Queue concurrency                  | **1 per queue** — sequential processing prevents session row locks during bulk upsert                                                          | Higher (5) — speed up but adds DB contention risk                    |
| 7   | Retry policy                       | **3 attempts, exponential backoff 60s base** — transient Redis/Prisma issues auto-recover. After 3 fails → `removeOnFail` keeps 30d for debug. | Infinite retry — ties up worker on perma-fail                        |
| 8   | Cron timezone                      | **`Asia/Ho_Chi_Minh`** — branches all in Vietnam per seed. Multi-tz scale out of MVP scope.                                                    | UTC — shifts "midnight" to 07:00 local, ignores spec                 |
| 9   | Job history retention              | **Completed: 7d × 1000 jobs; Failed: 30d** — default-ish, enough for weekly audit                                                              | Forever — Redis memory bloat                                         |
| 10  | Admin jobs UI                      | **Defer** — manual trigger endpoint is enough for T-014 test. BullMQ Bull Board UI = T-Bonus if time.                                          | Add Bull Board — adds `@bull-board/*` deps (~500kb bundle)           |

## Extra decisions

- **D-extra-1**: `jobId` = `{name}-{forDate}` — BullMQ deduplication at queue level. Combined with upsert in DB, double-run trong 1 ngày = no effect.
- **D-extra-2**: Scheduler `JobsScheduler` uses `@Cron` decorator (node-cron via @nestjs/schedule). Accept limitation: if app restarts during cron minute, job may be skipped — BullMQ won't recover missed cron. **Mitigation**: manual trigger endpoint for admin to catch up.
- **D-extra-3**: Raw SQL in anomaly processor — CLAUDE.md §8 forbids raw SQL. **Exception for T-014**: complex aggregations (window functions, CTEs) beyond Prisma's capability. Document rationale in processor header comment. Consider `$queryRaw` as safer than raw `$executeRaw`.
- **D-extra-4**: `@nestjs/bullmq` requires `BullModule.forRootAsync` with connection options — use `REDIS_URL` from ConfigService (already env-validated T-005).

## Risk

| Risk                                                                                    | Mitigation                                                                                                                                                        |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$queryRaw` violates CLAUDE.md §8 "NO raw SQL — Prisma only"                            | Document exception in comment; scoped to anomaly processor only. Revisit when Prisma adds GROUP BY HAVING + CTE support                                           |
| Daily summary on 5000 employees × 1 DB round-trip each = 5000 queries                   | Batch via `findMany` + in-memory Map (already planned). Upsert can be `$transaction` of upserts batched 500 at a time if needed. MVP: sequential, profile if slow |
| Cron fires during app deploy restart                                                    | BullMQ queue persists missed jobs — but @Cron won't enqueue if app down at that minute. Manual trigger endpoint provides catch-up path. Document in README.       |
| Redis connection drops mid-processor                                                    | BullMQ auto-retries 3x with backoff. Prisma `$transaction` fails cleanly.                                                                                         |
| Anomaly cache eviction → dashboard shows stale data                                     | Dashboard (T-015) refetches on load; cache 1h strikes balance between freshness + job cost                                                                        |
| `@nestjs/schedule` TZ issue with DST                                                    | Asia/Ho_Chi_Minh doesn't observe DST → no risk                                                                                                                    |
| Worker concurrency=1 too slow if employee count grows                                   | Document in plan — bump to 4 when scaling (BullMQ `Worker` config)                                                                                                |
| `attempts: 3` on idempotent op → OK; but non-idempotent (email) → deduplicate via jobId | All 3 processors idempotent by design (upsert, updateMany filtered, cache overwrite)                                                                              |

## Testing strategy

**Unit tests** (Prisma + Queue mocked):

- `DailySummaryProcessor.process`:
  - `should upsert summary for each active employee when called`
  - `should create absent row when employee has no session`
  - `should be idempotent — calling twice produces same count`
  - `should use previous day's work_date when job data forDate set`
- `MissingCheckoutProcessor.process`:
  - `should close sessions with check-in but no check-out`
  - `should skip sessions with manual override status`
- `AnomalyProcessor.process`:
  - `should cache result with key anomaly:{date}`
  - `should return array shape matching dashboard contract`

**Integration smoke** (manual via admin trigger):

- POST `/admin/jobs/daily-summary/run` → verify `daily_attendance_summaries` count = employees × 1 row per day
- Run twice → counts unchanged
- POST `/admin/jobs/missing-checkout-close/run` → verify sessions closed
- POST `/admin/jobs/anomaly-detection/run` → `docker exec sa-redis redis-cli keys 'anomaly:*'` → key exists

## Execution steps (sau confirm)

1. Install deps: `pnpm add -w @nestjs/bullmq@11.0.4 bullmq@5.74.1 @nestjs/schedule@6.1.3`
2. Generate lib: `nx g @nx/nest:lib --name=jobs --directory=libs/api/jobs --importPath=@smart-attendance/api/jobs ...`
3. Write `queues.ts` constants, `jobs.module.ts`, `jobs.scheduler.ts`
4. Write 3 processors
5. Write admin controller + DTO
6. Wire `JobsModule` into `app.module.ts`
7. Unit tests (3 processor spec files)
8. `pnpm nx reset && pnpm nx test jobs common auth attendance`
9. Start api + redis + postgres. POST `/admin/jobs/daily-summary/run` via curl. Verify DB + Redis.
10. `git status` — user review
11. **Không commit** — user verifies + commits

## Smoke test (via curl)

```bash
# Admin login
TOKEN=$(curl -sS -X POST http://localhost:3000/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@demo.com","password":"Admin@123"}' | jq -r .data.access_token)

# 1. Daily summary (previous day)
curl -sS -X POST http://localhost:3000/api/v1/admin/jobs/daily-summary/run -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{}' | jq .
# expect { job_id, status: "queued", started_at }

# 2. Verify DB
docker exec sa-postgres psql -U sa_app -d smart_attendance -c "SELECT count(*) FROM daily_attendance_summaries WHERE work_date = CURRENT_DATE - INTERVAL '1 day';"
# expect 30 (all active employees)

# 3. Idempotent: run again
curl ... /run ...
sleep 2
# count unchanged

# 4. Missing checkout
curl -sS -X POST http://localhost:3000/api/v1/admin/jobs/missing-checkout-close/run -H "Authorization: Bearer $TOKEN" -d '{}' | jq .

# 5. Anomaly
curl -sS -X POST http://localhost:3000/api/v1/admin/jobs/anomaly-detection/run -H "Authorization: Bearer $TOKEN" -d '{}' | jq .
docker exec sa-redis redis-cli KEYS 'anomaly:*'
# expect 1 key

# 6. Non-admin can't trigger
EMP_TOKEN=$(login employee001@demo.com)
curl -sS -X POST .../daily-summary/run -H "Authorization: Bearer $EMP_TOKEN"
# expect 403 FORBIDDEN
```

## Acceptance mapping

- [ ] Manual trigger `daily-summary` → `daily_attendance_summaries` rows → smoke 1-2 ✅
- [ ] Idempotent → smoke 3 ✅
- [ ] Missing checkout closes session → smoke 4 ✅
- [ ] Anomaly result format → smoke 5 ✅

## Review checklist

- [ ] No `setInterval` — @Cron + BullMQ queue ✅
- [ ] No sync operation in main thread — BullMQ worker in separate process context ✅
- [ ] Idempotent — upsert + updateMany filter + cache overwrite ✅
- [ ] Logger per job with start/end/duration/count ✅
- [ ] Timezone `Asia/Ho_Chi_Minh` in @Cron decorator ✅

Reply `OK hết` hoặc # + extra# cần đổi → exec.
