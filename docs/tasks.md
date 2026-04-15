# SMART ATTENDANCE — TASK BACKLOG cho AI Agent

> Mỗi task được thiết kế **self-contained**: gửi cho AI agent (Claude Code / Cursor) là làm được. Có **prompt mẫu** + **acceptance criteria** + **review checklist** để bạn (human) đánh giá nhanh.

---

## Cách dùng file này

### Workflow đề xuất

1. Bạn chọn task theo thứ tự (hoặc theo priority)
2. Copy **prompt template** trong task → gửi cho AI agent
3. AI làm xong → bạn chạy **review checklist**
4. Nếu pass → ghi vào `PROMPT_LOG.md` + commit
5. Nếu fail → feedback cho AI sửa, ghi vấn đề vào log

### Quy ước

- **🔴 Critical** — phải pass mới đi tiếp
- **🟡 Important** — pass để ăn điểm
- **🟢 Nice-to-have** — bonus
- **⏱️ Estimate** — thời gian dự kiến cho AI + bạn review
- **🔗 Depends on** — task phải xong trước

### Trước MỌI task — AI phải đọc:

```
Đọc TRƯỚC: CLAUDE.md, docs/spec.md, docs/erd.md, docs/api-spec.md
Tuân thủ: conventions trong CLAUDE.md §4, §5, §8
KHÔNG: thêm dependency mới, sửa schema, đổi API contract mà không hỏi
```

---

# 📅 NGÀY 1 — Foundation

## T-001 — Khởi tạo Nx workspace 🔴

- **⏱️** 30' AI + 10' review
- **🔗** không
- **Mục tiêu:** Tạo Nx monorepo với 3 apps + structure libs theo `CLAUDE.md §3`

### Prompt cho AI

```
Khởi tạo Nx workspace cho dự án Smart Attendance theo cấu trúc trong CLAUDE.md §3.

Yêu cầu:
1. Init Nx workspace với pnpm, preset "ts" (integrated monorepo)
2. Tạo 3 app:
   - apps/api (NestJS, port 3000)
   - apps/portal (Ionic Angular, port 4200)
   - apps/mobile (Ionic Angular + Capacitor, port 8100)
3. Tạo libs structure:
   - libs/shared/types
   - libs/shared/constants
   - libs/shared/utils
4. Cấu hình tsconfig paths để import qua @smart-attendance/*
5. Setup ESLint + Prettier theo CLAUDE.md §4.1
6. Tạo .gitignore phù hợp Nx + Node + IDE
7. KHÔNG cài thêm dependency ngoài cần thiết

Output: list lệnh đã chạy + cấu trúc thư mục cuối cùng.
```

### Acceptance criteria

- [ ] `pnpm install` chạy không lỗi
- [ ] `pnpm nx serve api` start được (dù chưa có endpoint thật)
- [ ] `pnpm nx serve portal` mở được trang trắng
- [ ] `pnpm nx graph` hiển thị đúng 3 app + 3 lib
- [ ] Import từ `@smart-attendance/shared/types` hoạt động

### Review checklist (cho bạn)

- [ ] `package.json` không có dependency lạ (kiểm `dependencies` + `devDependencies`)
- [ ] tsconfig.base.json có `strict: true`
- [ ] Không có file generated rác trong `apps/*/src`
- [ ] `.eslintrc.json` extend đúng `@nx/typescript`

### Deliverables

- Workspace boot được
- Commit: `chore: init nx workspace with api, portal, mobile apps`

---

## T-002 — Docker Compose skeleton 🔴

- **⏱️** 20' AI + 10' review
- **🔗** T-001
- **Mục tiêu:** `docker-compose up` chạy được postgres + redis cho dev

### Prompt cho AI

```
Tạo docker-compose.yml cho dev environment dự án Smart Attendance.

Services cần:
1. postgres:16-alpine
   - volume persistent
   - port 5432
   - DB: smart_attendance, user: postgres, pass: từ .env
   - healthcheck
2. redis:7-alpine
   - port 6379
   - healthcheck

Tạo .env.example với:
- DATABASE_URL
- REDIS_URL
- JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
- JWT_ACCESS_TTL, JWT_REFRESH_TTL
- PORT cho api (3000), portal (4200)

KHÔNG commit .env thật. KHÔNG hardcode secret trong docker-compose.

Output: docker-compose.yml + .env.example.
```

### Acceptance criteria

- [ ] `docker-compose up -d postgres redis` chạy
- [ ] `docker-compose ps` → cả 2 healthy
- [ ] `psql $DATABASE_URL -c '\l'` kết nối được
- [ ] `redis-cli -u $REDIS_URL ping` → PONG

### Review checklist

- [ ] `.env.example` đầy đủ, không thiếu var nào
- [ ] `.env` được add vào `.gitignore`
- [ ] Volume mount đúng (data persist sau restart)
- [ ] Không expose port không cần thiết ra ngoài

---

## T-003 — Prisma schema + migration đầu 🔴

