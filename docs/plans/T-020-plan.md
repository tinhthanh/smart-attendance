# T-020 Plan — Final test sweep + bug fix + KNOWN_ISSUES

> Generated 2026-04-16. Branch: `feature/test-sweep-final`. 90' task, Day 5 — **TASK CUỐI** của MVP.

## Pre-work verify

| Check                                                                                | Finding                                                                                                                                                           |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/main.ts` — `app.enableShutdownHooks()`                                 | ❌ NOT called → P1 fix (1 line, insert trước `listen()`)                                                                                                          |
| 4 WorkerHost classes (daily-summary, missing-checkout, anomaly, export)              | Không có `onModuleDestroy` thủ công — `@nestjs/bullmq` auto-close khi shutdown hooks enabled → 1 line fix đủ                                                      |
| `CLAUDE.md §8 Forbidden/Avoid`                                                       | ❌ KHÔNG có raw SQL exception → thêm 1 bullet (T-014 + T-015 + T-016 đã dùng $queryRaw)                                                                           |
| Test targets                                                                         | 11 projects, **18 spec files** total (api/auth 2, attendance 2, jobs 3, reports 2, dashboard 1, branches 1, employees 1, common 1; utils 2, constants 2, types 1) |
| Coverage threshold enforced                                                          | ❌ Không — chỉ report số (CLAUDE.md §4.6 target 60% khi report manual)                                                                                            |
| `KNOWN_ISSUES.md` at root                                                            | ❌ không có → tạo mới (consolidate từ architecture.md §5)                                                                                                         |
| Bundle budgets                                                                       | portal 1.5/2MB, mobile 500KB/1MB (current: portal ~800KB OK, mobile ~870KB over warn — documented T-017)                                                          |
| Docker image sizes                                                                   | api 326MB (8.7% over 300MB target), portal 52.4MB (~5% over 50MB) — T-018 doc                                                                                     |
| 18 merged PRs, 22 PROMPT_LOG entries, 61 develop commits                             | ✅ baseline                                                                                                                                                       |
| T-020 acceptance: test pass + coverage ≥60% + lint + build + smoke + KNOWN_ISSUES.md | scope clear                                                                                                                                                       |

## Scope

**Code changes (P1 fix only)**:

- `apps/api/src/main.ts` — +1 line `app.enableShutdownHooks()`

**Doc changes**:

- `KNOWN_ISSUES.md` — NEW, root level
- `CLAUDE.md` — §8 add 1 bullet (raw SQL exception for analytics)

**Verification (report-only, no code)**:

- `pnpm nx reset && pnpm nx run-many -t test -p <all>` → report pass counts
- `pnpm nx run-many -t lint -p <all>` → report warnings
- `pnpm nx run-many -t build -p api,portal,mobile` → verify prod builds clean
- Coverage via `pnpm nx test <proj> --coverage` for top 4 libs (attendance, auth, dashboard, reports) → report %
- Docker stack smoke: 12-step golden path

Total: 1 code change (1 line) + 2 doc changes + verification reports.

## A. Test sweep (no code change)

```bash
# 1. Reset cache
pnpm nx reset

# 2. Run all tests — expect all pass
pnpm nx run-many --target=test --all --skip-nx-cache

# 3. Lint — expect 0 errors
pnpm nx run-many --target=lint --all

# 4. Build prod — all apps + libs
pnpm nx run-many --target=build --projects=api,portal,mobile --configuration=production

# 5. Coverage top 4 libs
for lib in attendance auth dashboard reports; do
  pnpm nx test "$lib" --coverage --skip-nx-cache | tail -20
done
```

Expected reports (tentative):

- **Test**: ~18 spec files → ~70+ assertions pass
- **Lint**: 0 errors; pre-existing warnings (IonBackButton/IonLabel unused) acceptable
- **Build**: all succeed with known bundle warnings (portal 1.5MB, mobile 870KB)
- **Coverage ≥60%** per T-020 acceptance (libs/api/\* services)

## B. P1 fix — enableShutdownHooks

```typescript
// apps/api/src/main.ts (diff)
 async function bootstrap() {
   const app = await NestFactory.create(AppModule);
   app.setGlobalPrefix('api/v1');
   app.useGlobalPipes(
     new ValidationPipe({
       whitelist: true,
       transform: true,
       forbidNonWhitelisted: true,
     })
   );
+  app.enableShutdownHooks();
   const port = process.env.API_PORT ?? 3000;
   await app.listen(port);
   ...
 }
