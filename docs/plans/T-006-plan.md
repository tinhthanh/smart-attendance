# T-006 Plan — Branches CRUD + WiFi/Geofence

> Generated 2026-04-16. Branch: `feature/branches-crud`.

## Pre-work verify

| Check                                                                                                             | Status         |
| ----------------------------------------------------------------------------------------------------------------- | -------------- |
| `libs/api/common` có PrismaService + ResponseInterceptor + Filter + BusinessException + ErrorCode + PaginationDto | ✅ reuse       |
| `libs/api/auth` có `@Roles()`, `@CurrentUser()`, JwtAuthGuard global                                              | ✅ reuse       |
| Schema có `Branch`, `BranchWifiConfig`, `BranchGeofence`, `Employee.primaryBranchId`, `EmployeeBranchAssignment`  | ✅ không touch |
| `AuditAction` enum đã có `create`, `update`, `delete`                                                             | ✅             |

## No schema change. No new deps.

Các packages cần dùng đã cài: `class-validator`, `class-transformer`, `@prisma/client`. Nx generator cho lib mới không install gì thêm.

## Library + file structure

```
libs/api/branches/
├── src/
│   ├── index.ts
│   └── lib/
│       ├── branches.module.ts
│       ├── branches.controller.ts
│       ├── branches.service.ts
│       ├── branch-wifi-configs.controller.ts
│       ├── branch-wifi-configs.service.ts
│       ├── branch-geofences.controller.ts
│       ├── branch-geofences.service.ts
│       ├── branch-scope.helper.ts              # getManagerBranchIds(user)
│       ├── dto/
│       │   ├── create-branch.dto.ts
│       │   ├── update-branch.dto.ts
│       │   ├── list-branches-query.dto.ts
│       │   ├── create-wifi-config.dto.ts
│       │   └── create-geofence.dto.ts
│       └── *.spec.ts                           # unit tests

libs/api/common/                                 # MODIFY
├── src/lib/
│   ├── audit-log.service.ts                   # NEW (Decision #4)
│   └── pagination.util.ts                     # NEW — buildMeta(total,page,limit)

apps/api/src/app/app.module.ts                   # MODIFY — import BranchesModule
```

Import path mới: `@smart-attendance/api/branches`.

## Endpoints — 10 endpoints

| Method | Path                                   | Role           | Query / Body                     | Scope                                                        |
| ------ | -------------------------------------- | -------------- | -------------------------------- | ------------------------------------------------------------ |
| GET    | `/branches`                            | admin, manager | `?page&limit&status&search&sort` | admin=all, manager=assigned only, employee=403               |
| POST   | `/branches`                            | admin          | `CreateBranchDto`                | —                                                            |
| GET    | `/branches/:id`                        | admin, manager | —                                | manager chỉ được xem branch assigned (404 nếu outside scope) |
| PATCH  | `/branches/:id`                        | admin          | `UpdateBranchDto`                | —                                                            |
| DELETE | `/branches/:id`                        | admin          | —                                | soft delete, 409 nếu active employees                        |
| GET    | `/branches/:id/wifi-configs`           | admin, manager | —                                | scope check                                                  |
| POST   | `/branches/:id/wifi-configs`           | admin          | `CreateWifiConfigDto`            | —                                                            |
| DELETE | `/branches/:id/wifi-configs/:configId` | admin          | —                                | hard delete (audit log), revertable via audit                |
| GET    | `/branches/:id/geofences`              | admin, manager | —                                | scope check                                                  |
| POST   | `/branches/:id/geofences`              | admin          | `CreateGeofenceDto`              | —                                                            |

Tất cả protected bởi global `JwtAuthGuard`. Role check via `@Roles('admin')` hoặc `@Roles('admin','manager')`.

## DTOs

