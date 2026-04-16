# T-011 Plan — Portal Branches & Employees CRUD UI

> Generated 2026-04-16. Branch: `feature/portal-crud-ui`. Day 3 task 2 — 90' AI. Builds on T-010 auth shell.

## Pre-work verify

| Check                                                                       | Status                                   |
| --------------------------------------------------------------------------- | ---------------------------------------- |
| T-010 merged: AuthService, Interceptor, Guard, ApiService, Login, Dashboard | ✅                                       |
| Proxy config working (`/api/v1` → `:3000`)                                  | ✅                                       |
| Ionic CSS + provideIonicAngular wired                                       | ✅                                       |
| Backend CRUD endpoints (branches + employees) ready                         | ✅ (T-006, T-007)                        |
| Manager scope enforced in backend                                           | ✅                                       |
| `authService.hasRole()` signal available                                    | ✅                                       |
| Jest Ionic ESM fix applied in `apps/portal/jest.config.ts`                  | ✅ (T-010 follow-up merged in `b4f68d9`) |

## No backend changes. No new deps.

Ionic modal/alert/toast controllers already available via `@ionic/angular/standalone`. Reactive forms already in use (T-010 login).

## File structure

```
apps/portal/src/app/
├── layout/
│   ├── main.layout.ts                       # NEW — ion-menu + router-outlet shell
│   └── main.layout.html
├── core/
│   ├── branches/
│   │   └── branches.api.service.ts         # list/get/create/update/remove + wifi + geofences
│   └── employees/
│       └── employees.api.service.ts        # list/get/create/update + assignments + devices
├── shared/
│   └── types/
│       ├── branch.types.ts                 # Branch, WifiConfig, Geofence DTOs (FE-only)
│       └── employee.types.ts
├── pages/
│   ├── dashboard/                          # existing (T-010)
│   ├── branches/
│   │   ├── branches-list.page.ts
│   │   ├── branches-list.page.html
│   │   ├── branch-form.modal.ts
│   │   ├── branch-form.modal.html
│   │   ├── branch-detail.page.ts
│   │   ├── branch-detail.page.html
│   │   └── wifi-geofence-tabs/
│   │       ├── wifi-configs.tab.ts          # inline template OK (<50 lines)
│   │       └── geofences.tab.ts
│   └── employees/
│       ├── employees-list.page.ts
│       ├── employees-list.page.html
│       ├── employee-form.modal.ts
│       ├── employee-form.modal.html
│       ├── employee-detail.page.ts
│       └── employee-detail.page.html
└── app.routes.ts                            # MODIFY: layout wrapper + nested routes
```

## Routes (nested via layout)

```typescript
{ path: '', redirectTo: 'dashboard', pathMatch: 'full' },
{ path: 'login', loadComponent: () => import('./pages/login/login.page')... },
{
  path: '',
  canActivate: [authGuard],
  loadComponent: () => import('./layout/main.layout').then((m) => m.MainLayout),
  children: [
    { path: 'dashboard', loadComponent: () => ...dashboard.page },
    { path: 'branches', loadComponent: () => ...branches-list.page },
    { path: 'branches/:id', loadComponent: () => ...branch-detail.page },
    { path: 'employees', loadComponent: () => ...employees-list.page },
    { path: 'employees/:id', loadComponent: () => ...employee-detail.page },
  ],
},
```

## Layout (`main.layout.ts`)

- `<ion-split-pane>` for responsive (menu drawer trên desktop, hamburger trên mobile)
- `<ion-menu>` left side: Dashboard, Branches, Employees, Logout
- `<ion-router-outlet>` main area
- User chip ở bottom menu (full_name + role badge)
- Menu items ẩn theo role: Branches/Employees luôn hiện; admin-only actions trong page

## Service design

```typescript
// branches.api.service.ts
@Injectable({ providedIn: 'root' })
export class BranchesApiService {
  private api = inject(ApiService);

  list(query: ListBranchesQuery): Observable<BranchListResponse> { return this.api.get(`/branches?${qs(query)}`); }
  get(id: string): Observable<BranchDetailResponse> { return this.api.get(`/branches/${id}`); }
  create(dto: CreateBranchDto): Observable<BranchResponse> { return this.api.post('/branches', dto); }
  update(id: string, dto: UpdateBranchDto): Observable<BranchResponse> { return this.api.patch(`/branches/${id}`, dto); }
  remove(id: string): Observable<{ data: { success: boolean } }> { return this.api.delete(`/branches/${id}`); }

  listWifi(branchId): Observable<...>
  createWifi(branchId, dto): Observable<...>
  deleteWifi(branchId, configId): Observable<...>
  listGeofences(branchId): Observable<...>
  createGeofence(branchId, dto): Observable<...>
}
```

