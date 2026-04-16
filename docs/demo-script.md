# Demo Script — Smart Attendance (8-10 phút)

> Script tự quay (self-shoot) cho video submission. Mỗi phần có time budget +
> bullet checklist + talking points. Dry-run với stopwatch trước khi quay thật.

---

## Setup trước khi quay (KHÔNG tính vào time)

- **Browser**: Chrome 100+, DevTools sẵn (Sensors panel — `Cmd+Shift+P` → "Show Sensors")
- **Terminal**: `docker compose up -d` đã chạy ~30s trước (4 services healthy)
- **Tab 1**: Portal đang ở trang login `http://localhost:4200/login`
- **Tab 2**: Mobile responsive (Chrome device toolbar 375×812 iPhone) ở `http://localhost:8100/`
- **Tab 3**: Terminal split — `docker compose logs -f api` để show real-time logs (optional)
- **Backup screenshots** (3 ảnh) cho fallback nếu live demo lỗi:
  - admin dashboard với heatmap
  - mobile fail dialog
  - anomaly page với 1 employee row
- **Test accounts** (sẵn sàng paste):
  - Admin: `admin@demo.com` / `Admin@123`
  - Manager HCM: `manager.hcm@demo.com` / `Manager@123`
  - Employee 001: `employee001@demo.com` / `Employee@123`
- **Coordinates** dùng cho mock GPS:
  - HCM-Q1 (in geofence): `10.7769, 106.7009`
  - Hà Nội (out of geofence): `21.0285, 105.8542`

---

## Phần 1 (1') — Giới thiệu + tech stack

**Time budget**: 0:00 → 1:00

**Talking points:**

- "Smart Attendance — hệ thống chấm công cho doanh nghiệp **100 chi nhánh × 5.000 nhân viên**."
- Problem: chấm công geofence + WiFi cần chống gian lận (fake GPS, mock location, VPN).
- Solution: **Trust Score 0-100** + **Anomaly Dashboard** — manager review thay vì duyệt thủ công.
- Tech stack 1 sentence: "Nx monorepo, NestJS backend, Ionic Angular cho cả mobile + portal, Postgres + Redis + BullMQ, Docker Compose."

**On-screen actions:**

- Mở README.md trên GitHub (hoặc local) — show 3 badges (CI + Stack + DB) + section "Tính năng chính"
- Scroll nhanh xuống "🛡️ Anti-fraud strategy" — show 12 risk flag table

---

## Phần 2 (2') — Admin: branch + WiFi/GPS + employee

**Time budget**: 1:00 → 3:00

**Talking points:**

- "Admin có thể CRUD chi nhánh, cấu hình WiFi BSSID + geofence."
- "Mọi mutation đều ghi audit_log + invalidate cache config."

**On-screen actions:**

1. Tab portal → login `admin@demo.com` / `Admin@123` → /dashboard (admin overview)
2. Show: 4 KPI cards + 2 bar charts (top branches on-time / late) + heatmap check-in theo giờ
3. Click menu → /branches → list 3 branches (HCM-Q1, HN-HoanKiem, DN-HaiChau)
4. Click "+ Tạo chi nhánh" → modal:
   - Code: `DEMO-LIVE`
   - Name: `Demo Branch`
   - Lat: `10.7769`, Lng: `106.7009`
   - Save → toast "Đã tạo"
5. Click vào DEMO-LIVE → tab WiFi → "+ WiFi config":
   - SSID: `DemoWiFi`, BSSID: `AA:BB:CC:DD:EE:FF`
6. Tab Geofence → "+ Geofence":
   - Center lat/lng same, radius `100`m
7. (Skip employee creation nếu thiếu time — đã có 30 employee seed)

---

## Phần 3 (3') — Mobile employee check-in flow

**Time budget**: 3:00 → 6:00

**Talking points:**

- "Mobile employee check-in qua GPS + WiFi + device fingerprint."
- "Trust Score = weighted sum của các risk flag. < 40 = suspicious báo manager."
- "Vietnamese flag explanations, 4-tier severity color." (xem libs/shared/constants/risk-flags.ts)

**On-screen actions:**

### 3a. Success check-in (1')

1. Tab mobile → login `employee001@demo.com` / `Employee@123`
2. /home → status "Chưa check-in hôm nay"
3. DevTools Sensors → Location → "Other..." → set `10.7769, 106.7009` (HCM-Q1 in geofence)
4. Click "Chấm công vào"
5. Modal hiện: "Chấm công thành công" + "Trust Score: 85" + chip xanh "trusted"

### 3b. Fail check-out — outside geofence (1.5')

1. Click "Chấm công ra" (vẫn trong status đã check-in)
2. DevTools Sensors → đổi location `21.0285, 105.8542` (Hà Nội — xa HCM ~1140km)
3. Click "Chấm công ra" → fail modal:
   - **Header**: "Không thể chấm công"
   - **Sub-header (primary)**: "Ngoài vùng" (severity danger - đỏ)
   - **Body**: "Vị trí GPS nằm ngoài bán kính cho phép của chi nhánh (cách 1140000m)"
   - **Secondary chips**: "WiFi sai" (do không có SSID match)
4. Highlight: hiển thị tiếng Việt + primary flag tự động chọn theo severity rank (danger > warning > info > success)

### 3c. Mock location detection (0.5')

1. Show DevTools console: gọi `navigator.geolocation.getCurrentPosition` với mock plugin (hoặc skip phần này, dùng Phần 3b coords + giải thích "trên thiết bị thật, app phát hiện `is_mock_location=true` từ Capacitor Device API")