```

Impact:

- Nest will call `onModuleDestroy` / `onApplicationShutdown` on SIGTERM / SIGINT.
- `@nestjs/bullmq` `WorkerHost` auto-implements shutdown → Workers close Redis connections cleanly.
- `@nestjs/cache-manager` CacheModule also cleans up.
- tini (already PID 1 in T-018 Dockerfile) forwards SIGTERM → Nest graceful shutdown path.

Verify:

```bash
docker compose up -d
docker compose logs -f api &
docker stop sa-api       # sends SIGTERM
# Expect: log "Nest application successfully closed" (or similar) trước exit
```

Risk: minimal. Shutdown hooks là standard Nest pattern, không thay đổi business logic.

## C. CLAUDE.md §8 — raw SQL exception bullet

Append to §8 Forbidden/Avoid:

```markdown
- ⚠️ **Exception**: `$queryRaw` / `$executeRaw` CHỈ được dùng trong analytics processors (`libs/api/jobs/*.processor.ts`) và dashboard service (`libs/api/dashboard/dashboard.service.ts`) cho CTEs + GROUP BY HAVING + AT TIME ZONE queries beyond Prisma fluent API. Constraints:
  - R1: inputs luôn parameterized via tagged template literals (no string concat)
  - R2: results cast sang typed row interfaces (no `any`)
  - R3: file header phải comment giải thích lý do (xem anomaly.processor.ts, dashboard.service.ts precedent)
  - CRUD paths vẫn dùng Prisma — exception KHÔNG mở cho controllers hoặc service CRUD thường
```

## D. KNOWN_ISSUES.md (NEW) — outline

```markdown
# Known Issues — Smart Attendance

Snapshot cuối MVP 5 ngày. Theo dõi workaround + planned fix cho từng vấn đề.
Cross-reference: [docs/architecture.md §5](docs/architecture.md).

## P1 (fixed in T-020)

- **BullMQ graceful shutdown**: Workers không đóng Redis connection khi container
  stop → ioredis log noise + potential job state loss.
  - **Fix**: `app.enableShutdownHooks()` trong `apps/api/src/main.ts` (T-020).
  - **Verify**: `docker stop sa-api` → "Nest application successfully closed" trước exit.

## P2 (deferred, document)

### I-001 · cache-manager-ioredis-yet silent fallback

- **Severity**: Cosmetic (cache works in-memory per-process)
- **Impact**: Multi-instance cache sẽ không share; log noise `[ioredis] Unhandled error event`
- **Workaround**: Single API instance cho MVP; logs filterable `grep -v ioredis`
- **Fix planned**: Migrate to `@nestjs/cache-manager` v4 + `keyv` adapter (v0.3.0)

### I-002 · API Docker image 326MB (over 300MB target)

- **Severity**: Infrastructure (8.7% over budget)
- **Impact**: Slightly longer pull time in CI/CD
- **Workaround**: None needed — industry baseline NestJS+Prisma is 250-400MB
- **Fix planned**: Distroless image migration OR custom Prisma client bundle (v0.3.0)

### I-003 · Mobile trust score cap ~55 (no WiFi plugin)

- **Severity**: Product (affects UX — all check-ins fall into "review" bucket)
- **Impact**: Manager review queue includes all mobile check-ins vs only suspicious
- **Workaround**: Manager can bulk-approve via override endpoint
- **Fix planned**: Native Capacitor WiFi plugin or custom native wrapper (v0.4.0)

### I-004 · CSV export rate limit per-IP, not per-user

- **Severity**: UX edge case (shared-IP office starvation)
- **Impact**: Multiple admins/managers trên cùng IP chia 3 exports/min
- **Workaround**: None for MVP; admins rotate
- **Fix planned**: Switch to `UserThrottlerGuard` subclass for `/reports/export` (v0.2.1)

### I-005 · CSV file storage local `/tmp/reports/`

- **Severity**: Ops (multi-instance / restart loses in-flight exports)
- **Impact**: Exports expire on API restart; cannot horizontally scale reports
- **Workaround**: Hourly cleanup + auto-retry from client polling
- **Fix planned**: S3-compatible object storage (v0.3.0)

### I-006 · Mobile bundle size 870KB (over 500KB warn budget)

- **Severity**: Performance (initial load ~1s extra on 4G)
- **Impact**: Slow first load on weak networks
- **Workaround**: Lazy-load routes; caching after first visit
- **Fix planned**: Bundle analyze + code-split heavy libs (v0.2.1)

