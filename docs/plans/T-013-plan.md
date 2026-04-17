# T-013 Plan — Attendance sessions (portal) + override

> Generated 2026-04-16. Branch: `feature/portal-attendance-sessions`. 45' task. Mobile history **already done in T-012** — this task focuses on portal.

## Pre-work verify

| Check                                                                    | Status               |
| ------------------------------------------------------------------------ | -------------------- |
| Mobile `/tabs/history` tab working (T-012)                               | ✅ DONE — skip scope |
| Backend `GET /attendance/sessions` + `GET /:id` + `PATCH /:id` (T-009)   | ✅                   |
| Portal pattern (list + detail + modal + URL sync + VN errors) from T-011 | ✅ reuse patterns    |
| Manager scope enforced backend via `getManagerBranchIds`                 | ✅                   |
| Override requires note ≥10 chars (DTO validation T-009)                  | ✅                   |
| `@nx/angular` bundle budget bumped T-011                                 | ✅                   |

## No backend changes. No new deps.

## File structure

```
apps/portal/src/app/
├── core/attendance/
│   └── attendance.api.service.ts                    # NEW: list/get/override
├── shared/types/
│   └── attendance-session.types.ts                  # NEW: Session, SessionWithEvents, Event
├── pages/attendance/
│   ├── sessions-list.page.{ts,html}                 # NEW: main list with filters
│   ├── session-detail.page.{ts,html}                # NEW: detail + events timeline
│   └── override-session.modal.{ts,html}             # NEW: admin/manager override
└── layout/main.layout.html                          # MODIFY: add "Chấm công" menu item

apps/portal/src/app/app.routes.ts                     # MODIFY: +2 routes
```

## Endpoints consumed

| Endpoint                   | Method | Purpose                        |
| -------------------------- | ------ | ------------------------------ |
| `/attendance/sessions`     | GET    | list with filters + pagination |
| `/attendance/sessions/:id` | GET    | detail with events[]           |
| `/attendance/sessions/:id` | PATCH  | override status + audit        |

## List page `/attendance`

- URL query sync (T-011 pattern): `?branch_id&employee_id&date_from&date_to&status&page`
- Filter bar: `ion-select branch` (admin only), employee search, date range (2 ion-datetime), status select
- Table-style via `ion-list` with `ion-item` + `ion-grid` inner:
  - Cột: Ngày | Nhân viên (code + full_name) | Chi nhánh | Vào | Ra | Status chip | Trust chip
- Click row → navigate `/attendance/:id`
- Pagination Next/Prev same as T-011
- Manager mode: `ion-chip color="warning"` badge "Chỉ xem phiên thuộc chi nhánh được phân công"
- Empty state + loading spinner

## Detail page `/attendance/:id`

```
┌────────────────────────────────────────────┐
│ ← Chấm công / 2026-04-16                   │
│ Nguyễn Văn A (HCMQ1-EMP-001) · HCM-Q1      │
├────────────────────────────────────────────┤
│ Session info card                          │
│  Vào: 08:05 · Ra: 17:30                    │
│  Giờ làm: 565 phút · Overtime: 30 phút     │
│  Status: [on_time] · Trust: [85]            │
│  Flags: [bssid_match] [gps_in_geofence]    │
├────────────────────────────────────────────┤
│ Sự kiện                                     │
│  ● 08:05 Check-in success · 85 · gps_wifi  │
│    GPS: 10.7766, 106.7009 ±10m              │
│    WiFi: Office (aa:bb:cc:dd:ee:ff)        │
│    Flags: bssid_match                       │
│  ● 17:30 Check-out success · 88 · gps_wifi │
│    (same GPS/WiFi)                          │
├────────────────────────────────────────────┤
│ [Override status] (admin/manager only)      │
└────────────────────────────────────────────┘
```

- Events rendered with `ion-list` vertical timeline; failed events `color="danger"`
- "Override status" button opens modal
- Backend returns 404 if outside scope → toast + redirect `/attendance`