- **⏱️** 45' AI + 20' review
- **🔗** T-002
- **Mục tiêu:** Implement schema từ `docs/erd.md` + migration đầu + seed data

### Prompt cho AI

```
Cài đặt Prisma cho apps/api theo docs/erd.md §3.

Steps:
1. Install prisma + @prisma/client trong workspace
2. Tạo prisma/schema.prisma copy NGUYÊN VĂN từ docs/erd.md §3
3. Tạo PrismaService trong apps/api/src/prisma/prisma.service.ts
   (extends PrismaClient, có onModuleInit/onModuleDestroy)
4. Tạo PrismaModule (global) export PrismaService
5. Chạy: pnpm prisma migrate dev --name init
6. Tạo prisma/seed.ts theo docs/spec.md §12:
   - 3 branches: HCM-Q1, HN-HoanKiem, DN-HaiChau
   - 3 departments mỗi branch
   - 30 employees (10 mỗi branch)
   - 1 work_schedule mặc định 08:00-17:00
   - 3 tài khoản test (admin/manager/employee) với password đã hash bcrypt
   - 7 ngày attendance data với mix status
7. Cấu hình "prisma": { "seed": "ts-node prisma/seed.ts" } trong package.json
8. Test: pnpm prisma db seed

KHÔNG đổi schema khác với docs/erd.md. Nếu phát hiện lỗi → báo trước, đừng tự sửa.
```

### Acceptance criteria

- [ ] `pnpm prisma migrate dev` không lỗi
- [ ] `pnpm prisma studio` mở thấy đủ bảng
- [ ] `pnpm prisma db seed` chạy idempotent (chạy lại không lỗi)
- [ ] 3 tài khoản test login được (verify password hash)
- [ ] Có ít nhất 7 ngày × 30 nhân viên = 210 attendance_sessions

### Review checklist

- [ ] Schema khớp 100% với `docs/erd.md` (so từng model)
- [ ] Index đầy đủ theo `docs/erd.md §4`
- [ ] Seed dùng `upsert`, không `create` (đảm bảo idempotent)
- [ ] Password hash bcrypt rounds ≥ 10
- [ ] Không có data thật/sensitive trong seed

---

## T-004 — Git Flow + commit conventions 🟡

- **⏱️** 15' AI + 5' review
- **🔗** T-001
- **Mục tiêu:** Setup branch + commit lint + PR template

### Prompt cho AI

```
Setup Git Flow cho repo:

1. Init git nếu chưa, tạo branch:
   - main (default)
   - develop (làm việc chính)
2. Cài commitlint + husky:
   - commitlint.config.js dùng @commitlint/config-conventional
   - husky hook: commit-msg validate, pre-commit lint-staged
   - lint-staged chạy eslint + prettier trên file staged
3. Tạo .github/PULL_REQUEST_TEMPLATE.md theo format:
   - Summary
   - Changes
   - Test plan (checklist)
   - Screenshot (nếu UI)
   - Linked spec section
4. Tạo .github/workflows/ci.yml:
   - on PR to develop/main
   - jobs: lint, test, build
   - matrix node 20

KHÔNG push lên remote, KHÔNG tạo PR thật.
```

### Acceptance criteria

- [ ] `git commit -m "test"` → bị reject (không đúng convention)
- [ ] `git commit -m "feat(infra): hello"` → pass
- [ ] PR template hiện khi tạo PR (kiểm bằng `gh pr create --web` dry-run)
- [ ] CI workflow YAML valid (kiểm bằng `gh workflow view` hoặc lint online)

---

# 📅 NGÀY 2 — Backend xương sống

## T-005 — Auth module (login + JWT + refresh) 🔴

- **⏱️** 60' AI + 20' review
- **🔗** T-003
- **Mục tiêu:** Implement auth theo `docs/api-spec.md §2`

### Prompt cho AI

```
Implement Auth module cho apps/api theo docs/api-spec.md §2.

Yêu cầu:
1. libs/api/auth: AuthModule, AuthController, AuthService
2. Endpoints:
   - POST /api/v1/auth/login
   - POST /api/v1/auth/refresh
   - POST /api/v1/auth/logout
   - GET  /api/v1/auth/me
3. JWT access (15') + refresh (7d), secret từ env
4. Bcrypt verify password
5. JwtStrategy + JwtAuthGuard (passport-jwt)
6. RolesGuard + @Roles() decorator
7. @CurrentUser() decorator
8. Refresh token lưu DB (bảng mới hoặc cache Redis — chọn 1, justify trong code comment 1 dòng)
9. Rate limit /login 5/phút/IP (dùng @nestjs/throttler)
10. DTO + class-validator
11. Response format theo docs/api-spec.md §1.1
12. Unit test cho AuthService (login success, wrong password, locked, refresh valid/invalid)

KHÔNG implement signup/forgot password (out of scope MVP).
```

### Acceptance criteria

- [ ] Login với 3 tài khoản test → trả access + refresh + user info
- [ ] Sai password → 401 `INVALID_CREDENTIALS`
- [ ] 6 lần login sai/phút → 429
- [ ] Access token decode đúng `{ sub, email, roles }`
- [ ] Refresh hoạt động, refresh cũ bị revoke
- [ ] `GET /me` với expired token → 401
- [ ] Unit test pass