### I-007 · Pre-existing lint warnings (NG8113 unused Ion imports)

- **Severity**: Cosmetic
- **Impact**: 2 warnings in build logs
- **Workaround**: None — warnings, not errors
- **Fix planned**: Clean up during next feature touching those pages

## Future improvements (nice-to-have, not bugs)

- e2e test suite (Playwright/Cypress)
- Performance test harness (5000 concurrent check-in simulation)
- Push notifications for anomaly alerts
- Swagger UI auto-generated from controllers
- ARM64 Docker image for M-series Mac local dev
```

## E. Final deliverables verification (checklist)

- [ ] README quick start works from clean clone < 10'
- [ ] Demo script 10' timing dry-run
- [ ] Architecture Mermaid renders on GitHub
- [ ] PROMPT_LOG 22+ entries, ~75+ lessons
- [ ] 18 merged PRs + this T-020 final PR = 19
- [ ] Coverage report numbers (top 4 libs ≥60%)
- [ ] Docker compose up → 4 services healthy < 30s
- [ ] Golden path end-to-end smoke pass (12 steps)
- [ ] KNOWN_ISSUES.md exists with P1/P2/future

## F. Golden path smoke (12 steps)

```
# Prereq: docker compose up -d (T-018 stack, all healthy)
# Prereq: docker exec sa-api sh -c "cd /app && node ./node_modules/prisma/build/index.js db seed"  # if needed

