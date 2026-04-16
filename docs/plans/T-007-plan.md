# T-007 Plan — Employees CRUD + assignments + devices

> Generated 2026-04-16. Branch: `feature/employees-crud`. No schema change, no new deps.

## Pre-work verify

| Check                                                                                                      | Status                             |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `libs/api/common.AuditLogService.logInTransaction(tx, ...)` sẵn sàng                                       | ✅                                 |
| `libs/api/common.buildPaginationMeta` + `PaginationDto`                                                    | ✅                                 |
| `libs/api/branches.branch-scope.helper.ts` — `isAdmin`, `getManagerBranchIds`                              | ✅ (Decision #2: move sang common) |
| Schema: `User`, `Employee`, `UserRole`, `Role`, `Department`, `EmployeeBranchAssignment`, `EmployeeDevice` | ✅                                 |
| `RoleCode` enum trong Prisma: `admin`, `manager`, `employee`                                               | ✅                                 |
| `bcrypt` đã cài (T-003)                                                                                    | ✅                                 |

## Library + file structure

```
libs/api/employees/                               # NEW
├── src/
│   ├── index.ts
│   └── lib/
│       ├── employees.module.ts
│       ├── employees.controller.ts
│       ├── employees.service.ts
│       ├── employee-assignments.controller.ts
│       ├── employee-assignments.service.ts
│       ├── employee-devices.controller.ts
│       ├── employee-devices.service.ts
│       ├── dto/
│       │   ├── create-employee.dto.ts
│       │   ├── update-employee.dto.ts
│       │   ├── list-employees-query.dto.ts
│       │   ├── create-assignment.dto.ts
│       │   └── update-device.dto.ts
│       └── *.spec.ts

libs/api/common/                                  # MODIFY
├── src/lib/
│   ├── user-scope.helper.ts                    # NEW — MOVED from branches
│   └── (unchanged others)

libs/api/branches/                                # MODIFY
└── src/lib/branch-scope.helper.ts             # keep re-export for back-compat
                                                  # OR delete + update imports

apps/api/src/app/app.module.ts                   # MODIFY — +EmployeesModule
```

Import path mới: `@smart-attendance/api/employees`.

## Endpoints — 6 endpoints

| Method | Path                               | Role           | Body / Query                                        | Notes                         |
| ------ | ---------------------------------- | -------------- | --------------------------------------------------- | ----------------------------- |
| GET    | `/employees`                       | admin, manager | `?branch_id&department_id&status&search&page&limit` | admin=all, manager=scope      |
| POST   | `/employees`                       | admin          | `CreateEmployeeDto`                                 | **atomic** user+employee+role |
| PATCH  | `/employees/:id`                   | admin          | `UpdateEmployeeDto`                                 | KHÔNG cho đổi email/password  |
| POST   | `/employees/:id/assignments`       | admin          | `CreateAssignmentDto`                               | add secondary branch          |
| GET    | `/employees/:id/devices`           | admin, manager | —                                                   | scope check                   |
| PATCH  | `/employees/:id/devices/:deviceId` | admin, manager | `UpdateDeviceDto`                                   | toggle `is_trusted`           |

## Atomic create flow

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Validate primary_branch_id + department_id tồn tại
  const [branch, dept] = await Promise.all([
    tx.branch.findUnique({ where: { id: dto.primary_branch_id } }),
    dto.department_id ? tx.department.findUnique({ where: { id: dto.department_id } }) : null,
  ]);
  if (!branch) throw BusinessException(NOT_FOUND, 'Branch not found');
  if (dto.department_id && !dept) throw BusinessException(NOT_FOUND, 'Department not found');

  // 2. Check email / employee_code unique
  const [existingEmail, existingCode] = await Promise.all([
    tx.user.findUnique({ where: { email: dto.email } }),
    tx.employee.findUnique({ where: { employeeCode: dto.employee_code } }),
  ]);
  if (existingEmail) throw BusinessException(CONFLICT, 'Email taken');
  if (existingCode) throw BusinessException(CONFLICT, 'Employee code taken');

  // 3. Create user with bcrypt hash rounds=10
  const user = await tx.user.create({
    data: {
      email: dto.email,
      passwordHash: bcrypt.hashSync(dto.password, 10),
      fullName: dto.full_name,
      phone: dto.phone,
    },
  });

  // 4. Lookup role → create UserRole
  const role = await tx.role.findUnique({ where: { code: dto.role } });
  if (!role) throw BusinessException(VALIDATION_FAILED, `Role ${dto.role} not seeded`);
  await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });

  // 5. Create employee
  const employee = await tx.employee.create({
    data: {
      userId: user.id,
      employeeCode: dto.employee_code,
      primaryBranchId: dto.primary_branch_id,
      departmentId: dto.department_id,
    },
    include: { primaryBranch: true, department: true, user: { select: {id,email,fullName,phone} } },
  });

  // 6. Audit log
  await audit.logInTransaction(tx, { userId: actor.id, action: 'create', entityType: 'Employee', entityId: employee.id, after: { ... } });

  return toEmployeeResponse(employee);
});
```

**Rollback guarantee** — Prisma `$transaction(async fn)` runs all in single DB transaction. Any throw → ROLLBACK → no partial state.

## Scope helper — MOVE to libs/api/common

Decision #2: move `isAdmin`, `getManagerBranchIds` → `libs/api/common/src/lib/user-scope.helper.ts`. Rationale:

- Employees module (T-007), Attendance (T-009), Reports (T-010) đều cần same logic
- Avoid cross-lib import `branches → employees`
- `branches/branch-scope.helper.ts` → simple re-export + deprecation note, to delete in follow-up

## DTOs

```typescript
// create-employee.dto.ts
export class CreateEmployeeDto {
  @IsEmail() email!: string;
  @IsString() @Length(8, 100) password!: string;
  @IsString() @Length(1, 100) full_name!: string;
  @IsOptional() @Matches(/^[0-9+\-\s()]{8,20}$/) phone?: string;
  @IsString() @Length(1, 30) @Matches(/^[A-Z0-9-]+$/) employee_code!: string;
  @IsUUID() primary_branch_id!: string;
  @IsOptional() @IsUUID() department_id?: string;
  @IsIn(['admin', 'manager', 'employee']) role!: 'admin' | 'manager' | 'employee';
}