```typescript
// create-branch.dto.ts
export class CreateBranchDto {
  @IsString() @Length(3, 20) @Matches(/^[A-Z0-9-]+$/) code!: string;
  @IsString() @Length(1, 200) name!: string;
  @IsOptional() @IsString() @Length(0, 500) address?: string;
  @IsLatitude() latitude!: number;
  @IsLongitude() longitude!: number;
  @IsOptional() @IsInt() @Min(50) @Max(1000) radius_meters?: number;
  @IsOptional() @IsString() timezone?: string;
}

// update-branch.dto.ts  —  PartialType(CreateBranchDto) + status
export class UpdateBranchDto extends PartialType(CreateBranchDto) {
  @IsOptional() @IsIn(['active', 'inactive']) status?: 'active' | 'inactive';
}

// list-branches-query.dto.ts
export class ListBranchesQueryDto extends PaginationDto {
  @IsOptional() @IsIn(['active', 'inactive']) status?: 'active' | 'inactive';
  @IsOptional() @IsString() @Length(1, 50) search?: string;
}

// create-wifi-config.dto.ts
export class CreateWifiConfigDto {
  @IsString() @Length(1, 32) ssid!: string;
  @IsOptional()
  @Matches(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/)
  bssid?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) priority?: number;
  @IsOptional() @IsString() @Length(0, 200) notes?: string;
}

// create-geofence.dto.ts
export class CreateGeofenceDto {
  @IsString() @Length(1, 100) name!: string;
  @IsLatitude() center_lat!: number;
  @IsLongitude() center_lng!: number;
  @IsInt() @Min(10) @Max(2000) radius_meters!: number;
}
```

Note: request JSON uses `snake_case` per api-spec. DTO property names follow that (not camelCase), so `@Body()` binds directly. Service layer translates to Prisma's camelCase.

## Manager scope helper

```typescript
// branch-scope.helper.ts
export async function getManagerBranchIds(prisma: PrismaService, userId: string): Promise<string[]> {
  const emp = await prisma.employee.findFirst({
    where: { userId },
    select: { primaryBranchId: true, assignments: { where: { effectiveTo: null }, select: { branchId: true } } },
  });
  if (!emp) return [];
  const ids = new Set<string>([emp.primaryBranchId]);
  emp.assignments.forEach((a) => ids.add(a.branchId));
  return Array.from(ids);
}
```

`BranchesService.list` dùng helper → nếu user.roles has `admin` → không filter; else filter by returned ids. Manager without employee record → empty array → 0 results (defensive).

## Audit log integration

**Decision #4 → tạo `AuditLogService` trong `libs/api/common`.** T-007+ sẽ reuse. Structure:

```typescript
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    tx: Prisma.TransactionClient,
    entry: {
      userId: string;
      action: 'create' | 'update' | 'delete' | 'override';
      entityType: string;
      entityId?: string;
      before?: unknown;
      after?: unknown;
      ipAddress?: string;
      userAgent?: string;
    }
  ) {
    await tx.auditLog.create({ data: entry });
  }
}
```

Usage: branches service wraps mutation trong `prisma.$transaction` → pass `tx` vào `audit.log(tx, ...)`. Service nhận `RequestContext` (ipAddress, userAgent) — param decorator helper.

## Soft delete semantics

- `DELETE /branches/:id` → `status = 'inactive'`, `updatedAt = now()`.
- **Pre-check**: `SELECT count(*) FROM employees WHERE primary_branch_id = :id AND employment_status = 'active'` > 0 → `409 CONFLICT` code `BRANCH_HAS_ACTIVE_EMPLOYEES`. Thêm code này vào `ErrorCode` enum.
- KHÔNG cascade wifi/geofence — giữ config để audit. Check-in flow (T-009) phải filter `branch.status === 'active'` để skip.
- Không có `/branches/:id/restore` trong MVP. Admin có thể `PATCH { status: 'active' }` — document trong api-spec update sau.

## Pagination util

```typescript
// libs/api/common/src/lib/pagination.util.ts
export function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  return { page, limit, total, total_pages: Math.ceil(total / limit) };
}
```

Note: api-spec §1.3 dùng `total_pages` (snake). PaginationMeta interface hiện tại dùng `totalPages`. **Cần thay đổi** interface → `total_pages` (snake_case) để match api contract. Affects `libs/api/common/src/lib/types/api-response.type.ts`.

## Unit tests (target ≥80% coverage)

**BranchesService**:

- `should return all branches when user has admin role`
- `should return only assigned branches when user has manager role`
- `should return branch with wifi_configs and geofences when getOne called with valid id`
- `should throw NOT_FOUND when getOne called with id outside manager scope`
- `should create branch with audit log when admin calls create`
- `should update partial fields and log audit diff when admin calls update`
- `should throw CONFLICT when deleting branch with active employees`
- `should soft delete and log audit when deleting empty branch`
- `should apply pagination meta correctly when list called with page=2`
- `should filter by search LIKE code and name when search query provided`