1.  Admin login portal → /branches → tạo "TEST-04" (code/name/lat/lng)
2.  TEST-04 detail → WiFi config SSID "TestWiFi" BSSID "AA:BB:CC:DD:EE:04"
3.  TEST-04 → Geofence center same, radius 100m
4.  /employees → tạo TEST-004 assigned TEST-04 + Engineering dept
5.  /dashboard → admin overview loads with 4 KPI + charts + heatmap
6.  /anomalies → empty state (no anomalies seeded)
7.  Logout → manager.hcm@demo.com login → auto /dashboard/branch/<HCM-id>
8.  Mobile tab: login employee001@demo.com (HCM branch)
9.  Mobile: DevTools GPS 10.7769,106.7009 → click "Chấm công vào" → success Trust 85
10. Mobile: click "Chấm công ra" → success (same GPS)
11. Admin tab: /attendance → filter date today → see employee001 session
12. Admin: /attendance/:sessionId → "Ghi đè" → status=late + note → audit_log verify
13. Admin: /attendance → "Xuất CSV" → modal progress → download attendance_*.csv
14. Open CSV in Excel → tiếng Việt cols render đúng + BOM présent
```

(Extended to 14 — still golden path, add override + CSV for coverage.)

## Decisions — recommendations

| #   | Câu hỏi                               | Recommend                                                                     | Alt                                                    |
| --- | ------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------ |
| 1   | Fix P1 BullMQ shutdown trong T-020    | **Trong T-020** — scope phù hợp, 1-line, low risk                             | Separate PR — delays submission, chia không cần thiết  |
| 2   | KNOWN_ISSUES.md hay append README     | **Separate file** at root — cleaner, easier tracker                           | README append — clutter                                |
| 3   | Update CLAUDE.md §8 raw SQL exception | **Yes — 1 bullet** (T-014+T-015+T-016 đã dùng precedent)                      | Skip — codebase đã có exception without governance doc |
| 4   | Tag `v0.1.0` sau merge T-020          | **Yes — marker cuối MVP** (git tag + push)                                    | Skip — lose MVP completion marker                      |
| 5   | Merge develop → main sau all PRs      | **User decide — propose after tag v0.1.0**                                    | Auto-merge — submission requirement dependent          |
| 6   | Delete merged feature branches remote | **Optional cleanup** — user decide                                            | Keep — easier audit trail                              |
| 7   | Commit coverage HTML report           | **No** — generated artifact, gitignore                                        | Commit — repo bloat                                    |
| 8   | Test seed reset (drop + seed lại)     | **Yes — `docker compose down -v && up -d`** verify seed idempotent end-to-end | Skip — may miss idempotency bug                        |
| 9   | Performance test 5000 concurrent      | **No — out of scope** + note trong architecture.md                            | Spin up k6 — time sink, MVP doesn't require            |
| 10  | Video record trong T-020              | **No — user quay với demo-script.md sau T-020**                               | AI record — not practical (needs user setup)           |

## Extra decisions

- **D-extra-1**: Coverage report — **manual run for 4 libs** (attendance, auth, dashboard, reports — core business logic). Other libs chưa đủ test để đạt 60%; report honest numbers trong final comment.
- **D-extra-2**: Golden path smoke — **expand to 14 steps** (add override + CSV export) to cover T-013 + T-016 critical paths in one flow.
- **D-extra-3**: Seed reset test — dùng `docker compose down -v` (wipe volumes) rồi `up -d` + manual trigger seed — verify idempotent (upsert pattern) không crash.
- **D-extra-4**: CLAUDE.md §8 bullet wording — nhắc R1/R2/R3 constraints mà anomaly.processor.ts header đã dùng, không invent new rules.
- **D-extra-5**: KNOWN_ISSUES.md references architecture.md §5 thay vì duplicate content — single source of truth.

## Risk

| Risk                                              | Mitigation                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------- |
| `enableShutdownHooks()` ảnh hưởng startup/runtime | Standard Nest pattern; docker compose restart loop test                         |
| Coverage < 60% cho libs nào đó                    | Report honest numbers; add note trong KNOWN_ISSUES future improvement nếu thiếu |
| Lint reveals new errors sau `nx reset`            | Fix inline if trivial; document nếu extensive                                   |
| Seed reset crash (non-idempotent)                 | Run 2× liên tiếp; T-003 documented upsert pattern — should be safe              |
| Smoke step 12 override fails                      | Pre-check audit_logs table schema has all columns from T-013                    |
| PROMPT_LOG v-final entry conflict                 | Append after T-019 entry; don't rewrite existing                                |
| Tag v0.1.0 on branch không-phải main              | Tag sau merge develop → main (user gate)                                        |
| `docker compose down -v` wipes production data    | Confirm test env only; never run against production                             |

## Execution steps (sau confirm)

1. **Fix P1**: edit `apps/api/src/main.ts` → add `app.enableShutdownHooks()`
2. **Verify P1**: `pnpm nx build api` → build clean; `docker compose build api && up -d && stop sa-api` → logs show graceful close
3. **Update CLAUDE.md §8**: append raw SQL exception bullet
4. **Create KNOWN_ISSUES.md** at root
5. **Run test suite**: `pnpm nx reset && pnpm nx run-many -t test --all` — report counts
6. **Run lint**: `pnpm nx run-many -t lint --all` — report 0 errors
7. **Run build**: `pnpm nx run-many -t build -p api,portal,mobile --configuration=production`
8. **Coverage top 4**: manual `pnpm nx test <lib> --coverage` for attendance/auth/dashboard/reports
9. **Docker smoke**: `docker compose down -v && up -d` + wait healthy + run 14-step golden path
10. **Report results**: summary comment với pass counts + coverage % + bundle sizes
11. **Không commit** — user review + commit sau final verify

## Smoke verification (no commit)

```bash
# Counters
pnpm nx run-many -t test --all 2>&1 | tail -5
pnpm nx run-many -t lint --all 2>&1 | grep -E "error|warning" | wc -l
pnpm nx run-many -t build -p api,portal,mobile --configuration=production 2>&1 | tail -5

# Coverage
for lib in attendance auth dashboard reports; do
  echo "=== $lib ==="
  pnpm nx test "$lib" --coverage --skip-nx-cache 2>&1 | grep -E "Statements|Branches|Functions|Lines"
done

# Docker golden path
docker compose down -v && docker compose up -d
# ... wait healthy ... run 14 steps manually
```

## Acceptance mapping (T-020)

- [ ] All test pass ✅ (verify in smoke)
- [ ] Coverage ≥ 60% libs/api/\* services ✅ (verify top 4)
- [ ] Lint 0 errors ✅
- [ ] Build prod all apps ✅
- [ ] Manual smoke golden path 14 steps ✅
- [ ] KNOWN_ISSUES.md created ✅
- [ ] P1 BullMQ shutdown fixed ✅
- [ ] CLAUDE.md §8 raw SQL exception documented ✅

## Review checklist

- [ ] No new features (bug fix only) ✅
- [ ] P1 fix 1-line minimal invasive ✅
- [ ] No PR rollback ✅
- [ ] Golden path end-to-end pass ✅
- [ ] KNOWN_ISSUES honest (không hide limitations) ✅
- [ ] Tests still green ✅
- [ ] Architecture.md §5 synced với KNOWN_ISSUES.md references ✅

Reply `OK hết` hoặc `# + extra#` cần đổi → exec.