### Review checklist

- [ ] Password **không** được trả về response (kiểm DTO mapping)
- [ ] Secret đọc từ `ConfigService`, không hardcode
- [ ] `JwtAuthGuard` áp dụng global hoặc explicit từng controller
- [ ] Error code khớp `docs/api-spec.md §10`

---

## T-006 — Branches CRUD + WiFi/Geofence config 🔴

- **⏱️** 60' AI + 20' review
- **🔗** T-005
- **Mục tiêu:** Implement branch management theo `docs/api-spec.md §3`

### Prompt cho AI

```
Implement Branches module theo docs/api-spec.md §3.

Yêu cầu:
1. libs/api/branches: BranchesModule + Controller + Service
2. Endpoints (xem api-spec.md §3 để chính xác):
   - GET    /branches (pagination, filter, manager scope)
   - POST   /branches (admin only)
   - GET    /branches/:id
   - PATCH  /branches/:id
   - DELETE /branches/:id (soft delete)
   - GET    /branches/:id/wifi-configs
   - POST   /branches/:id/wifi-configs
   - DELETE /branches/:id/wifi-configs/:configId
   - GET    /branches/:id/geofences
   - POST   /branches/:id/geofences
3. Manager chỉ thấy branch mình được gán
4. Pagination chuẩn (page/limit/sort), max limit 100
5. DTO + validation đầy đủ
6. Audit log mọi thao tác create/update/delete
7. Unit test cho service (list with manager scope, soft delete, pagination)

KHÔNG bypass guard. KHÔNG dùng raw SQL.
```

### Acceptance criteria

- [ ] Admin GET /branches → tất cả
- [ ] Manager GET /branches → chỉ branch được gán
- [ ] Employee GET /branches → 403
- [ ] Pagination meta đúng format
- [ ] DELETE branch còn employee active → 409
- [ ] Audit log có entry sau mỗi thao tác

### Review checklist

- [ ] Mọi list query có `take` (không findMany không limit)
- [ ] Filter `branch_id` áp dụng đúng scope
- [ ] WiFi BSSID validate format (regex MAC address)
- [ ] Geofence radius_meters > 0

---

## T-007 — Employees module + assignments 🔴

- **⏱️** 50' AI + 15' review
- **🔗** T-006
- **Mục tiêu:** CRUD nhân viên + assignment chi nhánh theo `docs/api-spec.md §4`

### Prompt cho AI

```
Implement Employees module theo docs/api-spec.md §4.

Endpoints:
- GET   /employees (filter branch/department/status, pagination)
- POST  /employees (atomic: tạo user + employee + assign role)
- PATCH /employees/:id
- POST  /employees/:id/assignments (gán branch secondary)
- GET   /employees/:id/devices
- PATCH /employees/:id/devices/:deviceId (toggle is_trusted)

Yêu cầu:
1. Tạo employee = transaction (user + employee atomic)
2. Manager scope: chỉ thấy employee thuộc branch mình
3. Soft set employment_status=terminated thay vì delete
4. Validate primary_branch_id và department_id tồn tại
5. Audit log
6. Unit test golden path

KHÔNG cho phép admin/manager xem password hash của employee.
```

### Acceptance criteria

- [ ] Admin create employee → user + employee + role tạo cùng lúc
- [ ] Rollback nếu 1 step fail (test bằng cách throw giữa transaction)
- [ ] Manager không thấy được employee của branch khác
- [ ] PATCH device is_trusted → reflect ngay lần check-in tiếp

---

## T-008 — Trust Score utility (pure function) 🔴

- **⏱️** 30' AI + 15' review
- **🔗** T-003
- **Mục tiêu:** Implement core algorithm Trust Score theo `docs/spec.md §5.2`

### Prompt cho AI

```
Implement trust score calculator trong libs/shared/utils/trust-score.ts.

Đây là PURE FUNCTION, không phụ thuộc Nest/Prisma.

Input type:
{
  gps: { lat, lng, accuracyMeters, isMockLocation } | null
  wifi: { ssid, bssid } | null
  branch: {
    geofences: Array<{ centerLat, centerLng, radiusMeters, isActive }>
    wifiConfigs: Array<{ ssid, bssid, isActive }>
  }
  device: { isTrusted: boolean, isFirstTime: boolean }
  history: { lastEventLat?, lastEventLng?, lastEventAt?, ipChanged: boolean } | null
  ipMeta: { isVpnSuspected: boolean }
}

Output:
{
  score: number  // 0-100
  level: 'trusted' | 'review' | 'suspicious'
  validationMethod: 'gps' | 'wifi' | 'gps_wifi' | 'none'
  flags: string[]  // ['outside_geofence', 'wifi_mismatch', 'mock_location', ...]
  isHardValid: boolean  // false → reject
}

Logic CHÍNH XÁC theo docs/spec.md §5.1, §5.2, §6.

Yêu cầu:
1. Hàm con haversineDistance(lat1,lng1,lat2,lng2) → meters
2. Hàm con isInsideGeofence(lat, lng, geofences) → boolean
3. Hàm con isWifiMatched(ssid, bssid, configs) → 'bssid_match' | 'ssid_only' | 'no_match'
4. Hàm con detectImpossibleTravel(...) → boolean
5. Trust score = sum weights, clamp 0-100
6. Level: ≥70 trusted, ≥40 review, <40 suspicious
7. Unit test KỸ:
   - GPS in geofence + accuracy 10m → +40
   - GPS in geofence + accuracy 50m → +25
   - BSSID match → +35
   - SSID match BSSID không → +15
   - Mock location → -50
   - Cả GPS lẫn WiFi fail → isHardValid=false, score=0
   - Travel speed 200km/h giữa 2 event → flag impossible_travel
   - Tổng score luôn 0-100

Test coverage 100% cho file này.
```