## State pattern — Signal in page component (Decision #1)

No service-level store. Pattern:

```typescript
readonly branches = signal<Branch[]>([]);
readonly meta = signal<PaginationMeta | null>(null);
readonly loading = signal(false);
readonly query = signal<ListBranchesQuery>({ page: 1, limit: 20 });

async ngOnInit() {
  effect(() => this.reload(this.query()));  // auto-reload on query change
}

async reload(q: ListBranchesQuery) {
  this.loading.set(true);
  try {
    const resp = await firstValueFrom(this.api.list(q));
    this.branches.set(resp.data);
    this.meta.set(resp.meta);
  } catch (err) { /* toast */ } finally { this.loading.set(false); }
}
```

## Pages spec

### `/branches` list

- `ion-searchbar` (search debounce 300ms)
- `ion-select` status filter (all / active / inactive)
- `ion-list` of `ion-item` (code, name, employee_count chip)
- `ion-item-options` sliding: Edit (admin), Delete (admin)
- `ion-fab` bottom-right: + Create (admin only, `hasRole('admin')`)
- Pagination: Next/Prev buttons (Decision #2)
- Click item → navigate `/branches/:id`
- Empty state: "Không có chi nhánh nào"

### Branch form modal (create + edit shared)

- `ion-modal` via `ModalController`
- Reactive form: code, name, address, latitude, longitude, radius_meters, timezone
- Validators: code regex `^[A-Z0-9-]+$`, lat/lng range, radius 50-1000
- Submit → call `create()` or `update()`, emit result back via `modal.dismiss(result)`
- Error mapping to Vietnamese (reuse `toVietnameseError` pattern from login)

### Branch detail `/branches/:id`

- `ion-header` back button + title
- `ion-tabs` 3 tabs: "Thông tin", "WiFi", "Geofence"
- Info tab: read-only display + Edit button (admin only) → opens branch-form.modal
- WiFi tab: chip list of BSSIDs with X remove button, + Add input
- Geofence tab: list geofences with lat/lng/radius + Add form
- Delete branch button (admin only, bottom of Info tab) → `ion-alert` confirm

### `/employees` list

- `ion-searchbar`
- Filters: branch (ion-select), department (ion-select), status
- `ion-list`: employee_code + name + role chip + branch name
- Sliding edit/delete same pattern
- `ion-fab` Create (admin only)
- Pagination: Next/Prev

### Employee form modal

- Fields: email, password (create only), full_name, phone, employee_code, primary_branch_id (ion-select from BranchesApi.list), department_id (chained select), role
- Edit mode: hide password, email, employee_code (immutable per backend)
- Submit → create or update

### Employee detail `/employees/:id`

- Info section + employment_status edit
- Assignments section: list secondary branches, + Add assignment modal (branch, dates, type)
- Devices section: list devices with trust toggle (admin/manager `hasRole('admin|manager')`)

## Error mapping (expanded from T-010)

```typescript
const ERROR_MESSAGES: Record<string, string> = {
  VALIDATION_FAILED: 'Dữ liệu không hợp lệ',
  INVALID_CREDENTIALS: 'Sai email hoặc mật khẩu',
  CONFLICT: 'Dữ liệu đã tồn tại',
  BRANCH_HAS_ACTIVE_EMPLOYEES: 'Chi nhánh còn nhân viên đang hoạt động',
  EMPLOYEE_CODE_TAKEN: 'Mã nhân viên đã được sử dụng',
  EMAIL_TAKEN: 'Email đã được sử dụng',
  FORBIDDEN: 'Bạn không có quyền thực hiện',
  NOT_FOUND: 'Không tìm thấy',
  TOO_MANY_ATTEMPTS: 'Quá nhiều lần thử',
};
```

Helper `showError(toast, err)` in `core/util/error-toast.util.ts` — reusable.

## Decisions — recommendations

| #   | Câu hỏi                      | Recommend                                                            | Alt                                                  |
| --- | ---------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------- |
| 1   | State mgmt                   | **Signal in page component** (simple, no service store)              | Service store — overkill for MVP                     |
| 2   | Pagination UI                | **Next/Prev buttons + page indicator** (predictable, accessible)     | ion-infinite-scroll — harder to test, loses position |
| 3   | Create/Edit form             | **ion-modal** (same viewport, fast close)                            | Separate route — more clicks                         |
| 4   | Sub-resource (wifi/geofence) | **Tabs trong branch detail** (`/branches/:id` with ion-tabs)         | Separate pages — URL churn                           |
| 5   | Delete confirm               | **ion-alert** với 2 buttons (Hủy / Xóa)                              | Custom modal — more code                             |
| 6   | Filter persistence           | **URL query params** (bookmarkable, shareable, refresh-safe)         | Session-only — lose on refresh                       |
| 7   | Layout menu                  | **ion-split-pane + ion-menu** (side drawer, responsive)              | Top tab bar — limited space                          |
| 8   | Error display                | **Toast** (ion-toast) for submit errors + inline validators for form | Inline only — missed on mobile                       |
| 9   | Empty state                  | **ion-text centered + ionicons** (simple, Ionic-native)              | Custom illustration — bloat                          |
| 10  | Geofence lat/lng             | **Manual input** (number inputs) + copy-from-branch helper button    | Leaflet map picker — defer T-Bonus                   |

## Extra decisions

- **D-extra-1**: `ModalController.create({ component: BranchFormModal, componentProps: { branch } })` returns dismiss data via `onDidDismiss`. Pattern reused for all forms.
- **D-extra-2**: `BranchesApiService` + `EmployeesApiService` in `core/` (not `pages/`) for reuse in detail pages.
- **D-extra-3**: `DebouncedSearchbar` pattern: `toSignal(fromEvent(input, 'ionInput').pipe(debounceTime(300)))` — avoid spam API.
- **D-extra-4**: Manager scope **backend-enforced** (returns 404 if outside scope), frontend just hides Create button — no duplicate logic. Principle: FE is UX, not security.

## Risk

| Risk                                                               | Mitigation                                                                                                 |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Ionic `ion-modal` import list bloat                                | Accept — standalone imports are explicit; IDE auto-import helps                                            |
| Reactive form with ion-select async options (branches dropdown)    | Use `toSignal` + `@if` template block — wait for load before rendering select                              |
| Page navigation loses scroll                                       | Angular router default restores scroll — OK                                                                |
| Delete confirm without transition = user rage-click                | `ion-alert` modal centers + backdrop + requires explicit click                                             |
| Manager sees delete button on own-branch — doesn't have permission | Use `@if (isAdmin())` in template to hide admin-only UI                                                    |
| Pagination state on browser back — lost                            | URL query params (Decision #6) → `Router.navigate([], { queryParams: ..., queryParamsHandling: 'merge' })` |
| Modal form nested scroll conflict with ion-content                 | Known Ionic pattern; use `<ion-content>` inside modal with `fullscreen="false"`                            |
| Large portal bundle size warning                                   | 500kb current budget. CRUD pages ~30kb each lazy-loaded. OK.                                               |

## Execution steps (sau confirm)

1. Create `core/util/error-toast.util.ts` — shared Vietnamese error mapper
2. Create `core/branches/branches.api.service.ts` + `shared/types/branch.types.ts`
3. Create `core/employees/employees.api.service.ts` + `shared/types/employee.types.ts`
4. Create `layout/main.layout.{ts,html}` — ion-split-pane shell
5. Update `app.routes.ts` — layout wrapper with children routes
6. Create `pages/branches/branches-list.page.{ts,html}`
7. Create `pages/branches/branch-form.modal.{ts,html}`
8. Create `pages/branches/branch-detail.page.{ts,html}` + wifi/geofence tabs
9. Create `pages/employees/employees-list.page.{ts,html}`
10. Create `pages/employees/employee-form.modal.{ts,html}`
11. Create `pages/employees/employee-detail.page.{ts,html}`
12. `pnpm nx reset && pnpm nx lint portal && pnpm nx test portal`
13. `pnpm nx serve portal` (+ api) → manual browser test
14. `git status` cho user review
15. **Không commit.**

## Smoke test (browser — you verify after exec)

1. Login admin → menu shows Dashboard / Branches / Employees
2. Click Branches → list 3 seed branches + "Tạo chi nhánh" FAB
3. Click FAB → modal form → submit valid → toast success + list refresh
4. Slide branch row → Edit button → modal pre-filled → submit → list update
5. Slide → Delete → alert confirm → if has active employees → toast "Chi nhánh còn nhân viên đang hoạt động"
6. Click branch → detail page → WiFi tab → + Add → chip appears
7. Branch detail → Geofence tab → + Add → list updates
8. Employees page → filter by branch dropdown → list updates + URL query
9. Logout → login as manager → /branches shows only 1 branch, no FAB visible
10. Delete test data cleanup

## Acceptance mapping (docs/tasks.md T-011)

- [ ] CRUD branch e2e → smoke 3-5 ✅
- [ ] Filter + pagination → list page filters + Next/Prev ✅
- [ ] WiFi config chip → detail page WiFi tab ✅
- [ ] Geofence lat/lng/radius → detail page Geofence tab ✅
- [ ] Employee assign branch → employee-detail page Assignments section ✅

Reply `OK hết` hoặc # + extra# cần đổi → exec.