---

## Phần 4 (2') — Manager dashboard + anomaly + CSV export

**Time budget**: 6:00 → 8:00

**Talking points:**

- "Manager scope strict: chỉ thấy phiên thuộc chi nhánh được phân công."
- "Anomaly dashboard tự cập nhật mỗi 1h qua cron BullMQ."
- "CSV export async qua queue, không block request."

**On-screen actions:**

### 4a. Manager branch dashboard (45")

1. Logout → login `manager.hcm@demo.com` / `Manager@123`
2. Auto navigate /dashboard/branch/<HCM-id>
3. Show: today KPI (checked_in / not_yet / absent) + week trend chart (line chart 7 ngày) + low_trust_today list với risk_flag chips (severity color)
4. Hover 1 chip → popover hiện description tiếng Việt

### 4b. Anomaly dashboard (45")

1. Login admin tab → menu /anomalies
2. Show 3 cards: untrusted devices count + branches_late_spike list + employees_low_trust list
3. Click 1 employee row → navigate /employees/:id (existing route)
4. Back → click 1 branch row → /dashboard/branch/:id

### 4c. CSV export (30")

1. Menu /attendance → list sessions
2. Filter: 7 ngày qua, all branches
3. Click "Xuất CSV" button → modal "Đang xử lý báo cáo..." (progress polling 2s)
4. ~5s sau → "Hoàn tất, đã xuất 180 dòng" + auto download `attendance_<jobId>.csv`
5. Open .csv trong Excel → tiếng Việt render đúng (UTF-8 BOM `\uFEFF`)

---

## Phần 5 (1') — Highlight Trust Score + Anti-fraud + scale

**Time budget**: 8:00 → 9:00

**Talking points:**

- **3 lớp anti-fraud**:
  1. Hard validation (geofence + WiFi)
  2. 12 risk flags với 4 severity (xem README §🛡️)
  3. Trust Score 0-100 → trusted (≥70) / review (40-69) / suspicious (<40)
- **Scale design** — 100 branches × 5000 employees, peak 7:45-8:15 ~10 req/s:
  - Read model `daily_attendance_summaries` — dashboard không JOIN raw events
  - Redis cache 60s dashboard, 5m branch config
  - BullMQ async cron jobs (summary, anomaly, cleanup)
  - Stateless API + Postgres replica + Redis cluster ready
- **Trade-offs đã chọn** (xem [docs/architecture.md §4](architecture.md)):
  - Ionic cho cả 2 app — single skill, faster MVP
  - Prisma + raw SQL exception cho analytics
  - Local CSV → S3 sau

**On-screen actions:**

- Mở [docs/architecture.md](architecture.md) — show Mermaid system diagram + scale table
- Scroll xuống §5 Known limitations — show transparency about mobile WiFi cap, image size, BullMQ shutdown hooks pending

---

## Phần 6 (1') — AI workflow walkthrough

**Time budget**: 9:00 → 10:00

**Talking points:**

- "Toàn bộ MVP build trong 5 ngày với AI pair programming (Claude Code)."
- **3-round workflow** mỗi task:
  1. PRE-WORK: branch + verify state (Explore agent)
  2. PLAN: 10 decisions trong `docs/plans/T-XXX-plan.md`, **không exec**
  3. EXEC: code + smoke test, **AI không commit** — user review + commit
- **Pattern reuse growth**: T-005 auth pattern → T-007 employees, T-013 list/filter pattern reuse 3 lần (sessions/employees/anomalies).
- **CLAUDE.md governance**: forbidden list (no `findMany` không limit, no raw Prisma trong controller, ...) — AI tuân theo từng task.

**On-screen actions:**

- Mở [PROMPT_LOG.md](../PROMPT_LOG.md) — scroll: 21 entries qua 18 task IDs
- Mở [docs/plans/](plans/) — show 18 plan files, mỗi file ~200-300 dòng cấu trúc đều
- Closing: "Cách làm này = AI productivity boost + code quality control. Repo = bằng chứng full transparency: PROMPT_LOG mỗi quyết định, Plan mỗi task, smoke test mỗi exec."

---

## Outro (10:00) — không tính time

- "Cảm ơn anh/chị đã xem. Repo: github.com/tinhthanh/smart-attendance"
- "Chi tiết AI workflow + design decisions: PROMPT_LOG.md + docs/plans/"

---

## Backup contingencies

| Issue khi quay live           | Fallback                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- |
| docker compose chậm khởi động | Skip Phần 2 (đã có 3 branches seed) — đi thẳng Phần 3 mobile                                                  |
| Mobile DevTools mock GPS lỗi  | Dùng screenshot backup (set 1 ảnh success + 1 ảnh fail)                                                       |
| CSV export > 10s              | Cut record, voiceover "thường < 5s với 200 sessions, 10k rows ~ 30s max"                                      |
| Anomaly empty                 | Trigger thủ công: `curl -X POST http://localhost:3000/api/v1/admin/jobs/anomaly-detection/run` trước khi quay |
| Phần 6 quá dài                | Skip "pattern reuse growth" detail — chỉ nói 3-round + PROMPT_LOG                                             |

---

## Pre-record checklist

- [ ] Docker services healthy (`docker compose ps`)
- [ ] 3 tabs sẵn (portal login + mobile responsive + terminal logs)
- [ ] DevTools Sensors panel mở sẵn cả 2 tab portal + mobile
- [ ] OBS / QuickTime ready, screen + mic test
- [ ] Stopwatch external (phone) cho time check
- [ ] Backup screenshots loaded
- [ ] Test một lần dry-run silent