### Acceptance criteria

- [ ] Pure function (no side effects, deterministic)
- [ ] 100% test coverage cho `trust-score.ts`
- [ ] Test case bao gồm: edge cases, boundary, all flags
- [ ] Khớp đúng từng dòng weight trong `docs/spec.md §5.2`

### Review checklist

- [ ] Không import Nest/Prisma
- [ ] Không có magic number — extract thành const ở đầu file
- [ ] Haversine dùng radius Earth = 6371000m
- [ ] Score clamp `Math.max(0, Math.min(100, raw))`

---

## T-009 — Attendance check-in/out core 🔴

- **⏱️** 90' AI + 30' review
- **🔗** T-007, T-008
- **Mục tiêu:** Implement check-in/out theo `docs/spec.md §4.1, §4.2` + `api-spec.md §5`

### Prompt cho AI

```
Implement Attendance module theo docs/spec.md §4 và docs/api-spec.md §5.

Endpoints:
- POST /attendance/check-in
- POST /attendance/check-out
- GET  /attendance/me
- GET  /attendance/sessions (manager/admin scope)
- GET  /attendance/sessions/:id (kèm events)
- PATCH /attendance/sessions/:id (override + audit)

Logic check-in (chính xác theo spec §4.1):
1. Auth + lấy employee + primary_branch + active assignments
2. Lấy work_schedule active của employee (default nếu không có)
3. Load branch config (geofences + wifi_configs) — CACHE Redis 5'
4. Resolve device (upsert employee_devices theo fingerprint)
5. Gọi trustScore() từ libs/shared/utils
6. Nếu isHardValid=false:
   - Vẫn tạo attendance_event status=failed, validation_method=none
   - Trả 422 INVALID_LOCATION với event_id + flags + distance
7. Nếu valid:
   - Upsert attendance_session (unique employee_id+work_date)
   - Nếu đã có check_in_at success → 409 ALREADY_CHECKED_IN
   - Tạo attendance_event status=success
   - Set status: on_time nếu ≤ start_time + grace, else late
8. Update device.last_seen_at

Check-out:
- Phải có session với check_in_at
- Tính worked_minutes = (check_out - check_in) / 60
- overtime_minutes nếu vượt overtime_after_minutes
- early_leave nếu trước end_time
- Lấy MIN(trust_score check-in, check-out) làm session.trust_score

Rate limit: /check-in, /check-out 10/phút/employee (Redis-backed throttler).

Test:
- Check-in valid → 201, status on_time
- Check-in late → status late
- Check-in fail validation → 422, event vẫn log
- Double check-in → 409
- Check-out without check-in → 409
- Manager xem session branch khác → 403

KHÔNG mock trust-score trong service test — dùng thật.
```

### Acceptance criteria

- [ ] Check-in valid trả 201 với trust_score, validation_method
- [ ] Check-in fail vẫn tạo `attendance_events` row failed
- [ ] Trust score lưu đúng trong event và session
- [ ] Cache branch config hit lần 2 (verify bằng log)
- [ ] Rate limit 10/phút hoạt động

### Review checklist

- [ ] Transaction wrap session + event creation
- [ ] Không trust `is_mock_location` từ client làm hard reject (chỉ làm flag)
- [ ] Cache invalidate khi admin update branch config
- [ ] PATCH session có audit log với before/after JSON

---

# 📅 NGÀY 3 — Frontend (Portal + Mobile)

## T-010 — Portal login + auth flow 🔴

- **⏱️** 45' AI + 15' review
- **🔗** T-005
- **Mục tiêu:** Ionic portal login + token management

### Prompt cho AI

```
Implement login flow cho apps/portal (Ionic Angular standalone).

Yêu cầu:
1. AuthService trong apps/portal/src/app/core/auth/
   - login(email, password): Observable<User>
   - logout()
   - refresh(): Observable<void>
   - currentUser$: signal/observable
2. HttpInterceptor:
   - Inject Authorization header
   - On 401 → call refresh, retry original request 1 lần
   - Refresh fail → redirect /login, clear token
3. Token storage: localStorage (web)
4. Pages:
   - /login (form email + password, validate, error display)
   - /dashboard (placeholder, route guard requires auth)
5. AuthGuard route guard
6. ApiService wrapper qua HttpClient với base URL từ environment
7. Loading state + error toast khi login fail

Không tạo signup. Không dùng NgRx (signal đủ).
```

