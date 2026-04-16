# Known Issues — Smart Attendance

Snapshot cuối MVP 5 ngày (v0.1.0, 2026-04-16). Tài liệu này consolidate tất cả
limitations + workarounds + planned fixes; tham chiếu chéo với
[`docs/architecture.md` §5](docs/architecture.md).

---

## §1 — P1 issues (fixed in T-020)

### I-000 · BullMQ graceful shutdown ✅ SOLVED

- **Severity**: High — container stop có thể để lại in-flight jobs treo
- **Impact**: Workers không đóng Redis connection → ioredis log noise + potential job state loss; exit code 137 (force kill) thay vì 0
- **Root cause**: `apps/api/src/main.ts` thiếu `app.enableShutdownHooks()` — Nest không forward SIGTERM qua lifecycle
- **Fix**: Add `app.enableShutdownHooks()` trong `bootstrap()` trước `app.listen()` (T-020, PR #19)
- **Verify**: `docker stop sa-api` → Nest closes modules (BullMQ WorkerHost auto-implements shutdown) → exit code 0 ≤ 5s

---

## §2 — P2 issues (documented, deferred)

### I-001 · cache-manager-ioredis-yet silent fallback

- **Severity**: Cosmetic (cache vẫn hoạt động in-memory per-process)
- **Impact**: Multi-instance deploy không share cache; `[ioredis] Unhandled error event` spam trong logs
- **Root cause**: `cache-manager-ioredis-yet@2` store config qua `url` but actual instance fall back to memory khi Redis config resolution có edge case
- **Workaround**: Single API instance cho MVP; logs filter `grep -v ioredis` cho cleanliness
- **Planned fix**: Migrate sang `@nestjs/cache-manager` v4 + `keyv` adapter — lên v0.3.0

### I-002 · API Docker image 326MB (8.7% over 300MB target)

- **Severity**: Infrastructure (marginal overrun)
- **Impact**: Slightly longer pull time in CI/CD + registry storage
- **Root cause**: Node alpine base ~120MB + Prisma client+CLI ~150MB + prod deps ~60MB; Prisma engine binaries + WASM compilers đã trim tối đa
- **Workaround**: None — industry baseline NestJS+Prisma là 250-400MB
- **Planned fix**: Distroless image migration OR custom Prisma client bundle — v0.3.0

### I-003 · Mobile trust score cap ~55 (no WiFi plugin)

- **Severity**: Product — tất cả mobile check-in rơi vào "review" bucket thay vì "trusted"
- **Impact**: Manager review queue phình to; UX cảm giác false-positive nhiều
- **Root cause**: Capacitor 8 ecosystem chưa có WiFi plugin maintained nào (npm 404 / abandoned repos)
- **Workaround**: Manager có thể bulk-approve qua override endpoint (T-013 UI)
- **Planned fix**: Native Capacitor WiFi plugin khi available, hoặc custom native wrapper — v0.4.0

### I-004 · CSV export rate limit per-IP (not per-user)

- **Severity**: UX edge case — shared-IP office starvation
- **Impact**: Nhiều admin/manager trên cùng office IP chia 3 exports/phút
- **Root cause**: T-016 dùng global `ThrottlerGuard` (per-IP tracker); `UserThrottlerGuard` local setup gặp conflict với `@SkipThrottle()` metadata nên fallback sang global
- **Workaround**: Admins rotate requests OR wait 60s window reset
- **Planned fix**: Fix `UserThrottlerGuard` `shouldSkip()` override + wire lại `@SkipThrottle` + `@UseGuards` — v0.2.1

### I-005 · CSV file storage local `/tmp/reports/`

- **Severity**: Ops (multi-instance / restart loses in-flight exports)
- **Impact**: Exports expire on API restart; không horizontally scale reports
- **Root cause**: MVP chọn local filesystem cho simplicity
- **Workaround**: Hourly cleanup scheduler + client polling auto-retry on 404
- **Planned fix**: S3-compatible object storage (pre-signed URLs cho download) — v0.3.0

### I-006 · Mobile bundle size 870KB (over 500KB warn budget)

- **Severity**: Performance (initial load ~1s extra on 4G)
- **Impact**: Slow first visit on weak networks; subsequent visits cached
- **Root cause**: Ionic + Angular + Capacitor plugins = heavy initial bundle
- **Workaround**: Lazy-load routes (already applied); aggressive browser caching
- **Planned fix**: Bundle analyze + code-split heavy libs (date-fns locales, apexcharts subset) — v0.2.1

### I-007 · Per-IP rate limit conflicts with `UserThrottlerGuard` docs

- **Severity**: Cosmetic docs drift — architecture.md trade-off table nói per-user nhưng CSV export thực tế per-IP
- **Impact**: Small inconsistency giữa doc + implementation for `/reports/export`
- **Root cause**: Plan T-016 chọn per-user, exec discovered `@SkipThrottle` conflict → fallback per-IP
- **Workaround**: Document trong I-004; architecture.md §4 table nói rõ "Per-user rate limit: check-in (works)" + note CSV exception
- **Planned fix**: Cùng fix với I-004 — v0.2.1

### I-008 · Pre-existing lint warnings (NG8113 unused Ion imports)

- **Severity**: Cosmetic — 2 warnings trong build logs
- **Impact**: Log clutter, no runtime effect
- **Root cause**: `IonBackButton` trong branches-list.page, `IonLabel` trong employee-form.modal — imported nhưng không dùng trong template sau refactor
- **Workaround**: None — warnings, không phải errors
- **Planned fix**: Cleanup trong next feature touching those pages

### I-009 · No coverage threshold enforcement

- **Severity**: Governance — CLAUDE.md §4.6 nói target 60% nhưng jest không fail build
- **Impact**: Coverage regression có thể slip qua CI
- **Workaround**: Manual `--coverage` check trong T-020 sweep
- **Planned fix**: Add `coverageThreshold: { global: { branches: 60, functions: 60, lines: 60 } }` vào libs/api/\* jest configs — v0.2.1

---

## §3 — Future improvements (nice-to-have, not bugs)

- **e2e test suite** — Playwright/Cypress cho golden path automation
- **Performance test harness** — k6 simulate 5000 concurrent check-in peak
- **Push notifications** — FCM cho anomaly alerts tới manager
- **Swagger UI** — auto-generate từ NestJS controllers + DTOs
- **ARM64 Docker images** — M-series Mac local dev build matrix
- **Coverage threshold enforce** — Jest fail build < 60% (see I-009)
- **Offline queue mobile** — check-in cached locally khi mất mạng, sync khi online lại
- **Per-user rate limit fix** — shared `UserThrottlerGuard` across all rate-limited endpoints (see I-004)
- **Native WiFi plugin** — iOS/Android plugin maintained (see I-003)

---

## §4 — Workarounds (quick-reference cheat sheet)

| Symptom                                        | Workaround                                                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Port 3000 EADDRINUSE on Mac                    | `lsof -nP -iTCP:3000 -t \| xargs -r kill -9`                                                                       |
| Port 4200 EADDRINUSE on Mac                    | `lsof -nP -iTCP:4200 -t \| xargs -r kill -9`                                                                       |
| Nx cache stale sau branch switch               | `pnpm nx reset`                                                                                                    |
| Jest ESM "Unexpected token 'export'" (Ionic)   | `transformIgnorePatterns: ['node_modules/(?!(@ionic\|@stencil\|ionicons\|apexcharts\|ng-apexcharts\|.*\\.mjs$))']` |
| Raw SQL "operator does not exist: uuid = text" | Explicit cast `${id}::uuid` trong tagged template literal (T-015 lesson)                                           |
| Multiple `nx serve` processes blocking port    | `pkill -9 -f "nx serve"` + `pnpm nx reset`                                                                         |
| ioredis ECONNREFUSED log spam                  | Known I-001 — `grep -v ioredis` or ignore                                                                          |
| Seed idempotency check                         | Run `pnpm prisma db seed` twice — no crash, upsert pattern                                                         |
| Docker compose postgres volume stuck           | `docker compose down -v` (WIPES data — test env only)                                                              |
| Prisma client out of sync sau migration        | `pnpm prisma generate`                                                                                             |

---

## References

- Full architecture + scale + trade-offs: [`docs/architecture.md`](docs/architecture.md)
- Business rule + validation: [`docs/spec.md`](docs/spec.md)
- Task history + acceptance: [`docs/tasks.md`](docs/tasks.md)
- AI workflow lessons: [`PROMPT_LOG.md`](PROMPT_LOG.md)
- Per-task plans: [`docs/plans/`](docs/plans/)
