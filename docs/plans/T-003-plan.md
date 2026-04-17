# T-003 Plan — Prisma schema + migration + seed

> Generated 2026-04-15. Branch: `feature/db-prisma-init`. Depends on T-002 (Postgres container up, `sa_app` superuser verified).

## Goal
- Schema Prisma match 100% `docs/erd.md §3`
- `pnpm prisma migrate dev --name init` succeeds
- `pnpm prisma db seed` idempotent, tạo seed data theo `docs/spec.md §12`
- `PrismaService` + `PrismaModule` (global) available cho NestJS DI ở T-005+

## Pinned versions (verified via `npm view`)

| Package | Version | Note |
|---|---|---|
| `prisma` (dev) | `6.19.3` | latest 6.x — battle-tested, stable. **Không** pick 7.x vì mới release, breaking changes chưa well-documented, node requirement strict hơn. |
| `@prisma/client` | `6.19.3` | match CLI version (bắt buộc) |
| `bcrypt` | `6.0.0` | native, rounds 10 (spec yêu cầu ≥10) |
| `@types/bcrypt` (dev) | `6.0.0` | |
| `ts-node` | `10.9.2` | đã có sẵn trong workspace (`10.9.1` từ Nx generator — bump lên `10.9.2` cho Prisma seed) |

Peer compat: `@prisma/client@6` yêu cầu `typescript >=5.1` → có TS 5.9.3 ✅. Node requirement `>=18.18` → có node 22.15.1 ✅.

## Folder structure

```
smart-attendance/
├── prisma/                          # NEW — at repo root per CLAUDE.md §3
│   ├── schema.prisma                # copy NGUYÊN VĂN docs/erd.md §3
│   ├── seed.ts                      # idempotent seed script
│   └── migrations/                  # auto-generated sau migrate dev
│       └── <timestamp>_init/
│           └── migration.sql
├── apps/api/src/
│   ├── app/
│   │   ├── app.module.ts            # MODIFY: import PrismaModule
│   │   └── ...
│   └── prisma/                      # NEW
│       ├── prisma.service.ts
│       ├── prisma.module.ts
│       └── index.ts                 # barrel export
└── package.json                     # MODIFY: add "prisma" config + scripts
```

## Commands (sẽ exec)

### Install (1 lệnh)
```
pnpm add -w @prisma/client@6.19.3 bcrypt@6.0.0
pnpm add -Dw prisma@6.19.3 @types/bcrypt@6.0.0
```
(2 lệnh thực ra — tách dep vs dev-dep cho rõ)

### Init Prisma (creates prisma/ folder)
Actually **không** dùng `pnpm prisma init` vì nó overwrite `.env` nếu có — mình tự tạo `prisma/schema.prisma` bằng Write tool (copy nguyên văn ERD §3).

### Generate + migrate
```
pnpm prisma generate                              # generate client vào node_modules/@prisma/client
pnpm prisma migrate dev --name init               # tạo migration đầu + apply
```

### Seed
```
pnpm prisma db seed                               # chạy prisma/seed.ts
```

## package.json — modifications

Thêm vào root `package.json`:

```jsonc
{
  "scripts": {
    // ... existing
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:seed": "prisma db seed",
    "prisma:studio": "prisma studio"
  },
  "prisma": {
    "seed": "ts-node --compiler-options '{\"module\":\"commonjs\"}' prisma/seed.ts"
  }
}
```

Note `--compiler-options module=commonjs`: repo tsconfig dùng `module: esnext` (Angular target); Prisma seed runs qua node, cần CJS override. Standard pattern trong Prisma docs.

**Không** thêm postinstall hook `prisma generate` → gây duplicate run khi install. Developer chủ động `pnpm prisma:generate` sau pull migration mới. CI sẽ add sau.

## PrismaService skeleton

`apps/api/src/prisma/prisma.service.ts`:
```typescript
import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Prisma connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Prisma disconnected');
  }
}
```