### Acceptance criteria

- [ ] Login với admin@demo.com → vào /dashboard
- [ ] Refresh page giữ session
- [ ] Token expire → auto refresh + retry
- [ ] Logout clear localStorage + redirect /login
- [ ] Sai password → toast error tiếng Việt rõ ràng

---

## T-011 — Portal: Branches & Employees CRUD UI 🟡

- **⏱️** 90' AI + 30' review
- **🔗** T-006, T-007, T-010
- **Mục tiêu:** Trang admin quản lý branch + employee

### Prompt cho AI

```
Implement 2 trang admin trong apps/portal:
1. /branches — list + create + edit + delete + WiFi/Geofence config
2. /employees — list + filter + create + edit + assign branch

Yêu cầu UI:
- Ionic components: ion-list, ion-modal, ion-input, ion-button
- Pagination (ion-infinite-scroll hoặc nút Next/Prev)
- Filter dropdown (branch, department, status)
- Form modal cho create/edit (reactive forms + validation)
- Toast feedback (success/error)
- Loading skeleton khi fetch
- Confirm modal trước delete

Code quality:
- Standalone components
- Tách smart/dumb component
- Không inline template > 50 dòng (tách file)
- Service per page (BranchesPageService, EmployeesPageService)

Manager role: ẩn nút Create branch, chỉ thấy branch của mình.
```

### Acceptance criteria

- [ ] CRUD branch hoạt động end-to-end
- [ ] Filter + pagination smooth
- [ ] WiFi config: thêm/xóa BSSID dạng tag chip
- [ ] Geofence: nhập tọa độ + radius (chưa cần map)
- [ ] Employee assign branch hoạt động

---

## T-012 — Mobile: Check-in/out screen 🔴

- **⏱️** 90' AI + 30' review
- **🔗** T-009
- **Mục tiêu:** App mobile cho nhân viên check-in

### Prompt cho AI

```
Implement check-in/out screen cho apps/mobile (Ionic + Capacitor).

Yêu cầu:
1. Login screen (reuse pattern T-010)
2. Home screen:
   - Hiển thị: tên nhân viên, chi nhánh, ca làm hôm nay
   - Trạng thái hôm nay: chưa check-in / đã check-in HH:mm / đã check-out HH:mm
   - Nút "Check in" hoặc "Check out" (lớn, dễ bấm)
3. Khi bấm check-in:
   - Plugin @capacitor/geolocation lấy GPS (request permission)
   - Plugin Wi-Fi (chọn 1: @capacitor-community/wifi hoặc native plugin tự viết — RESEARCH TRƯỚC, đề xuất plan B nếu plugin không lấy được BSSID)
   - Capacitor Device cho fingerprint + platform
   - POST /attendance/check-in
4. Hiển thị kết quả:
   - Success: "Check-in thành công lúc HH:mm" + trust score badge (xanh/vàng/đỏ)
   - Fail: lý do rõ ràng (ngoài geofence / WiFi sai), gợi ý kiểm tra
5. Lịch sử cá nhân tab: list 30 ngày gần nhất
6. Pull-to-refresh

Quan trọng:
- Permission flow rõ ràng (Vietnamese explanation)
- Loading state khi đang gọi API
- Offline detection: nếu mất mạng → báo "Sẽ thử lại khi có mạng" (chưa cần queue thật)
- Không crash nếu permission denied

NẾU plugin Wi-Fi không lấy được BSSID iOS → fallback chỉ gửi GPS, comment lý do trong code.
```

### Acceptance criteria

- [ ] Build được iOS/Android (chỉ cần `npx cap sync` không lỗi, không cần build native)
- [ ] Run trên trình duyệt với mock GPS được
- [ ] Check-in success → backend tạo session
- [ ] Trust score hiển thị đúng màu
- [ ] Permission denied → UI rõ ràng, không crash

### Review checklist

- [ ] Plugin version cố định (không `^`)
- [ ] Permission strings có trong `Info.plist` (iOS) + `AndroidManifest.xml`
- [ ] Không gửi dữ liệu nhạy cảm trong query string
- [ ] Trust score badge có aria-label cho a11y

---

## T-013 — Lịch sử cá nhân (employee + manager view) 🟡

- **⏱️** 45' AI + 15' review
- **🔗** T-012
- **Mục tiêu:** Trang xem lịch sử attendance

### Prompt cho AI

```
Implement view lịch sử attendance:

Mobile (apps/mobile):
- Tab "Lịch sử": list session 30 ngày gần nhất
- Tap session → modal chi tiết: check-in/out time, worked, status, trust score, events list
- Filter theo tháng

Portal (apps/portal):
- /attendance/sessions (manager + admin)
- Filter: branch (admin), employee, date range, status
- Pagination
- Tap row → drawer/page detail
- Manager có nút "Override status" (gọi PATCH với note + lý do)

Reuse component nếu được.
```