## Override modal

- Fields: `status` (ion-select: on_time/late/early_leave/missing_checkout/absent — **no overtime** per T-009 spec) + `note` (ion-textarea, min 10 max 500 chars)
- Submit → `PATCH /:id` → success toast + close + refresh detail
- Shows before/after status preview inline

## Attendance API service

```typescript
@Injectable({ providedIn: 'root' })
export class AttendanceApiService {
  private api = inject(ApiService);

  list(query: ListSessionsQuery): Observable<ListResponse<Session>> { ... }
  get(id: string): Observable<ItemResponse<SessionWithEvents>> { ... }
  override(id: string, dto: OverrideSessionDto): Observable<ItemResponse<{ id, status, note }>> { ... }
}
```

## Types (FE-only)

```typescript
export interface Session {
  id: string;
  work_date: string; // YYYY-MM-DD
  employee: { id; employee_code; full_name };
  branch: { id; name };
  check_in_at: string | null;
  check_out_at: string | null;
  worked_minutes: number | null;
  overtime_minutes: number | null;
  status: 'on_time' | 'late' | 'early_leave' | 'overtime' | 'missing_checkout' | 'absent';
  trust_score: number | null;
}

export interface AttendanceEvent {
  id: string;
  event_type: 'check_in' | 'check_out';
  status: 'success' | 'failed';
  validation_method: 'gps' | 'wifi' | 'gps_wifi' | 'none';
  trust_score: number;
  latitude: number | null;
  longitude: number | null;
  accuracy_meters: number | null;
  ssid: string | null;
  bssid: string | null;
  risk_flags: string[] | null;
  created_at: string;
}

export interface SessionWithEvents extends Session {
  employee: { id; employee_code; full_name }; // already in Session
  events: AttendanceEvent[];
}

export interface ListSessionsQuery {
  page?: number;
  limit?: number;
  branch_id?: string;
  employee_id?: string;
  date_from?: string;
  date_to?: string;
  status?: string;
}

export interface OverrideSessionDto {
  status?: string;
  note: string; // ≥10 chars
}
```

## Decisions — recommendations

| #   | Câu hỏi                    | Recommend                                                                                  | Alt                                                           |
| --- | -------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| 1   | List page pattern          | **Write new** — row density ≠ branches/employees (7 cols) + ion-grid inner layout          | Reuse T-011 — wrong shape                                     |
| 2   | Date picker                | **`ion-datetime-button` + `ion-datetime` modal** (Ionic-native UX, keyboard + visual)      | Native `<input type="date">` — uglier                         |
| 3   | Filter URL sync            | **Flat query string** (reuse T-011 `syncUrl()` helper)                                     | JSON in URL — ugly + hash collisions                          |
| 4   | Override modal             | **Separate component** `override-session.modal.ts` — not reused                            | Shared modal — no other consumer                              |
| 5   | Events timeline            | **Vertical list with icon + time** (`ion-list` with colored dots)                          | Horizontal — cramped on mobile                                |
| 6   | Trust Score viz            | **Badge text** `ion-chip` with color — consistent với T-012 mobile                         | Progress bar — inconsistent UX                                |
| 7   | Page limit                 | **20** (match T-011)                                                                       | 50 — too many on mobile screen if admin responsive            |
| 8   | Override button visibility | **Admin + Manager (scope-checked by BE)** — FE hides via `hasRole('admin' \|\| 'manager')` | Admin only — block manager legit override                     |
| 9   | Failed events display      | **Inline timeline** with red `ion-icon alert-circle` + "Thất bại" badge                    | Separate section — harder to correlate with successful events |
| 10  | Export CSV button          | **Defer T-016** — out of scope                                                             | Add now — scope creep                                         |

## Extra decisions

