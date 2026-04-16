# T-015 Plan — Dashboards (admin + manager + anomaly) + charts

> Generated 2026-04-16. Branch: `feature/dashboards-charts`. Largest Day 4 task, 90'.

## Pre-work verify

| Check                                                                                    | Status                                                            |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `daily_attendance_summaries` table ready (T-003)                                         | ✅                                                                |
| T-014 cron jobs — admin phải chạy `/admin/jobs/daily-summary/run` trước để populate data | ⚠️ plan smoke depends on this                                     |
| Anomaly Redis cache writes từ T-014 processor                                            | ✅ (in-memory per T-014 known issue — still works within process) |
| Portal pattern (URL sync, manager badge, VN toast) from T-011/T-013                      | ✅ reuse                                                          |
| Bundle budget portal: 1.5mb/2mb (T-011 bump)                                             | ✅ sufficient for apexcharts                                      |

## Charts library — Decision #1 impact (verified via peer)

| Library                        | Version            | Angular 20 compat               |
| ------------------------------ | ------------------ | ------------------------------- |
| `ng-apexcharts` + `apexcharts` | `2.4.0` + `5.10.6` | ✅ peer `>=20.0.0`              |
| `ngx-echarts@21`               | `21.0.0`           | ❌ requires Angular 21          |
| `ng2-charts@10`                | `10.0.0`           | ❌ requires Angular 21 + CDK 21 |

**Conclusion**: only `ng-apexcharts` compatible. ApexCharts has heatmap out-of-box, responsive, 180KB gzip.

## Pinned versions

| Package               | Version  |
| --------------------- | -------- |
| `ng-apexcharts` (dep) | `2.4.0`  |
| `apexcharts` (dep)    | `5.10.6` |

## Backend module structure

```
libs/api/dashboard/                              # NEW
├── src/
│   ├── index.ts
│   └── lib/
│       ├── dashboard.module.ts
│       ├── dashboard.controller.ts
│       ├── dashboard.service.ts                 # 3 methods reading summaries + cache
│       └── *.spec.ts

apps/api/src/app/app.module.ts                   # MODIFY — +DashboardModule
```

## Backend endpoints (api-spec §7 exact)

| Method | Path                           | Role                    | Cache                                           |
| ------ | ------------------------------ | ----------------------- | ----------------------------------------------- |
| GET    | `/dashboard/admin/overview`    | admin                   | Redis 60s                                       |
| GET    | `/dashboard/manager/:branchId` | admin + manager (scope) | Redis 60s per branchId                          |
| GET    | `/dashboard/anomalies`         | admin + manager         | Read from Redis anomaly cache (T-014 populated) |

### Service methods

```typescript
@Injectable()
export class DashboardService {
  async getAdminOverview(): Promise<AdminOverview>; // uses daily_attendance_summaries + today sessions count
  async getManagerBranch(branchId: string): Promise<BranchDashboard>;
  async getAnomalies(user: UserRolesContext): Promise<AnomaliesPayload>;
}
```

**No raw SQL** except T-014 anomaly (read cache). Dashboard queries use Prisma aggregate + groupBy.

## Admin overview query strategy