### Acceptance criteria

- [ ] Mobile list mượt (200 row vẫn smooth)
- [ ] Filter portal hoạt động đúng
- [ ] Override session → audit log có entry

---

# 📅 NGÀY 4 — Báo cáo, Anti-fraud, Polish

## T-014 — Cron jobs (daily summary, missing checkout) 🔴

- **⏱️** 45' AI + 15' review
- **🔗** T-009
- **Mục tiêu:** BullMQ scheduled jobs

### Prompt cho AI

```
Implement BullMQ scheduled jobs theo docs/spec.md §4.3, §4.4 và §8.4.

Jobs:
1. daily-summary (cron 00:30 mỗi ngày):
   - Duyệt tất cả employee active
   - Với ngày hôm trước:
     - Có session → tổng hợp vào daily_attendance_summaries
     - Không có session → tạo summary status=absent
   - Idempotent (upsert by employee_id + work_date)

2. missing-checkout-close (cron 23:59):
   - Tìm session ngày hôm nay có check_in_at, không có check_out_at
   - Set status=missing_checkout, worked_minutes=null

3. anomaly-detection (cron 01:00):
   - Tính cho 7 ngày gần nhất:
     - Branch có late_rate hôm nay > avg 7 ngày × 2
     - Employee có ≥3 session trust_score < 40 trong 7 ngày
     - Device chưa is_trusted xuất hiện hôm nay
   - Lưu vào table mới? Hoặc compute on-demand cho dashboard?
   → ĐỀ XUẤT: compute on-demand, cache Redis 1h. Justify trong code comment.

Setup:
- @nestjs/bullmq + ioredis
- BullModule.forRoot config Redis từ env
- 1 module riêng: libs/api/jobs
- 1 processor per queue
- Logger cho mỗi job (start/end/duration/affected)
- Manual trigger endpoint POST /admin/jobs/:name/run (admin only) cho dev test

KHÔNG dùng setInterval. KHÔNG chạy sync trong main thread.
```

### Acceptance criteria

- [ ] Manual trigger `daily-summary` → daily_attendance_summaries có row đúng
- [ ] Idempotent: chạy 2 lần không sinh duplicate
- [ ] Missing checkout: session đêm trước được close
- [ ] Anomaly query trả format đúng cho dashboard

---

## T-015 — Dashboard admin + manager + anomaly 🟡

- **⏱️** 90' AI + 30' review
- **🔗** T-014
- **Mục tiêu:** Implement dashboard endpoints + UI theo `docs/api-spec.md §7`

### Prompt cho AI

```
Backend (libs/api/dashboard):
- GET /dashboard/admin/overview
- GET /dashboard/manager/:branchId
- GET /dashboard/anomalies
Theo đúng response shape docs/api-spec.md §7.

Đọc từ daily_attendance_summaries (KHÔNG join attendance_sessions raw).
Cache Redis TTL 60s.

Frontend (apps/portal):
- /dashboard (admin)
  - Cards: total employees, branches, today checked-in, on-time rate
  - Bar chart: top 5 branch on-time + top 5 late
  - Heatmap: check-in count theo giờ (0-23)
- /dashboard/branch/:id (manager)
  - Cards: today total, checked-in, on-time, late, absent
  - List nhân viên trust score thấp hôm nay
  - Line chart: on-time rate 7 ngày
- /anomalies (admin + manager)
  - Bảng branches_late_spike
  - Bảng employees_low_trust
  - Counter untrusted_devices_new_today

Charts: dùng ECharts hoặc ng2-charts (cài 1 cái, justify trong commit message).
Responsive: card 1 cột mobile, 2-4 cột desktop.
```

### Acceptance criteria

- [ ] Admin dashboard load < 500ms (cache hit)
- [ ] Manager chỉ thấy dashboard branch của mình
- [ ] Heatmap render đúng spike 8h sáng
- [ ] Anomaly table có data từ seed 7 ngày

---

## T-016 — CSV export (BullMQ job) 🟡

- **⏱️** 45' AI + 15' review
- **🔗** T-014
- **Mục tiêu:** Async report export theo `docs/api-spec.md §6`

### Prompt cho AI

```
Implement CSV export theo docs/api-spec.md §6.

Endpoints:
- POST /reports/export → trả job_id ngay (202)
- GET /reports/export/:jobId → status + download_url khi xong
- GET /reports/export/:jobId/download → stream CSV

BullMQ queue "report-export":
- Job data: { type, branch_id, date_from, date_to, requested_by }
- Processor:
  - Query attendance_sessions trong range
  - Generate CSV (papaparse hoặc csv-stringify)
  - Lưu file: /tmp/reports/<jobId>.csv (MVP — không cần S3)
  - Update job result với file path + expires_at (1h)
- Cleanup job: xóa file > 1h

Rate limit: 3/phút/user.

UI portal: nút "Xuất CSV" trên trang reports → modal progress → download khi xong.
```

