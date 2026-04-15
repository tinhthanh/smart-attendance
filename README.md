# Smart Attendance

> Hệ thống chấm công thông minh cho doanh nghiệp **100 chi nhánh, 5.000 nhân viên** — check-in/out qua GPS geofencing + WiFi, có Trust Score và Anomaly Detection.

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

Chi tiết: [`docs/spec.md` §2](docs/spec.md), [`docs/erd.md`](docs/erd.md).

---

## 🛠️ Tech Stack

| Lớp | Công nghệ |
|---|---|
| Monorepo | **Nx** |
| Backend | **NestJS** + **Prisma** ORM |
| Database | **PostgreSQL 16** |
| Cache/Queue | **Redis** + **BullMQ** |
| Web Portal | **Ionic Angular** |
| Mobile | **Ionic + Capacitor** |
| Auth | **JWT** (access + refresh) |
| Container | **Docker Compose** |
| Test | Jest + Supertest |

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
| Role | Email | Password |
|---|---|---|
| Admin | `admin@demo.com` | `Admin@123` |
| Manager | `manager.hcm@demo.com` | `Manager@123` |
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

## 🛡️ Anti-fraud strategy

### 3 lớp kiểm tra
1. **Hard validation:** ngoài geofence + WiFi sai → reject
2. **Risk flags:** mock location, accuracy kém, device mới, impossible travel, VPN
3. **Trust Score 0–100:** weighted sum → xanh/vàng/đỏ

### Tại sao không "chống tuyệt đối"?
- Wi-Fi API trên iOS/Android có giới hạn permission
- Mục tiêu: **nâng chi phí gian lận** + cung cấp evidence cho manager review
- Mọi failed attempt vẫn log vào `attendance_events`

Chi tiết: [`docs/spec.md` §6](docs/spec.md).

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

- **Video demo:** (link YouTube/Drive sẽ thêm sau)
- **Live demo:** (nếu deploy)
- **Demo script:** xem [`docs/demo-script.md`](docs/demo-script.md) (sẽ tạo)

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

| Tiêu chí | Tỷ trọng | Đáp ứng |
|---|---:|---|
| Tính năng & UX | 25% | Check-in/out, multi-branch, dashboard 3 cấp, mobile-first |
| Kiến trúc & scale | 20% | Schema multi-branch, index, partition, cache, queue (xem docs) |
| Git Flow & Docker | 15% | GitFlow + Conventional Commits, `docker-compose up` 1 lệnh |
| AI workflow | 15% | `CLAUDE.md` + `PROMPT_LOG.md` đầy đủ |
| **Sáng tạo** | **25%** | **Trust Score + Anomaly Dashboard** |

---

## 📜 License

Internal project — đề thi tuyển dụng.

---

## 👥 Team

(điền tên + role)
