# Smart Attendance

> Hệ thống chấm công thông minh cho doanh nghiệp **100 chi nhánh, 5.000 nhân viên** — check-in/out qua GPS geofencing + WiFi, có Trust Score và Anomaly Detection.

[![CI](https://github.com/tinhthanh/smart-attendance/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/tinhthanh/smart-attendance/actions/workflows/ci.yml)
[![Stack](https://img.shields.io/badge/stack-Nx_+_NestJS_+_Ionic_+_Prisma-blue)]()
[![DB](https://img.shields.io/badge/db-PostgreSQL_16-336791)]()
[![Deploy](https://img.shields.io/badge/deploy-Docker_Compose-2496ED)]()

---

## 📋 Tài liệu

- 📄 **Đề bài:** [`ASSIGNMENT.md`](ASSIGNMENT.md)
- 📐 **Spec nghiệp vụ:** [`docs/spec.md`](docs/spec.md)
- 🗄️ **ERD & Schema:** [`docs/erd.md`](docs/erd.md)
- 🔌 **API Spec:** [`docs/api-spec.md`](docs/api-spec.md)
- 🤖 **AI Context:** [`CLAUDE.md`](CLAUDE.md)
- 📝 **Prompt Log:** [`PROMPT_LOG.md`](PROMPT_LOG.md)

---

## 🎯 Tính năng chính

### Cho nhân viên

- ✅ Check-in/out qua app mobile với xác thực **GPS hoặc WiFi**
- 📜 Xem lịch sử chấm công cá nhân theo ngày/tuần/tháng
- 📊 Theo dõi giờ làm, overtime, trạng thái

### Cho manager

- 👥 Quản lý nhân sự chi nhánh
- 📈 Dashboard chi nhánh theo thời gian thực
- ⚠️ Review các lần check-in trust score thấp
- ✏️ Override attendance (có audit log)

### Cho admin

- 🏢 CRUD 100 chi nhánh + cấu hình WiFi/GPS
- 👤 Quản lý 5.000 nhân viên
- 📊 Dashboard toàn hệ thống + heatmap
- 🚨 **Anomaly Dashboard** — phát hiện chi nhánh/nhân viên bất thường
- 📤 Xuất báo cáo CSV

### ⭐ Sáng tạo: Trust Score + Anomaly Detection

Mỗi lần check-in được chấm điểm **0–100** dựa trên:

- GPS validity + accuracy
- WiFi BSSID match
- Device trust history
- Mock location detection
- Travel speed anomaly
- VPN/IP heuristics

→ Manager có dashboard cảnh báo bất thường thay vì duyệt thủ công.

---

## 🏗️ Kiến trúc

```
┌─────────────────┐  ┌─────────────────┐
│  Mobile (Ionic) │  │ Portal (Ionic)  │
│   Employee app  │  │  Admin/Manager  │
└────────┬────────┘  └────────┬────────┘
         │                    │
         └─────────┬──────────┘
                   │ HTTPS
         ┌─────────▼─────────┐
         │  NestJS API       │
         │  ┌─────────────┐  │
         │  │ Auth/RBAC   │  │
         │  │ Attendance  │  │
         │  │ Trust Engine│  │
         │  │ Reports     │  │
         │  └─────────────┘  │
         └──┬────────┬───────┘
            │        │
   ┌────────▼──┐  ┌──▼─────┐
   │PostgreSQL │  │ Redis  │
   │  (Prisma) │  │+BullMQ │
   └───────────┘  └────────┘
```

Chi tiết kiến trúc, scale narrative, trade-offs và known limitations: [`docs/architecture.md`](docs/architecture.md).
Schema gốc: [`docs/erd.md`](docs/erd.md). Business rule: [`docs/spec.md` §2](docs/spec.md).

---

## 🛠️ Tech Stack

| Lớp         | Công nghệ                   |
| ----------- | --------------------------- |
| Monorepo    | **Nx**                      |
| Backend     | **NestJS** + **Prisma** ORM |
| Database    | **PostgreSQL 16**           |
| Cache/Queue | **Redis** + **BullMQ**      |
| Web Portal  | **Ionic Angular**           |
| Mobile      | **Ionic + Capacitor**       |
| Auth        | **JWT** (access + refresh)  |
| Container   | **Docker Compose**          |
| Test        | Jest + Supertest            |

---

## 🛡️ Anti-fraud strategy

### 1. Three-layer validation

Mỗi check-in/out đi qua **3 lớp kiểm tra độc lập** trước khi được chấp nhận:

1. **Hard validation** — gating rules; thất bại = reject ngay (HTTP 422), event vẫn ghi vào `attendance_events` để forensic.
   - Ngoài geofence của chi nhánh → reject
   - WiFi BSSID/SSID sai và GPS không pass → reject
   - Không có cả GPS lẫn WiFi → reject
2. **Risk flags** — soft signals; mỗi attempt sinh ra một tập flag (xem §2). Flag ảnh hưởng tới trust score và hiển thị cho manager review.
3. **Trust Score 0–100** — weighted sum của các flag (logic ở [`libs/shared/utils/src/lib/trust-score.ts`](libs/shared/utils/src/lib/trust-score.ts)). Map ra **trust level**:
   - `≥70 = trusted` (xanh) — auto approve
   - `40–69 = review` (vàng) — manager xem lại
   - `<40 = suspicious` (đỏ) — báo anomaly dashboard

### 2. 12 risk flags — severity + ý nghĩa

| Severity   | Flag                                | Ý nghĩa                                                    |
| ---------- | ----------------------------------- | ---------------------------------------------------------- |
| 🟢 success | `gps_in_geofence_high_accuracy`     | GPS trong vùng + sai số ≤50m                               |
| 🟢 success | `bssid_match`                       | WiFi BSSID khớp config chi nhánh                           |
| 🔵 info    | `device_trusted`                    | Thiết bị đã xác minh trước đây                             |
| 🔵 info    | `ssid_only_match`                   | SSID đúng nhưng BSSID sai (có thể spoof tên WiFi)          |
| 🟡 warning | `gps_in_geofence_moderate_accuracy` | GPS trong vùng nhưng sai số 50–200m                        |
| 🟡 warning | `accuracy_poor`                     | GPS sai số >200m                                           |
| 🟡 warning | `device_untrusted`                  | Thiết bị mới, chưa được duyệt                              |
| 🔴 danger  | `gps_outside_geofence`              | GPS nằm ngoài bán kính chi nhánh                           |
| 🔴 danger  | `wifi_mismatch`                     | WiFi không thuộc chi nhánh                                 |
| 🔴 danger  | `mock_location`                     | Phát hiện app giả lập GPS                                  |
| 🔴 danger  | `impossible_travel`                 | Khoảng cách 2 lần check-in vượt vận tốc tối đa (~120 km/h) |
| 🔴 danger  | `vpn_suspected`                     | IP rơi vào pattern VPN/proxy                               |

Single source of truth: [`libs/shared/constants/src/lib/risk-flags.ts`](libs/shared/constants/src/lib/risk-flags.ts) — bao gồm label tiếng Việt + description + icon, được dùng chung cho mobile, portal và backend.

### 3. Limitations & rationale

**Tại sao không "chống tuyệt đối"?**

- **Wi-Fi API trên iOS/Android giới hạn permission**: từ iOS 13+ và Android 10+, app chỉ đọc được BSSID khi user cấp `Location` permission đầy đủ; nhiều thiết bị fallback chỉ trả SSID. Mobile MVP hiện stub WiFi → trust score tối đa ~55 (review level).
- **GPS spoofing không thể phát hiện 100%** bằng client signal — `is_mock_location` từ Android có thể bypass bằng debugger.
- Mục tiêu thực tế: **nâng chi phí gian lận** + cung cấp **evidence** cho manager review chứ không khoá tuyệt đối. Mọi failed attempt vẫn ghi vào `attendance_events` (kèm risk_flags) để truy vết khi cần.

Chi tiết business rule: [`docs/spec.md` §6](docs/spec.md).

---

## 🚀 Quick start (Docker)

### Yêu cầu

- Docker Desktop ≥ 24
- Node.js ≥ 20 (cho dev local)
- pnpm ≥ 8

### 1. Clone & cấu hình

```bash
git clone <repo-url> smart-attendance
cd smart-attendance
cp .env.example .env
```

### 2. Khởi động bằng Docker

```bash
docker-compose up -d
```

Sẽ chạy: **api** (3000), **portal** (4200), **postgres** (5432), **redis** (6379).

### 3. Migrate + seed

```bash
docker-compose exec api pnpm prisma migrate deploy
docker-compose exec api pnpm prisma db seed
```

### 4. Truy cập

- **Portal (admin/manager):** http://localhost:4200
- **API docs (Swagger):** http://localhost:3000/api/docs
- **API health:** http://localhost:3000/api/v1/health

### 5. Tài khoản test (sau seed)

| Role     | Email                  | Password       |
| -------- | ---------------------- | -------------- |
| Admin    | `admin@demo.com`       | `Admin@123`    |
| Manager  | `manager.hcm@demo.com` | `Manager@123`  |
| Employee | `employee001@demo.com` | `Employee@123` |

---

## 💻 Dev local

```bash
pnpm install

# Start postgres + redis
docker-compose up -d postgres redis

# Migrate + seed
pnpm prisma migrate dev
pnpm prisma db seed

# Chạy song song
pnpm nx serve api          # http://localhost:3000
pnpm nx serve portal       # http://localhost:4200
pnpm nx serve mobile       # http://localhost:8100
```

### Lệnh hữu ích

```bash
pnpm nx test api                      # unit test
pnpm nx e2e api-e2e                   # e2e test
pnpm nx affected --target=test        # test các project bị ảnh hưởng
pnpm prisma studio                    # GUI database
```

---

## 📂 Cấu trúc repo

```
smart-attendance/
├── apps/
│   ├── api/              # NestJS backend
│   ├── portal/           # Ionic web portal
│   └── mobile/           # Ionic + Capacitor
├── libs/
│   ├── shared/types/     # DTOs, types dùng chung
│   ├── shared/utils/     # Trust score, geo helpers
│   └── api/              # NestJS modules theo domain
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── docs/
│   ├── spec.md
│   ├── erd.md
│   └── api-spec.md
├── docker/
├── docker-compose.yml
├── .env.example
├── ASSIGNMENT.md         # Đề bài
├── CLAUDE.md             # AI context
├── PROMPT_LOG.md         # Nhật ký AI
└── README.md
```

---

## 📈 Scale strategy (100 chi nhánh × 5.000 nhân viên)

### Peak load

- Giờ cao điểm 07:45–08:15: **~10 req/s peak** (5k nhân viên × 1.2 attempts)
- 1 Node instance đủ; thiết kế **stateless** để scale ngang khi cần.

### Database

- **Index** chuyên biệt theo query pattern (xem [`docs/erd.md` §4](docs/erd.md))
- **Partition** `attendance_events` theo tháng (kế hoạch sẵn, MVP chưa bật)
- **Read model** `daily_attendance_summaries` cho dashboard (cron tổng hợp 00:30)

### Cache

- Redis cache branch config (TTL 5'), dashboard aggregates (TTL 60s)
- Invalidate khi admin update

### Queue (BullMQ)

- `daily-summary` — tổng hợp ngày công 00:30
- `missing-checkout-close` — auto-close 23:59
- `report-export` — không block request
- `anomaly-detection` — chạy 01:00

### Rate limit (Redis-backed)

- `/check-in`: 10/phút/employee
- `/login`: 5/phút/IP

### Horizontal scale (sẵn sàng)

- API stateless → LB
- Postgres read replica cho dashboard
- Redis cluster
- S3-compatible storage cho export file

---

## 🤖 AI Workflow

Dự án dùng AI IDE (Claude Code) làm pair programmer.

**Quy trình:**

1. Đọc `docs/spec.md` + `CLAUDE.md` → context cho AI
2. Spec rõ feature → prompt → AI generate
3. **Review 100% code AI sinh ra**
4. Test → commit
5. Ghi vào `PROMPT_LOG.md`: prompt + AI output + chỉnh sửa + kết quả

Xem [`PROMPT_LOG.md`](PROMPT_LOG.md) để hiểu cách team làm việc với AI.

---

## 🎬 Demo

### Video demo (E2E automated)

Các video được quay tự động bằng Playwright E2E test, mô phỏng luồng sử dụng thực tế:

| Video                                                                     | Mô tả                                                                                                                            | Thời lượng |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| [`portal-demo.webm`](e2e/videos/final/portal-demo.webm)                   | **Portal Admin/Manager** — Login → Dashboard (KPI, heatmap, top chi nhánh) → Quản lý nhân viên → Chấm công → Bất thường → Logout | ~1.6 phút  |
| [`mobile-demo.webm`](e2e/videos/final/mobile-demo.webm)                   | **Mobile Employee** — Login → Check-in (GPS) → Check-out → Lịch sử → Profile → Logout                                            | ~50 giây   |
| [`smart-attendance-demo.mp4`](e2e/videos/final/smart-attendance-demo.mp4) | **Combined** — Portal + Mobile ghép lại                                                                                          | ~2.4 phút  |

### Highlight tính năng sáng tạo

1. **Trust Score Engine** — Mỗi check-in được chấm 0–100 điểm dựa trên 12 risk flags (GPS accuracy, WiFi BSSID, device trust, mock location, impossible travel, VPN). Logic thuần túy, không I/O, 100% unit tested.
2. **Anomaly Dashboard** — Background job (BullMQ) phân tích dữ liệu 7 ngày, phát hiện: chi nhánh có tỷ lệ trễ đột biến, nhân viên trust score thấp liên tục, thiết bị mới chưa xác minh. Kết quả cache Redis, hiển thị real-time.
3. **Anti-fraud 3 lớp** — Hard validation (reject ngay) → Risk flags (soft signals) → Trust score (weighted sum). Failed attempts vẫn ghi log để forensic.
4. **Override với Audit** — Manager có thể override attendance session, mọi thay đổi ghi audit log đầy đủ (before/after JSON).

### Kịch bản demo chi tiết

Xem [`docs/demo-script.md`](docs/demo-script.md) — kịch bản 8-10 phút self-shoot.

### Cách chạy E2E test + quay video

```bash
# Đảm bảo api, portal, mobile đang chạy
pnpm nx serve api
pnpm nx serve portal
pnpm nx serve mobile --port 8100

# Seed data (bao gồm data cho hôm nay)
pnpm prisma db seed

# Trigger daily-summary job cho hôm nay
curl -X POST http://localhost:3000/api/v1/admin/jobs/daily-summary/run \
  -H 'Authorization: Bearer <admin_token>' \
  -H 'Content-Type: application/json' \
  -d '{"for_date":"YYYY-MM-DD"}'  # thay bằng ngày hôm nay

# Trigger anomaly-detection job
curl -X POST http://localhost:3000/api/v1/admin/jobs/anomaly-detection/run \
  -H 'Authorization: Bearer <admin_token>'

# Chạy E2E test (có quay video)
cd e2e && npx playwright test --headed

# Video output: e2e/videos/test-results/
```

---

## 🌿 Git Flow

```
main ←─ release/* ←─ develop ←─ feature/*
                              ←─ hotfix/*
```

- **Conventional Commits:** `feat(scope): ...`, `fix(scope): ...`
- 1 feature = 1 branch + 1 PR + review
- PR template + auto CI (lint + test) trước khi merge

---

## 📊 Tiêu chí đánh giá (theo đề bài)

| Tiêu chí          | Tỷ trọng | Đáp ứng                                                        |
| ----------------- | -------: | -------------------------------------------------------------- |
| Tính năng & UX    |      25% | Check-in/out, multi-branch, dashboard 3 cấp, mobile-first      |
| Kiến trúc & scale |      20% | Schema multi-branch, index, partition, cache, queue (xem docs) |
| Git Flow & Docker |      15% | GitFlow + Conventional Commits, `docker-compose up` 1 lệnh     |
| AI workflow       |      15% | `CLAUDE.md` + `PROMPT_LOG.md` đầy đủ                           |
| **Sáng tạo**      |  **25%** | **Trust Score + Anomaly Dashboard + Anti-fraud 3 lớp**         |

---

## 📜 License

Internal project — đề thi tuyển dụng.

---

## 👥 Team

| Name       | Role                 | Contact                                              |
| ---------- | -------------------- | ---------------------------------------------------- |
| Tình Thành | Full-stack Developer | [github.com/tinhthanh](https://github.com/tinhthanh) |
