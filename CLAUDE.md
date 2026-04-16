# CLAUDE.md — AI IDE Context File

> File này định hướng cho Claude Code / Cursor / Copilot khi sinh code cho dự án **Smart Attendance**. Đọc file này TRƯỚC khi viết bất kỳ feature nào.

---

## 1. Sản phẩm

**Smart Attendance** — hệ thống chấm công thông minh cho doanh nghiệp **100 chi nhánh, 5.000 nhân viên**. Check-in/out qua GPS geofencing + WiFi SSID/BSSID, chấm điểm độ tin cậy (Trust Score), phát hiện bất thường.

**Tài liệu nguồn (đọc trước khi code):**

- [`docs/spec.md`](docs/spec.md) — rule nghiệp vụ
- [`docs/erd.md`](docs/erd.md) — schema database
- [`docs/api-spec.md`](docs/api-spec.md) — API contract

---

## 2. Tech stack

| Lớp         | Công nghệ                            |
| ----------- | ------------------------------------ |
| Monorepo    | **Nx**                               |
| Backend     | **NestJS** + **Prisma**              |
| Database    | **PostgreSQL 16**                    |
| Cache/Queue | **Redis** + **BullMQ**               |
| Mobile      | **Ionic + Capacitor** (Angular)      |
| Web Portal  | **Ionic Angular**                    |
| Auth        | **JWT** access + refresh             |
| Test        | **Jest** (unit), **Supertest** (e2e) |
| Container   | **Docker Compose**                   |

**Không thay đổi stack** mà không hỏi.

---

## 3. Cấu trúc monorepo

```
smart-attendance/
├── apps/
│   ├── api/              # NestJS backend
│   ├── portal/           # Ionic web portal (admin/manager)
│   └── mobile/           # Ionic + Capacitor (employee app)
├── libs/
│   ├── shared/types/     # TypeScript types dùng chung (DTOs)
│   ├── shared/constants/ # Enum, error codes
│   ├── shared/utils/     # Pure functions (geo, trust score)
│   └── api/              # NestJS modules (auth, attendance, ...)
│       ├── auth/
│       ├── branches/
│       ├── employees/
│       ├── attendance/
│       ├── reports/
│       └── dashboard/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── docs/
├── docker/
├── docker-compose.yml
├── .env.example
├── CLAUDE.md
├── PROMPT_LOG.md
└── README.md
```

---

## 4. Coding conventions

### 4.1 General

- **TypeScript strict mode** bật toàn bộ
- **No `any`** trừ khi unavoidable (kèm comment giải thích)
- **ESLint + Prettier** auto-format khi save
- **Naming:** `camelCase` biến/hàm, `PascalCase` class/type, `SCREAMING_SNAKE` const
- **Files:** `kebab-case.ts` (vd: `attendance.service.ts`)
- **Imports:** absolute path qua tsconfig paths (`@smart-attendance/shared/types`)

### 4.2 NestJS