```typescript
const today = toBranchWorkDate(new Date(), 'Asia/Ho_Chi_Minh');
const [totalEmployees, totalBranches, todaySummaries, heatmapRows, topOnTime, topLate] = await Promise.all([
  prisma.employee.count({ where: { employmentStatus: 'active' } }),
  prisma.branch.count({ where: { status: 'active' } }),
  prisma.dailyAttendanceSummary.findMany({ where: { workDate: today } }),
  // Heatmap: group attendance_events by hour (raw or groupBy)
  prisma.$queryRaw<HeatmapRow[]>`
    SELECT EXTRACT(HOUR FROM check_in_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::int AS hour, COUNT(*)::int AS count
    FROM attendance_sessions
    WHERE work_date = ${today} AND check_in_at IS NOT NULL
    GROUP BY hour ORDER BY hour
  `,
  // Top 5 branches by on-time rate
  prisma.branch.findMany({
    include: {
      _count: {
        select: {
          dailySummaries: { where: { workDate: today, status: 'on_time' } },
        },
      },
    },
    // post-filter rate calc in JS
  }),
  // Top 5 branches by late count
  ...
]);
```

**Heatmap exception**: reuse raw SQL pattern (T-014 R1-R3 constraints) for hour-bucket with tz conversion. Documented in service header.

## Manager branch query

```typescript
async getManagerBranch(branchId: string) {
  // scope check via branch-scope.helper reuse
  const today = toBranchWorkDate(new Date(), branch.timezone);
  const [todaySummary, lowTrust, weekTrend] = await Promise.all([
    prisma.dailyAttendanceSummary.groupBy({ by: ['status'], where: { branchId, workDate: today }, _count: true }),
    prisma.attendanceSession.findMany({
      where: { branchId, workDate: today, trustScore: { lt: 40, not: null } },
      include: { employee: { include: { user: { select: { fullName: true } } } }, events: { where: { status: 'success' }, select: { riskFlags: true } } },
      take: 20,
    }),
    prisma.$queryRaw<WeekTrendRow[]>`
      SELECT to_char(work_date, 'YYYY-MM-DD') AS date,
             COUNT(*) FILTER (WHERE status='on_time')::float / NULLIF(COUNT(*), 0) AS on_time_rate
      FROM daily_attendance_summaries
      WHERE branch_id = ${branchId}
        AND work_date >= ${today - 7d}
      GROUP BY work_date ORDER BY work_date
    `,
  ]);
  return { branch, today: { ... }, low_trust_today: lowTrust.map(toDto), week_trend: weekTrend };
}
```

## Anomalies — read from cache (T-014 writes)

```typescript
async getAnomalies(user: UserRolesContext) {
  const key = `anomaly:${todayIso()}`;
  const cached = await this.cache.get<AnomalyResult>(key);
  if (!cached) {
    // Fallback: run inline minimal query if cron hasn't populated yet (dev env)
    return { branches_late_spike: [], employees_low_trust: [], untrusted_devices_new_today: 0 };
  }
  // Transform T-014 shape → api-spec §7 shape
  return {
    branches_late_spike: cached.branches_high_late_rate.map((b) => ({
      branch_id: b.branch_id,
      name: /* lookup via prisma.branch.findUnique */,
      late_rate_today: b.today_rate,
      late_rate_avg_7d: b.avg_7d,
      spike_ratio: b.today_rate / b.avg_7d,
    })),
    employees_low_trust: cached.suspicious_employees.map(...),
    untrusted_devices_new_today: cached.untrusted_devices.length,
  };
}
```

If manager → scope-filter `branches_late_spike` to own branches only.

## Cache layer

- Redis cache per endpoint key:
  - `dashboard:admin:overview:{YYYY-MM-DD}` TTL 60s
  - `dashboard:manager:{branchId}:{YYYY-MM-DD}` TTL 60s
- Anomalies: read from T-014's `anomaly:{YYYY-MM-DD}` (TTL 1h)
- Invalidation: none (60s TTL handles it — writes happen via cron)

## Frontend structure

```
apps/portal/src/app/
├── core/dashboard/
│   └── dashboard.api.service.ts                # 3 HTTP methods
├── shared/types/
│   └── dashboard.types.ts                      # AdminOverview, BranchDashboard, Anomalies
├── pages/dashboard/
│   ├── dashboard.page.ts                       # EXISTING — replace placeholder with admin overview
│   └── dashboard.page.html
├── pages/branch-dashboard/                     # NEW
│   ├── branch-dashboard.page.ts                # manager view
│   └── branch-dashboard.page.html
├── pages/anomalies/                            # NEW
│   ├── anomalies.page.ts
│   └── anomalies.page.html
└── layout/main.layout.{ts,html}                # MODIFY — +Dashboard menu (replace existing), +Bất thường
```

### Admin dashboard layout

```
┌─ 4 KPI cards (total_employees, total_branches, today.checked_in, on_time_rate) ─┐
├─ Row 1 ────────────────────────────────────────────────────────────────────────┤
│  Bar chart: top 5 on-time (horizontal)    │  Bar chart: top 5 late            │
├─ Row 2 ────────────────────────────────────────────────────────────────────────┤
│  Heatmap: check-in by hour 0-23 (1 row, 24 cols, color scale)                  │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Manager branch dashboard layout

```
┌─ Branch info card ──────────────────────────────────────────────┐
├─ 5 stats pills (total, checked-in, on-time, late, absent) ──────┤
├─ Line chart: 7-day on_time_rate ──────────────────────────────────┤
├─ List: low trust sessions today (≤5 rows, click → /attendance/:id) ┤
└─────────────────────────────────────────────────────────────────┘
```

### Anomalies page layout

```
┌─ Card: Untrusted devices new today: [3] ──────────────────────┐
├─ Table: Branches late spike (branch | today | 7d avg | ratio) ┤
├─ Table: Employees low trust (code | name | count last 7d) ────┤
└───────────────────────────────────────────────────────────────┘
```

## Routing

```typescript
// app.routes.ts children (inside layout)
{ path: 'dashboard', loadComponent: () => ...dashboard.page },        // admin overview
{ path: 'dashboard/branch/:id', loadComponent: () => ...branch-dashboard.page },
{ path: 'anomalies', loadComponent: () => ...anomalies.page },
```

Manager menu item points `/dashboard/branch/{primaryBranchId}` dynamically after login. Simplification: manager gets link to own first branch via `hasRole('manager')` + `getManagerBranchIds()[0]`.

## Decisions — recommendations

| #   | Câu hỏi                      | Recommend                                                                                                           | Alt                                                 |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 1   | Charts library               | **ng-apexcharts 2.4.0 + apexcharts 5.10.6** — only option Angular 20 compat + heatmap built-in                      | ngx-echarts 21 — needs Angular 21 upgrade           |
| 2   | Heatmap impl                 | **apexcharts heatmap series** — native support                                                                      | Custom CSS grid — reinvent wheel                    |
| 3   | Admin overview cache         | **Redis 60s** per spec — balance freshness + cost                                                                   | Always fresh — costly at 100 concurrent admin       |
| 4   | Manager dashboard scope      | **1 branch at a time** via `/dashboard/branch/:id` — URL shareable. If manager has multi branches, menu lists each. | Multi-branch aggregate — spec unclear; out of scope |
| 5   | Anomaly auto-refresh         | **Manual refresh button** — 1h anomaly TTL, no value polling every 30s                                              | Polling 30s — wastes requests                       |
| 6   | Bar chart orientation        | **Horizontal** for top-5 lists (branch name readability)                                                            | Vertical — cramped names                            |
| 7   | Export button on dashboard   | **Defer T-016**                                                                                                     | Add now — scope creep                               |
| 8   | Date range on admin overview | **Today only** per spec — not a date picker                                                                         | Date picker — scope creep                           |
| 9   | Anomaly empty state          | **"Hệ thống bình thường — chưa phát hiện bất thường"** + green check icon                                           | Plain "No data" — less informative                  |
| 10  | Mobile dashboard             | **Defer** — spec says portal only                                                                                   | Add now — scope creep                               |

## Extra decisions

- **D-extra-1**: Dashboard menu item replaces existing placeholder. Old `pages/dashboard/dashboard.page.ts` rewrites to show admin overview (admin) or redirect to `/dashboard/branch/:id` (manager) via computed route.
- **D-extra-2**: Heatmap uses **raw SQL** for hour extraction — reuse T-014 R1-R3 exception. Tagged template literal + typed interface + mocked test.
- **D-extra-3**: When user is manager with no assigned branches (edge case), dashboard shows "Chưa được phân công chi nhánh" state.
- **D-extra-4**: Anomaly page reuses T-014 Redis cache key format. If cache miss (first boot before any cron run), return empty payload — graceful degradation.
- **D-extra-5**: Charts **`autoRedraw` + responsive** option via apexcharts default. No custom resize observer.

## Risk

| Risk                                                               | Mitigation                                                                                                                                   |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------- |
| ApexCharts SSR/hydration issues                                    | Standalone + lazy-loaded page. Chart renders on client — Angular 20 hydration OK                                                             |
| Bundle size spike > 2mb                                            | apexcharts ~180KB gzip. Lazy-load charts component → only loads on dashboard route. If budget exceeded, bump per T-011 pattern               |
| Manager with 0 primary branch in seed (dev edge case)              | D-extra-3 handles — graceful empty state                                                                                                     |
| Heatmap raw SQL (hour extract) conflicts CLAUDE.md §8              | D-extra-2 — same exception as T-014 anomaly. Documented.                                                                                     |
| Cache stale after admin triggers manual daily-summary cron         | 60s TTL acceptable for admin-facing. Manual refresh button optional                                                                          |
| T-014 anomaly cache is **in-memory** (known issue) — not Redis     | Dashboard reads from `cache-manager` → same in-memory cache → works within process. Cross-process (if scale horizontally) = issue. Document. |
| ApexCharts imports CommonJS — Jest ESM config                      | `transformIgnorePatterns` already has `@ionic                                                                                                | @stencil | ionicons`— add`apexcharts` |
| Manager dashboard breach scope: accesses /dashboard/branch/{other} | Backend scope-check in service — returns 403 + FE toast + redirect                                                                           |

## Testing strategy

**Backend**:

- `DashboardService.getAdminOverview` — mock prisma aggregate, assert shape
- `DashboardService.getManagerBranch` — scope check admin passes, manager-outside-scope throws NOT_FOUND
- `DashboardService.getAnomalies` — cache hit returns mapped shape; cache miss returns empty

**Frontend**: no unit test (per T-011 precedent). Manual browser test.

## Execution steps (sau confirm)

1. Install deps: `pnpm add -w ng-apexcharts@2.4.0 apexcharts@5.10.6`
2. Update portal jest config: add `apexcharts` to `transformIgnorePatterns`
3. Generate backend: `nx g @nx/nest:lib --name=dashboard --directory=libs/api/dashboard --importPath=@smart-attendance/api/dashboard`
4. Write `dashboard.types.ts` (shared response types — or duplicate FE-only)
5. Write `dashboard.service.ts` + `dashboard.controller.ts` + module
6. Write `dashboard.service.spec.ts`
7. Wire into `app.module.ts`
8. Frontend: `core/dashboard/dashboard.api.service.ts`
9. Frontend: `shared/types/dashboard.types.ts` (FE interfaces)
10. Frontend: rewrite `pages/dashboard/dashboard.page.{ts,html}` (admin overview)
11. Frontend: `pages/branch-dashboard/branch-dashboard.page.{ts,html}` (manager)
12. Frontend: `pages/anomalies/anomalies.page.{ts,html}`
13. Update `app.routes.ts` (+ branch-dashboard, anomalies)
14. Update `main.layout.html` (+ Anomalies menu item, stats icon)
15. `pnpm nx reset && pnpm nx test dashboard portal jobs auth`
16. Start api + portal → admin runs `/admin/jobs/daily-summary/run` for yesterday (populate data)
17. Browser test → 8 scenarios
18. `git status` — user review
19. **Không commit**

## Smoke test (browser)

1. Admin login → menu shows **Dashboard** + **Chấm công** + **Bất thường** (new) + others
2. `/dashboard` → 4 KPI cards render (total_employees=30, total_branches=3, today checked_in, on-time_rate)
3. Top 5 on-time bar chart renders with branch names
4. Heatmap renders 0-23 hours — peak ~08:00
5. Click a top-branch card → navigate `/dashboard/branch/:id` — manager view
6. Line chart renders 7-day trend
7. Navigate `/anomalies` → empty state "Hệ thống bình thường" (seed data clean) OR anomaly data if post-seed events added
8. Manager login → `/dashboard` redirects to `/dashboard/branch/{own-id}` (or dashboard adapts). Menu "Bất thường" visible but filtered by scope.
9. Manager tries `/dashboard/branch/{other-id}` → toast error + redirect

## Acceptance mapping

- [ ] Admin overview < 500ms cache hit → Redis 60s + simple queries ✅
- [ ] Manager sees own branch only → service scope-filter + FE menu scope ✅
- [ ] Heatmap shows 8am spike → raw SQL hour group → chart renders ✅
- [ ] Anomaly table has data when cron populated → cache read path ✅ (requires admin trigger cron first — document in smoke)

## Review checklist

- [ ] Cache TTL 60s admin overview ✅
- [ ] Manager scope enforced → scope-helper reuse ✅
- [ ] Charts responsive → apexcharts default ✅
- [ ] Empty state anomaly → D-extra-4 ✅

Reply `OK hết` hoặc # + extra# cần đổi → exec. Chưa install/gen.