**BranchWifiConfigsService**:

- `should create wifi config when BSSID valid MAC format`
- `should throw VALIDATION_FAILED when BSSID malformed` (DTO-level, covered by controller e2e; service test with valid inputs)
- `should delete wifi config when admin calls delete`

**BranchGeofencesService**:

- `should create geofence when payload valid`
- `should list geofences by branch`

**getManagerBranchIds**:

- `should return primary + assignment branches when user has employee`
- `should return empty array when user has no employee record`

## Smoke test (sau exec)

```bash
# pre: login admin + manager to get tokens
ADMIN=$(curl -sS -X POST http://localhost:3000/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@demo.com","password":"Admin@123"}' | jq -r .data.access_token)
MANAGER=$(curl -sS -X POST http://localhost:3000/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"manager.hcm@demo.com","password":"Manager@123"}' | jq -r .data.access_token)

# 1. Admin POST /branches → 201
curl -sS -X POST http://localhost:3000/api/v1/branches -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d '{"code":"HP-LeChan","name":"Hải Phòng Lê Chân","latitude":20.8449,"longitude":106.6881}' | jq .

# 2. Admin GET /branches → 4 rows (3 seed + 1 new)
curl -sS http://localhost:3000/api/v1/branches -H "Authorization: Bearer $ADMIN" | jq '.data | length, .meta'

# 3. Manager GET /branches → 1 row (HCM-Q1 only)
curl -sS http://localhost:3000/api/v1/branches -H "Authorization: Bearer $MANAGER" | jq '.data[].code, .meta.total'

# 4. Admin POST wifi-config (valid BSSID) → 201
BRANCH_ID=$(curl -sS http://localhost:3000/api/v1/branches -H "Authorization: Bearer $ADMIN" | jq -r '.data[0].id')
curl -sS -X POST http://localhost:3000/api/v1/branches/$BRANCH_ID/wifi-configs -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d '{"ssid":"Smoke-Test","bssid":"AA:BB:CC:DD:EE:FF","priority":5}' | jq .

# 5. Admin POST wifi-config (invalid BSSID) → 400
curl -sS -X POST http://localhost:3000/api/v1/branches/$BRANCH_ID/wifi-configs -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d '{"ssid":"Bad","bssid":"not-a-mac","priority":5}' -w "\nHTTP %{http_code}\n"

# 6. Audit logs
docker exec sa-postgres psql -U sa_app -d smart_attendance -c "SELECT action, entity_type, created_at FROM audit_logs WHERE entity_type IN ('Branch','BranchWifiConfig') ORDER BY created_at DESC LIMIT 5;"
```

## Decisions cần confirm

| #   | Câu hỏi                                           | Recommend                                                                                                                                                              | Alt                                                      |
| --- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1   | Sub-resources: tách service riêng?                | **Tách** (BranchWifiConfigsService + BranchGeofencesService) — single responsibility, test riêng                                                                       | Gộp trong BranchesService — ít file nhưng class to       |
| 2   | Manager scope: helper hay guard?                  | **Helper** `getManagerBranchIds` inject qua service — dễ test                                                                                                          | Custom `BranchScopeGuard` — defer đến khi có pattern lặp |
| 3   | Cascade soft delete wifi/geofence?                | **KHÔNG cascade** — giữ config cho audit; check-in filter `branch.status='active'`                                                                                     | Cascade — mất audit                                      |
| 4   | AuditLogService trong common?                     | **Có** — reuse T-007+. `log(tx, entry)` accept transaction client                                                                                                      | Inline trong từng service — duplicate logic              |
| 5   | Validation messages                               | **English default** — consistency với error codes. i18n defer.                                                                                                         | Vietnamese                                               |
| 6   | Sort default                                      | **`created_at desc`** — new branches on top                                                                                                                            | `name asc` — alphabetic                                  |
| 7   | `/branches/:id/restore` endpoint                  | **Defer** — admin dùng PATCH `{status:'active'}`                                                                                                                       | Add now                                                  |
| 8   | Search implementation                             | **Prisma `contains` (ILIKE) OR code/name**                                                                                                                             | Tách 2 query union                                       |
| 9   | Geofence overlap check                            | **Defer** out of MVP                                                                                                                                                   | Add complexity now                                       |
| 10  | Check-in radius source (Branch vs BranchGeofence) | **Document** — primary: `BranchGeofence.radius_meters` (per-geofence); `Branch.radius_meters` = default khi tạo branch mới không có geofence custom. T-009 sẽ clarify. | Pick one, delete other (schema change — out of scope)    |