- 1 module / 1 thư mục, structure: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`, `entities/` (nếu cần)
- DTO dùng **class-validator** + **class-transformer**
- Tất cả endpoint có guard `@UseGuards(JwtAuthGuard, RolesGuard)`
- Custom decorator `@Roles('admin')`, `@CurrentUser()`
- Error: throw `HttpException` con (vd: `BadRequestException`) hoặc custom `BusinessException`
- Service không trả raw Prisma model — luôn map qua DTO/response shape
- Inject Prisma qua `PrismaService` (không gọi `new PrismaClient()`)

### 4.3 Prisma

- Tên model: `PascalCase` (Prisma) → `snake_case` table (`@@map`)
- Tên field: `camelCase` (Prisma) → `snake_case` column (`@map`)
- Relation: dùng explicit FK field + relation field
- Migration: 1 PR = 1 migration mới, **không sửa migration đã merge**
- Seed bằng `prisma/seed.ts`, idempotent (upsert)

### 4.4 API response

Tuân thủ format trong [`docs/api-spec.md`](docs/api-spec.md):

```typescript
// Success
{ data: T | T[], meta?: PaginationMeta }
// Error
{ error: { code: string, message: string, details?: any } }
```

Wrap qua interceptor `ResponseTransformInterceptor`.

### 4.5 Ionic (portal + mobile)

- Standalone components (Angular 17+)
- Lazy-load mọi route
- State management: **Signals** (đơn giản) hoặc **NgRx** (nếu phức tạp)
- Service gọi API qua `HttpClient` wrapper `ApiService`
- UI: Ionic components mặc định, không custom CSS framework

### 4.6 Testing

- Unit test cho mọi service (logic nghiệp vụ): trust score, validation, schedule
- E2E test cho golden path: login → check-in → check-out → xem lịch sử
- Test naming: `should <expected> when <condition>`
- Coverage tối thiểu 60% cho `libs/api/*` services

---

## 5. Nguyên tắc thiết kế

### 5.1 Multi-branch ngay từ đầu

- Mọi query attendance/employee/report **PHẢI** có filter `branch_id` (admin có thể skip)
- Manager guard kiểm tra `branch_id ∈ user.managed_branches`
- Không hard-code branch ở bất kỳ đâu

### 5.2 Pagination mặc định

- Mọi list endpoint trả `data + meta`, default `limit=20, max=100`
- Không bao giờ `findMany()` không limit (dù có filter)

### 5.3 Validation 2 lớp

- **Lớp 1 (DTO):** class-validator format, type, required
- **Lớp 2 (Service):** business rule (geofence, schedule, role scope)

### 5.4 Trust Score logic

File duy nhất: `libs/shared/utils/trust-score.ts`

- Pure function, dễ test
- Input: `{ gps, wifi, device, history }`
- Output: `{ score: 0-100, flags: string[], method: ValidationMethod }`

### 5.5 Anti-fraud

- **KHÔNG** trust input từ client mù quáng (đặc biệt `is_mock_location`)
- Luôn cross-check: GPS + WiFi + device + history
- Mọi failed attempt **vẫn log** vào `attendance_events`
- Manager override **bắt buộc** ghi `audit_logs`

### 5.6 Performance

- Index DB theo [`docs/erd.md`](docs/erd.md) §4
- Cache branch config (geofence, wifi) trong Redis TTL 5'
- Dashboard query đọc từ `daily_attendance_summaries` (read model), không join raw events
- Heavy operation (export) → BullMQ job, không block request

---

## 6. Git conventions

### 6.1 Branch

- `main` — production-ready
- `develop` — integration
- `feature/<scope>-<short-desc>` (vd: `feature/attendance-checkin-validation`)
- `release/<version>`, `hotfix/<issue>`

### 6.2 Commit (Conventional Commits)

```
<type>(<scope>): <subject>

[optional body]
[optional footer]
```

**Type:** `feat`, `fix`, `chore`, `refactor`, `test`, `docs`, `style`, `perf`, `ci`
**Ví dụ:**

- `feat(attendance): add GPS+WiFi validation for check-in`
- `fix(auth): handle expired refresh token`
- `chore(docker): add redis service to compose`

### 6.3 PR

- 1 feature = 1 PR
- Title = commit subject
- Body: gì thay đổi + why + screenshot (nếu UI)
- Self-review trước khi assign

---

## 7. AI workflow rule

### 7.1 Trước khi sinh code

1. Đọc `docs/spec.md` mục liên quan
2. Đọc `docs/api-spec.md` cho endpoint contract
3. Đọc `docs/erd.md` cho schema
4. Tham chiếu module tương tự đã có

### 7.2 Khi sinh code

- **KHÔNG** tạo file/folder ngoài structure đã định
- **KHÔNG** thêm dependency mới mà không hỏi
- **KHÔNG** dùng deprecated API
- **PHẢI** tuân naming convention
- **PHẢI** thêm DTO + validation
- **PHẢI** thêm guard cho endpoint cần auth
- **PHẢI** thêm test case cho logic nghiệp vụ

### 7.3 Sau khi sinh code

- Người dev **review 100%** code AI sinh ra
- Ghi vào `PROMPT_LOG.md`: prompt + AI output + chỉnh sửa + kết quả

---

## 8. Forbidden / Avoid

- ❌ `console.log` trong production code (dùng `Logger`)
- ❌ Hard-code secret, URL, credential
- ❌ Comment kiểu `// added by AI`, `// TODO later`
- ❌ Class-based component (Angular) — dùng standalone function-style
- ❌ `findMany()` không có `take`
- ❌ Đọc raw Prisma model trong controller — phải qua service + DTO
- ❌ Catch `Error` mà nuốt — luôn log + rethrow hoặc throw HttpException

### Exception — Raw SQL cho analytics

`$queryRaw` / `$executeRaw` CHỈ được dùng trong analytics processors
(`libs/api/jobs/*.processor.ts`) và dashboard service
(`libs/api/dashboard/dashboard.service.ts`) cho CTEs, `GROUP BY ... HAVING`,
`AT TIME ZONE`, `FILTER (WHERE ...)` và các query vượt khỏi Prisma fluent API.
Ràng buộc khi áp dụng exception này:

- **R1**: inputs luôn parameterized qua tagged template literals — không string concat
- **R2**: results cast sang typed row interfaces (không `any`)
- **R3**: file header comment giải thích lý do (xem `anomaly.processor.ts`, `dashboard.service.ts` precedent)
- **R4**: UUID columns cần explicit cast `${id}::uuid` khi bind từ JS string (T-015 lesson)

Exception KHÔNG mở cho controllers hoặc service CRUD thường — CRUD paths tiếp tục dùng Prisma typed queries.

---

## 9. Khi không chắc

**Hỏi user, không đoán.** Đặc biệt khi:

- Thay đổi schema database
- Thêm dependency mới
- Đổi API contract
- Thay đổi rule nghiệp vụ
- Refactor cross-module

---

## 10. Quick reference

| Cần               | File                                                     |
| ----------------- | -------------------------------------------------------- |
| Rule check-in     | `docs/spec.md` §4.1, §5                                  |
| Trust score logic | `docs/spec.md` §5.2 + `libs/shared/utils/trust-score.ts` |
| Schema bảng X     | `docs/erd.md` §3                                         |
| API endpoint Y    | `docs/api-spec.md`                                       |
| Error code        | `docs/api-spec.md` §10                                   |
| Rate limit        | `docs/api-spec.md` §11                                   |
| MVP scope         | `docs/spec.md` §11                                       |
| Test account      | `docs/spec.md` §12                                       |