`apps/api/src/prisma/prisma.module.ts`:
```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

`app.module.ts` import `PrismaModule` (thêm vào `imports` array).

## Seed strategy (`prisma/seed.ts`)

**Yêu cầu** theo `docs/spec.md §12`:
- 3 branches: `HCM-Q1`, `HN-HoanKiem`, `DN-HaiChau`
  - Mỗi branch: 1 geofence + 1–2 WiFi BSSID
- Mỗi branch: 3 departments (Engineering, Sales, Operations)
- 30 employees (10/branch)
- 3 roles: `admin`, `manager`, `employee` (từ enum `RoleCode`)
- 3 test accounts:
  - `admin@demo.com` / `Admin@123` (role=admin, không gắn employee)
  - `manager.hcm@demo.com` / `Manager@123` (role=manager, HCM-Q1)
  - `employee001@demo.com` / `Employee@123` (role=employee, HCM-Q1)
- 1 `WorkSchedule` default: 08:00–17:00, workdays [1,2,3,4,5]
- `WorkScheduleAssignment` cho cả 30 employees, `effective_from = today - 30d`
- 7 ngày attendance:
  - Mỗi employee/ngày: 1 `AttendanceSession` + 2 `AttendanceEvent` (check_in, check_out)
  - Mix status: ~70% `on_time`, 15% `late`, 10% `early_leave`, 5% `absent` (no session)
  - trust_score: on_time 85–100, late 70–84, early_leave 60–79, flagged rare 30–59

**Idempotency rule:**
- Toàn bộ dùng `upsert` với deterministic unique key (email, code, `(employee_id, work_date)`)
- Tạo trong **transaction** (`prisma.$transaction`) để rollback nếu fail giữa chừng
- Password hash: `bcrypt.hashSync(password, 10)` — rounds=10 theo CLAUDE.md §4 + spec
- Deterministic IDs: dùng `randomUUID()` một lần per record với hash-based seed → cùng seed run 2 lần tạo cùng UUID? **KHÔNG** — `upsert` match theo unique field, không UUID, nên UUID random OK. Chạy lại upsert sẽ UPDATE record cũ, không tạo trùng.

**Date math:** `workDate` = `new Date(Date.UTC(y, m, d))` cắt time portion → khớp `@db.Date`. Base date = hôm nay (2026-04-15), lùi 7 ngày.

**Ordering** (tôn trọng FK):
1. Roles (3 records)
2. Branches (3)
3. Departments (9 = 3×3)
4. BranchWifiConfigs + BranchGeofences
5. Users (33 = 30 employees + 3 test accounts, admin overlap với 1 employee hay không? → admin standalone, KHÔNG có employee record; manager + employee001 CÓ employee record)
6. UserRoles (junction)
7. Employees (30, trong đó 1 là employee001, 1 là manager.hcm; 28 còn lại random)
8. EmployeeBranchAssignments (primary branch đã set trong Employee, assignment chỉ cho secondary nếu có — skip cho MVP seed)
9. WorkSchedule (1)
10. WorkScheduleAssignments (30)
11. AttendanceSessions (7 × 30 = 210, nhưng trừ absent ≈ 200)
12. AttendanceEvents (≈ 400)

## Decisions cần confirm

| # | Câu hỏi | Option A (recommend) | Option B |
|---|---|---|---|
| 1 | **Prisma major** | `6.19.3` (latest 6.x, LTS-ish, stable ecosystem) | `7.7.0` (latest, mới ra, breaking chưa well-doc'd) |
| 2 | **bcrypt vs bcryptjs** | `bcrypt` native (nhanh hơn, cần build tools — đã test node 22 OK) | `bcryptjs` (pure JS, không cần compile, chậm hơn ~3x) |
| 3 | **`prisma/` ở đâu** | **Repo root** (CLAUDE.md §3 đã chỉ rõ) | `apps/api/prisma/` (NX-style, nhưng lệch CLAUDE) |
| 4 | **Seed runner** | `ts-node` với `--compiler-options module=commonjs` (standard Prisma docs) | `tsx prisma/seed.ts` (modern, nhanh; nhưng thêm 1 dep) |
| 5 | **Prisma generate timing** | Manual `pnpm prisma:generate` sau pull | postinstall hook (auto but gây nhầm lẫn khi fresh install chưa có DATABASE_URL) |
| 6 | **Admin account có `Employee` record không?** | **Không** — admin là global user, không thuộc branch/department | Có — admin coi như employee của HQ |
| 7 | **Secondary `EmployeeBranchAssignment`** | **Skip** trong seed MVP (chỉ primary qua `Employee.primaryBranchId`) | Tạo 2–3 record secondary cho realism |
| 8 | **Attendance events mix ratio** | 70/15/10/5 (on_time/late/early_leave/absent) + 5% risk_flags trong events | Khác ratio (bạn đề xuất) |
| 9 | **Seed log level** | `console.log` summary cuối (count per table) | Verbose từng record |
| 10 | **Migration folder commit** | **Commit** `prisma/migrations/` (standard — team cần shared history) | Ignore (chỉ schema source of truth, mỗi dev tự migrate) |

## Schema copy — verify rules

Mình sẽ dùng Write tool tạo `prisma/schema.prisma` bằng cách **copy y nguyên** block code Prisma trong `docs/erd.md` lines 57–453. **Không** thêm/sửa:
- Không đổi field name/type
- Không thêm `@default`, `@map`, index mà ERD không có
- Không bỏ `@db.Uuid`, `@db.Decimal(10,7)` annotations

Sau khi tạo, sẽ chạy `pnpm prisma format` + `pnpm prisma validate` — nếu fail → STOP báo, không tự sửa.

## Risk

| Risk | Mitigation |
|---|---|
| ERD §3 có typo hoặc syntax error | `prisma validate` sẽ bắt. Nếu fail → STOP, báo nguyên văn + suggest fix cho user review, không tự apply. |
| Postgres enum conflict với Prisma native enum mapping | Prisma tạo type `@db.enum` mặc định OK. Nếu migrate fail do name collision → report. |
| `Decimal(10,7)` cho lat/long → Prisma client trả `Decimal` object (không phải number) | Documented caveat. Seed script phải truyền `new Prisma.Decimal(10.7766)` cho lat/long. |
| `Json` field (`workdays`, `riskFlags`, `deviceMeta`) → cần cast đúng khi seed | Dùng object literal trong TS, Prisma auto-serialize. |
| Seed script dùng `@prisma/client` nhưng client chưa generate lần đầu | Chain: `prisma generate` → `prisma migrate dev` → `prisma db seed`. |
| Shadow DB: Postgres `sa_app` đã superuser (T-002 verified) | ✅ no action needed |
| `bcrypt` native binding fail trên macOS Sequoia / Apple Silicon | Phổ biến, đã test nhiều; nếu fail → fallback `bcryptjs` (decision B). |

## Execution order (sau confirm)

1. Install deps: `pnpm add` + `pnpm add -D` (4 packages tổng)
2. Tạo `prisma/schema.prisma` (copy ERD §3 verbatim)
3. `pnpm prisma format` + `prisma validate` → verify
4. Update root `package.json`: thêm 4 scripts + `"prisma": { "seed": "..." }` block
5. Tạo `apps/api/src/prisma/prisma.service.ts`, `prisma.module.ts`, `index.ts`
6. Update `apps/api/src/app/app.module.ts`: import `PrismaModule`
7. Tạo `prisma/seed.ts` (idempotent, transaction, bcrypt hash)
8. Verify: `docker compose ps` postgres healthy, `.env` có `DATABASE_URL` → **CHỜ user confirm đã có .env** trước khi chạy migrate
9. `pnpm prisma:generate`
10. `pnpm prisma migrate dev --name init`
11. `pnpm prisma db seed`
12. Chạy lại step 11 để verify idempotent
13. `git status` cho user review
14. **Không commit** — user commit thủ công

## Acceptance mapping

- [ ] `pnpm prisma migrate dev` không lỗi → step 10
- [ ] `pnpm prisma studio` thấy đủ bảng → verify bằng `\dt` trong psql nếu user không muốn mở studio
- [ ] `pnpm prisma db seed` idempotent → step 11 + 12
- [ ] 3 tài khoản test login được → seed tạo bcrypt hash, verify qua psql: `SELECT email, length(password_hash) FROM users WHERE email LIKE '%@demo.com'` (length ≈ 60 cho bcrypt)
- [ ] 210+ `attendance_sessions` → `SELECT count(*) FROM attendance_sessions` ≥ 200 (trừ ~5% absent)

## Review checklist mapping

- [ ] Schema khớp 100% ERD — step 2 + 3 (verify bằng `diff`)
- [ ] Index đầy đủ theo ERD §4 — copy nguyên văn từ ERD §3 (đã bao gồm `@@index`)
- [ ] Seed dùng `upsert` — quy tắc trong spec seed
- [ ] Password hash bcrypt rounds ≥ 10 — hardcode `10` trong seed
- [ ] Không có data thật — tất cả synthetic (tên giả, email `@demo.com`)