### Acceptance criteria

- [ ] Export 1000 row < 5s
- [ ] Job status poll mượt
- [ ] Download file đúng format CSV (Excel mở được, encoding UTF-8 BOM)
- [ ] File expire bị xóa

---

## T-017 — Anti-fraud polish + Risk flags display 🟡

- **⏱️** 30' AI + 10' review
- **🔗** T-009, T-013
- **Mục tiêu:** Hoàn thiện hiển thị risk flags trong manager view

### Prompt cho AI

```
Polish UX cho phần anti-fraud:

1. Mobile: khi check-in fail, hiển thị lý do thân thiện:
   - "outside_geofence" → "Bạn đang ở xa văn phòng (cách XYZ m)"
   - "wifi_mismatch" → "WiFi bạn đang kết nối không phải của công ty"
   - "mock_location" → "Vui lòng tắt ứng dụng giả lập vị trí"

2. Portal manager session detail:
   - Risk flags hiển thị badge màu (đỏ cho mock, vàng cho accuracy)
   - Tooltip giải thích từng flag
   - Map mini hiển thị vị trí check-in vs branch (Leaflet hoặc image static)

3. Dashboard anomaly: link click vào device/employee → trang chi tiết tương ứng

Tạo file libs/shared/constants/risk-flags.ts với map flag → { label_vi, severity }.
```

### Acceptance criteria

- [ ] Mọi flag có label tiếng Việt
- [ ] Map hiển thị đúng pin (kể cả khi không có Leaflet, dùng static)
- [ ] Tooltip a11y

---

# 📅 NGÀY 5 — Hoàn thiện & Demo

## T-018 — Dockerfile production cho api + portal 🔴

- **⏱️** 30' AI + 15' review
- **🔗** T-001 → T-017
- **Mục tiêu:** Multi-stage Dockerfile + full docker-compose

### Prompt cho AI

```
Tạo Dockerfile production cho apps/api và apps/portal.

Yêu cầu:
1. apps/api/Dockerfile:
   - Multi-stage: deps → build → runtime
   - Stage runtime: node:20-alpine, non-root user
   - Copy chỉ dist + node_modules production
   - HEALTHCHECK gọi /health
   - EXPOSE 3000
   - CMD node dist/main.js

2. apps/portal/Dockerfile:
   - Stage build: pnpm nx build portal --prod
   - Stage runtime: nginx:alpine
   - Copy dist vào /usr/share/nginx/html
   - nginx.conf: SPA fallback, gzip, cache headers
   - EXPOSE 80

3. apps/mobile: KHÔNG build (chỉ dev mode)

4. Update docker-compose.yml thêm services:
   - api (build từ apps/api/Dockerfile)
   - portal (build từ apps/portal/Dockerfile)
   - depends_on postgres + redis healthy
   - environment đầy đủ

5. Test: docker-compose up --build → tất cả service healthy

KHÔNG include source code trong runtime image.
KHÔNG chạy root.
```

### Acceptance criteria

- [ ] `docker-compose up --build` → tất cả healthy
- [ ] Image api < 300MB
- [ ] Image portal < 50MB
- [ ] Login → check-in flow hoạt động qua docker stack
- [ ] `docker exec ... whoami` → non-root

---

## T-019 — README polish + demo script 🔴

- **⏱️** 30' AI + 15' review
- **🔗** T-018
- **Mục tiêu:** Hoàn thiện README + tạo demo script

### Prompt cho AI

```
1. Review và update README.md:
   - Verify mọi link còn đúng
   - Update screenshots (placeholder ok nếu chưa chụp)
   - Add badge build status
   - Verify quick start steps chính xác (chạy lại từ đầu trên máy clean)

2. Tạo docs/demo-script.md:
   - Kịch bản demo 5-10 phút
   - Phần 1 (1'): giới thiệu sản phẩm + tech stack
   - Phần 2 (2'): admin tạo branch + cấu hình WiFi/GPS + tạo employee
   - Phần 3 (3'): mobile check-in (success + fail case) → trust score
   - Phần 4 (2'): manager dashboard + anomaly
   - Phần 5 (1'): highlight Trust Score + scale strategy
   - Phần 6 (1'): AI workflow walkthrough (PROMPT_LOG)
   - Bullet point cho người quay video

3. Tạo docs/architecture.md:
   - Sơ đồ Mermaid kiến trúc
   - Mô tả từng layer
   - Scale narrative chi tiết
   - Trade-off đã chọn (Ionic web vs Next.js, vv)
```

### Acceptance criteria

- [ ] Người mới clone repo → chạy được trong < 10'
- [ ] Demo script đủ chi tiết để 1 người chưa biết dự án quay được
- [ ] Architecture doc có sơ đồ Mermaid render được trên GitHub

---

## T-020 — Test coverage + bugfix sweep 🟡

- **⏱️** 60' AI + 30' review
- **🔗** T-001 → T-019
- **Mục tiêu:** Đảm bảo coverage + sửa bug phát hiện