## Extra decisions

- **D-extra-1** — `PaginationMeta.totalPages` → rename `total_pages` (snake) để match api-spec §1.3. Breaking change to `libs/api/common` types — update interceptor + any consumers. Currently no consumer outside branches (Auth không trả meta). Safe to rename now.
- **D-extra-2** — BranchesService signature: nhận full `AuthUser` (slim `{id, email, roles}`) để check role + scope. Helper `isAdmin(user)` = `user.roles.includes('admin')`.
- **D-extra-3** — `ErrorCode` thêm `BRANCH_HAS_ACTIVE_EMPLOYEES`.

## Risk

| Risk                                                                                      | Mitigation                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Decimal(10,7) Prisma type trả `Prisma.Decimal` (không number) cho latitude/longitude      | Service map → `.toNumber()` khi trả về response                                                                                                                                                 |
| Manager không có Employee record → scope empty → thấy 0 branches (có vẻ như 403)          | Helper trả `[]` → list returns empty data. Controller-level `@Roles('admin','manager')` đã chặn non-role. Behavior correct: manager "mất" employee record là data error, không phải auth error. |
| `ILIKE` search trên Postgres case-insensitive đã default với Prisma `mode: 'insensitive'` | Use `{ mode: 'insensitive' }` trong Prisma where                                                                                                                                                |
| Audit log trong `$transaction` với nhiều operations → transaction lớn                     | Branches mutations nhỏ (1-2 query) → OK. Document cap.                                                                                                                                          |
| `total_pages` snake rename break existing test hoặc Auth response meta                    | Auth không dùng meta. Grep repo — chỉ response-transform interceptor + types reference. Rename an toàn.                                                                                         |
| BSSID regex cho phép cả `-` separator không?                                              | Chỉ `:` theo api-spec example. Update regex nếu cần support both. Recommend `:` only.                                                                                                           |

## Execution steps (sau confirm)

1. Rename `PaginationMeta.totalPages` → `total_pages` (D-extra-1). Update usages (chỉ interceptor/type). Run existing tests → still pass.
2. Thêm `BRANCH_HAS_ACTIVE_EMPLOYEES` vào `ErrorCode`.
3. Tạo `libs/api/common/src/lib/audit-log.service.ts` + export. Thêm `AuditLogService` vào `PrismaModule` providers/exports (hoặc module mới `AuditModule`) — **Decision: add vào `PrismaModule` exports để @Global tự inject**. Confirm hay tách `AuditModule`?
4. Tạo `libs/api/common/src/lib/pagination.util.ts` + export.
5. Generate lib: `nx g @nx/nest:lib --name=branches --directory=libs/api/branches --importPath=@smart-attendance/api/branches ...`
6. Tạo files: service, controller, sub-controllers/services, DTOs, scope helper, specs.
7. Update `apps/api/src/app/app.module.ts` → import `BranchesModule`.
8. `pnpm nx reset && pnpm nx test branches common auth` → all pass.
9. Start api + run smoke (6 commands).
10. Verify audit_logs entries qua psql.
11. `git status` cho user review.
12. **Không commit.**

## Acceptance mapping

- [ ] Admin GET all → smoke 2 ✅
- [ ] Manager GET scope → smoke 3 ✅
- [ ] Employee GET → 403 (global @Roles admin/manager) — add test case: `should return 403 when employee role calls list` ✅
- [ ] Pagination meta format → test `should apply pagination meta correctly` ✅
- [ ] DELETE with active employees → 409 → unit test ✅
- [ ] Audit log entries → smoke 6 + unit test `should create audit log when admin creates branch` ✅

## Review checklist

- [ ] Mọi `findMany` có `take` (PaginationDto.limit) ✅
- [ ] `branch_id` filter applied trong manager scope ✅
- [ ] BSSID regex MAC ✅
- [ ] Geofence `radius_meters > 0` via `@Min(10)` ✅

Reply `OK hết` hoặc # cần đổi → exec.