// update-employee.dto.ts — KHÔNG cho đổi email/password/employee_code
export class UpdateEmployeeDto {
  @IsOptional() @IsString() @Length(1, 100) full_name?: string;
  @IsOptional() @Matches(/^[0-9+\-\s()]{8,20}$/) phone?: string;
  @IsOptional() @IsUUID() primary_branch_id?: string;
  @IsOptional() @IsUUID() department_id?: string;
  @IsOptional() @IsIn(['active', 'on_leave', 'terminated']) employment_status?: string;
}

// list-employees-query.dto.ts
export class ListEmployeesQueryDto extends PaginationDto {
  @IsOptional() @IsUUID() branch_id?: string;
  @IsOptional() @IsUUID() department_id?: string;
  @IsOptional() @IsIn(['active', 'on_leave', 'terminated']) status?: string;
  @IsOptional() @IsString() @Length(1, 50) search?: string; // email|full_name|employee_code
}

// create-assignment.dto.ts
export class CreateAssignmentDto {
  @IsUUID() branch_id!: string;
  @IsIn(['primary', 'secondary', 'temporary']) assignment_type!: string;
  @IsISO8601() effective_from!: string; // YYYY-MM-DD
  @IsOptional() @IsISO8601() effective_to?: string;
}

// update-device.dto.ts
export class UpdateDeviceDto {
  @IsBoolean() is_trusted!: boolean;
}
```

## Response shape (no password_hash ever)

```typescript
function toEmployeeResponse(emp: EmployeeWithRelations) {
  return {
    id: emp.id,
    employee_code: emp.employeeCode,
    employment_status: emp.employmentStatus,
    user: { id: emp.user.id, full_name: emp.user.fullName, email: emp.user.email, phone: emp.user.phone },
    primary_branch: emp.primaryBranch ? { id, name } : null,
    department: emp.department ? { id, name } : null,
  };
}
```

Service KHÔNG select `passwordHash` bao giờ — strict include shape.

## Manager scope for /employees

```typescript
if (!isAdmin(user)) {
  const branchIds = await getManagerBranchIds(prisma, user.id);
  where.OR = [{ primaryBranchId: { in: branchIds } }, { assignments: { some: { branchId: { in: branchIds }, effectiveTo: null } } }];
}
```

Nếu manager không phải admin + query `branch_id` → validate branch_id ∈ manager's scope. Else 404.

## Device is_trusted flow

```typescript
// PATCH /employees/:id/devices/:deviceId
await prisma.$transaction(async (tx) => {
  const device = await tx.employeeDevice.findFirst({ where: { id, employeeId } });
  if (!device) throw NOT_FOUND;
  // scope check: admin hoặc employee's branch ∈ manager scope
  await service.assertEmployeeScope(user, employeeId);

  const after = await tx.employeeDevice.update({
    where: { id: deviceId },
    data: { isTrusted: dto.is_trusted },
  });
  await audit.logInTransaction(tx, {
    userId: actor.id,
    action: 'update',
    entityType: 'EmployeeDevice',
    entityId: deviceId,
    before: { is_trusted: device.isTrusted },
    after: { is_trusted: after.isTrusted },
  });
});
```

Attendance flow (T-009) sẽ đọc `isTrusted` mỗi check-in → PATCH này reflect ngay.

## Unit tests (target ≥60% per CLAUDE.md §4.6)

**EmployeesService**:

- `should create user+employee+userRole atomically when admin calls create`
- `should rollback user when employee create fails` (test: mock tx.employee.create throw → tx.user.findFirst == null sau)
- `should throw CONFLICT when email already taken`
- `should throw CONFLICT when employee_code already taken`
- `should throw NOT_FOUND when primary_branch_id missing`
- `should list only branch-scoped employees when user has manager role`
- `should list all employees when user has admin role`
- `should apply search filter on email/full_name/employee_code when search provided`
- `should NOT return passwordHash in any response shape`
- `should throw NOT_FOUND when manager tries PATCH employee outside scope`
- `should set employment_status to terminated when PATCH terminated called`

**EmployeeAssignmentsService**:

- `should create secondary assignment with audit log when admin calls`
- `should throw VALIDATION_FAILED when effective_to < effective_from`

**EmployeeDevicesService**:

- `should toggle is_trusted and audit when admin calls update`
- `should list devices only when scope valid`

**user-scope.helper**:

- `should return admin short-circuit`
- `should return scoped ids for manager`
- `should return empty for employee without employee record`

## Smoke test (curl)

```bash
ADMIN=$(login admin)
MANAGER=$(login manager.hcm)