### Prompt cho AI

```
1. Chạy pnpm nx run-many --target=test --all → fix mọi test fail
2. Coverage check: libs/api/* services >= 60%
3. Chạy lint toàn repo, fix warning
4. Chạy build production tất cả app
5. Manual smoke test golden path:
   - Admin login → tạo branch + employee
   - Employee mobile check-in valid
   - Employee check-out
   - Manager xem dashboard
   - Admin xem anomaly + export CSV
6. Liệt kê bug phát hiện thành issues:
   - Severity (P0/P1/P2)
   - Steps to reproduce
   - Expected vs actual

KHÔNG sửa bug P2 nếu hết thời gian — log lại trong KNOWN_ISSUES.md.
```

### Acceptance criteria

- [ ] All test pass
- [ ] Coverage report ≥ 60% cho api libs
- [ ] Build prod không lỗi
- [ ] Golden path chạy mượt

---

# 🎁 BONUS Tasks (nếu kịp)

## T-B01 — Notification system 🟢

- Toast in-app khi check-in fail repeatedly
- Mock email cho manager khi có anomaly mới

## T-B02 — Map visualization 🟢

- Leaflet map cho branch geofence
- Heatmap check-in locations

## T-B03 — Offline check-in queue 🟢

- IndexedDB queue khi mất mạng
- Auto sync khi có mạng + mark trạng thái pending verification

## T-B04 — Multi-language (vi/en) 🟢

- ngx-translate
- Mặc định tiếng Việt

---

# 📊 Bảng tổng hợp tasks

| ID    | Task              | Priority | Days | Est | Depends             |
| ----- | ----------------- | -------- | ---- | --- | ------------------- |
| T-001 | Nx workspace      | 🔴       | 1    | 30' | -                   |
| T-002 | Docker skeleton   | 🔴       | 1    | 20' | T-001               |
| T-003 | Prisma + seed     | 🔴       | 1    | 45' | T-002               |
| T-004 | Git Flow + CI     | 🟡       | 1    | 15' | T-001               |
| T-005 | Auth module       | 🔴       | 2    | 60' | T-003               |
| T-006 | Branches CRUD     | 🔴       | 2    | 60' | T-005               |
| T-007 | Employees CRUD    | 🔴       | 2    | 50' | T-006               |
| T-008 | Trust Score util  | 🔴       | 2    | 30' | T-003               |
| T-009 | Attendance core   | 🔴       | 2    | 90' | T-007, T-008        |
| T-010 | Portal login      | 🔴       | 3    | 45' | T-005               |
| T-011 | Portal CRUD UI    | 🟡       | 3    | 90' | T-006, T-007, T-010 |
| T-012 | Mobile check-in   | 🔴       | 3    | 90' | T-009               |
| T-013 | History views     | 🟡       | 3    | 45' | T-012               |
| T-014 | Cron jobs         | 🔴       | 4    | 45' | T-009               |
| T-015 | Dashboards        | 🟡       | 4    | 90' | T-014               |
| T-016 | CSV export        | 🟡       | 4    | 45' | T-014               |
| T-017 | Anti-fraud polish | 🟡       | 4    | 30' | T-009, T-013        |
| T-018 | Production Docker | 🔴       | 5    | 30' | T-001..T-017        |
| T-019 | README + demo     | 🔴       | 5    | 30' | T-018               |
| T-020 | Test sweep        | 🟡       | 5    | 60' | T-001..T-019        |

**Tổng:** 20 tasks chính + 4 bonus.
**Tổng thời gian AI:** ~17h
**Tổng thời gian review:** ~6h

---

# 🎯 Vai trò của bạn (giám sát)

### Trước mỗi task

- [ ] Đọc lại spec/api-spec mục liên quan
- [ ] Verify dependency tasks đã pass
- [ ] Chuẩn bị data test nếu cần

### Khi gửi prompt

- [ ] Copy nguyên prompt template
- [ ] Thêm context cụ thể nếu cần (vd: "ở môi trường macOS")
- [ ] Nói rõ scope: "chỉ làm task T-XXX, không refactor khác"

### Khi AI làm xong

- [ ] Chạy acceptance criteria → tick từng cái
- [ ] Chạy review checklist
- [ ] Nếu fail → feedback cụ thể: "checklist mục X fail vì Y, sửa lại"
- [ ] Nếu pass → ghi PROMPT_LOG entry → commit → tick task

### Khi AI đề xuất thay đổi spec

- [ ] **STOP** — không tự duyệt
- [ ] Đánh giá impact (có ảnh hưởng task khác không?)
- [ ] Update spec/api-spec/erd nếu accept
- [ ] Note quyết định vào PROMPT_LOG

### Cờ đỏ cần dừng ngay

- AI thêm dependency lạ
- AI sửa schema không qua migration
- AI tắt eslint/test
- AI thêm `// @ts-ignore`
- AI hardcode secret
- AI generate file ngoài structure

---

## Changelog

- **v0.1** (2026-04-15): Tạo backlog 20 + 4 tasks, mapping 5 ngày.