- **D-extra-1**: Override modal's status select **omits `overtime`** (computed automatically per T-009 DTO spec). Match backend `@IsIn(['on_time','late','early_leave','missing_checkout','absent'])`.
- **D-extra-2**: Detail page breadcrumb: "Chấm công > {date} > {employee_code}" — helps navigation.
- **D-extra-3**: After override success, refresh detail page — show new status + new audit entry (not visible to user but backend logs).
- **D-extra-4**: List page default sort: `work_date DESC` (newest first) — not exposed as filter.

## Risk

| Risk                                                                         | Mitigation                                                                                                     |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Bundle size exceeds 2mb budget (T-011 bumped)                                | Lazy-load; 2 new pages (~50kb each). Monitor.                                                                  |
| Date range picker UX: start > end validation                                 | Disable submit button if `date_from > date_to`; inline hint                                                    |
| Manager scope: BE returns 404 for outside-scope detail → FE toast + redirect | Consistent with T-011 `assertScope` pattern                                                                    |
| Override note min validation: 10 chars enforced FE + BE                      | DTO already does; modal shows char count                                                                       |
| Large `events[]` (check-in + check-out + N failed)                           | Limit display to 20 events per session in timeline (none in MVP seed); add "Show all" link if overflow (defer) |
| URL query sync infinite loop (T-011 learning)                                | Use `replaceUrl: true` + compare before update                                                                 |
| Employee search dropdown loads 30+ employees → slow render                   | Use `ion-searchbar` → `ListEmployeesQuery.search` → filter BE; show top 20 matches                             |

## Menu item update (main.layout.html)

```html
<ion-item routerLink="/attendance" routerLinkActive="selected">
  <ion-icon slot="start" name="time-outline"></ion-icon>
  <ion-label>Chấm công</ion-label>
</ion-item>
```

Register `time-outline` in `main.layout.ts` `addIcons()` block.

## Execution steps (sau confirm)

1. Create `shared/types/attendance-session.types.ts`
2. Create `core/attendance/attendance.api.service.ts`
3. Create `pages/attendance/sessions-list.page.{ts,html}`
4. Create `pages/attendance/session-detail.page.{ts,html}`
5. Create `pages/attendance/override-session.modal.{ts,html}`
6. Update `layout/main.layout.{ts,html}` — menu item + icon
7. Update `app.routes.ts` — 2 new routes under layout children
8. `pnpm nx reset && pnpm nx lint portal && pnpm nx test portal`
9. `pnpm nx serve portal` + `pnpm nx serve api` → manual browser test
10. `git status` — user review
11. **Không commit** — user verifies + commits

## Smoke test (browser — you verify)

1. Admin login → menu has **Chấm công** → click → list page
2. Filter by branch (HCM-Q1) → 10 employees' sessions shown
3. Filter date_from=2026-04-10 date_to=2026-04-17 → only that range
4. Status filter "late" → only late sessions
5. Click row → detail page with events timeline + GPS coords + WiFi
6. Click "Override" → modal → select status "late", note="Test override confirm" (10+ chars) → submit → toast success + badge updated
7. Manager login → `/attendance` → badge "Chỉ xem" + only HCM-Q1 sessions
8. Manager try `/attendance/<DN-session-id>` → toast error + redirect
9. F5 → URL query params preserved
10. Admin click session detail → events show ALL (including any failed from T-009 smoke)

## Acceptance mapping (docs/tasks.md T-013)

- [ ] Mobile list smooth (200 rows) → **DONE in T-012** ✅
- [ ] Portal filter working → smoke 2-4 ✅
- [ ] Override → audit log entry → smoke 6 + verify via psql `SELECT * FROM audit_logs WHERE action='override'` ✅

## Review checklist

- [ ] URL query sync works (F5 preserves filter) → smoke 9 ✅
- [ ] Manager scope hides Override for non-own branches → backend enforces via 404 ✅
- [ ] Override note validation (≥10 chars) → FE validator + BE DTO ✅

Reply `OK hết` hoặc # + extra# cần đổi → exec.