# 1. Admin POST /employees → 201 atomic
curl -sS -X POST .../employees -H "Authorization: Bearer $ADMIN" -d '{"email":"e100@demo.com","password":"Temp@12345","full_name":"Test Emp","employee_code":"EMP-TEST-100","primary_branch_id":"<hcm-id>","role":"employee"}'
# expect: data.id, data.user.email, NO passwordHash

# 2. Admin GET /employees?search=e100 → has 1 result
# 3. Manager GET /employees → only HCM-Q1 employees (10 seed + test one = 11)
# 4. Admin PATCH /employees/:id { employment_status: 'terminated' } → 200
# 5. Admin POST /employees/:id/assignments → secondary branch assigned
# 6. Manager outside HCM → GET /employees/<dn-employee-id> → 404

# 7. Verify audit logs
docker exec sa-postgres psql -c "SELECT action, entity_type FROM audit_logs WHERE entity_type IN ('Employee','UserRole','EmployeeBranchAssignment','EmployeeDevice') ORDER BY created_at DESC LIMIT 10;"
```

## Decisions — recommendations

| #   | Câu hỏi                                      | Recommend                                                                 | Alt                                            |
| --- | -------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------- |
| 1   | 3 services hay gộp?                          | **Tách 3** (SRP, match T-006 pattern)                                     | Gộp — class lớn                                |
| 2   | Scope helper move sang common?               | **Move** `libs/api/common/user-scope.helper.ts` — reuse T-009/T-010/T-011 | Import chéo branches → employees               |
| 3   | Password update qua PATCH?                   | **Defer** — PATCH chỉ profile fields                                      | Add ngay — tăng scope                          |
| 4   | Terminated → revoke refresh ngay?            | **Defer** — thêm Lifecycle hook sau                                       | Add ngay (risk scope creep)                    |
| 5   | POST role field                              | **Required** — client phải chỉ rõ                                         | Default 'employee' — dễ tạo admin/manager nhầm |
| 6   | Employee code regex                          | **`^[A-Z0-9-]+$`** Length 1-30 (match seed `HCMQ1-EMP-001`)               | `^EMP\d{3,6}$` strict — phá seed hiện có       |
| 7   | Search scope                                 | **email OR full_name OR employee_code** (ILIKE)                           | 1 field duy nhất                               |
| 8   | Device fingerprint upsert khi check-in trùng | **Upsert** — handle trong T-009 (out of T-007)                            | Ngoài scope                                    |
| 9   | Email invite on POST?                        | **Defer** — out of MVP                                                    | Add SMTP dep                                   |
| 10  | Audit entityType atomic create               | **'Employee' only** với `after.user_id` inline                            | Log `Employee` + `User` separate — bội audit   |

## Extra decisions

- **D-extra-1**: **Không tự-create `admin` role user qua endpoint** — security risk. Ràng buộc trong DTO: nếu `role === 'admin'` và actor không phải admin → 403. (Actor is admin by guard, so OK — but guard against elevating role via query injection). Plan: keep `@IsIn(['admin','manager','employee'])`, rely on `@Roles('admin')` guard + log audit.

- **D-extra-2**: **Rename primaryBranchId → primary_branch_id trong response**. Service map strict snake_case output.

- **D-extra-3**: **`assertEmployeeScope` helper** trong `EmployeesService` (hoặc scope helper common). Reused cho devices + assignments + update endpoints. Similar to `BranchesService.assertScope`.

## Risk

| Risk                                                         | Mitigation                                                                                                              |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Seed passwordHash bị expose nếu quên omit                    | Strict DTO + spec test: "should NOT return passwordHash"                                                                |
| Move scope helper → branches lib broken import               | Keep re-export trong branch-scope.helper.ts: `export * from '@smart-attendance/api/common'`                             |
| Manager with `branch_id` query outside scope                 | Service: if `branch_id` not in `getManagerBranchIds(user)` → 404                                                        |
| `$transaction` mock test tx undefined (T-006 issue)          | Use `mock.calls[0][1]` pattern, same workaround                                                                         |
| PATCH device isTrusted phá trust score đang compute (T-008+) | Trust Score recompute per check-in event. PATCH chỉ ảnh hưởng từ now forward. No race.                                  |
| POST `role: 'admin'` tạo admin user qua API                  | Already guarded by `@Roles('admin')` — only admin can call. Audit log có actor + role giúp forensic. Không block ở DTO. |
| Rollback transaction test trên real DB phức tạp              | Unit test đủ — mock prisma.$transaction throw → verify no .create called                                                |

## Execution steps (sau confirm)

1. Move scope helper: tạo `libs/api/common/src/lib/user-scope.helper.ts` từ branch-scope.helper content. Update `libs/api/common/src/index.ts` export. Branches lib re-export:
   ```ts
   // libs/api/branches/src/lib/branch-scope.helper.ts — keep for backward compat
   export { isAdmin, getManagerBranchIds, UserRolesContext } from '@smart-attendance/api/common';
   ```
2. Generate lib: `nx g @nx/nest:lib --name=employees --directory=libs/api/employees --importPath=@smart-attendance/api/employees ...`
3. DTOs (5 files)
4. Services (3) + Controllers (3)
5. Module
6. Update app.module.ts — import EmployeesModule
7. Unit tests
8. `pnpm nx reset && pnpm nx test employees common auth branches`
9. Start api + curl smoke (7 cases)
10. Verify audit logs in psql
11. Cleanup test data (delete `EMP-TEST-100`)
12. `git status` — no commit

## Acceptance mapping (docs/tasks.md T-007)

- [ ] Admin create → user+employee+role atomic → smoke 1 ✅
- [ ] Rollback on throw → unit test `should rollback...` ✅
- [ ] Manager không thấy branch khác → smoke 3 + 6 ✅
- [ ] PATCH is_trusted reflect → smoke 4 + docs note ✅

## Review checklist

- [ ] No password_hash in response → explicit DTO + spec test ✅
- [ ] Validate primary_branch + department tồn tại → atomic step 1 ✅
- [ ] Manager scope enforced → atomic + list filter + assertEmployeeScope ✅
- [ ] Audit log cho mọi mutation → logInTransaction 5 chỗ ✅

Reply `OK hết` hoặc # + extra# cần đổi → exec.
