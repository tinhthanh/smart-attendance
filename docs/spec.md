# SMART ATTENDANCE — PRODUCT SPEC v0.1

> Tài liệu nghiệp vụ chốt trước khi code. Là nguồn duy nhất (single source of truth) cho AI IDE, team dev, và tiêu chí review.

---

## 1. Tổng quan

**Sản phẩm:** Hệ thống chấm công thông minh cho doanh nghiệp **100 chi nhánh, 5.000 nhân viên**.

**Giá trị cốt lõi:**
- Check-in/out nhanh qua **GPS geofencing** và/hoặc **WiFi SSID/BSSID**
- **Chống gian lận** (fake GPS, VPN, mock location) bằng cơ chế multi-layer
- **Trust Score** cho mỗi lần chấm công + **Anomaly Dashboard** phát hiện bất thường
- Quản lý multi-branch, phân quyền 3 cấp, báo cáo linh hoạt

**Nguyên tắc thiết kế:**
- Mobile-first cho check-in (truy cập Wi-Fi/GPS API chính thức)
- Web portal cho quản trị (admin/manager)
- Backend duy nhất phục vụ cả hai
- Scale-ready ngay từ schema

---

## 2. Tech stack

| Lớp | Công nghệ | Ghi chú |
|---|---|---|
| Monorepo | **Nx** | `apps/api`, `apps/portal`, `apps/mobile`, `libs/shared-*` |
| Backend | **NestJS** + **Prisma** | Module-based, RBAC guards, DTO validation |
| Database | **PostgreSQL 16** | Primary store, partition attendance_events theo tháng |
| Cache/Queue | **Redis** + **BullMQ** | Dashboard cache, export job, rate limit |
| Mobile | **Ionic + Capacitor** | Check-in app, plugin Wi-Fi/Geolocation |
| Web Portal | **Ionic (Angular/React)** | Admin dashboard, branch mgmt, report |
| Auth | **JWT** access + refresh | httpOnly cookie cho web, secure storage cho mobile |
| Deploy | **Docker Compose** | 1-command boot: api + portal + postgres + redis |

---

## 3. Vai trò & phân quyền

| Role | Phạm vi | Quyền chính |
|---|---|---|
| **Admin** | Toàn hệ thống | CRUD tất cả, xem dashboard toàn bộ, xuất báo cáo hệ thống, cấu hình rule |
| **Manager** | 1 hoặc nhiều chi nhánh | Xem nhân viên chi nhánh, duyệt/chỉnh sửa attendance, báo cáo chi nhánh |
| **Employee** | Cá nhân | Check-in/out, xem lịch sử cá nhân, xem ca làm |

**Nguyên tắc:**
- Role-based (RBAC) + scope-based (branch ownership cho manager)
- Tất cả API đều kiểm `role` + `branch_scope` qua NestJS guard
- Audit log mọi thao tác của admin/manager trên dữ liệu người khác

---

## 4. Luồng nghiệp vụ chính

### 4.1 Check-in

```
Mobile → thu thập: GPS (lat, lng, accuracy), SSID/BSSID, timestamp, device_fingerprint, platform, app_version
       → POST /api/attendance/check-in
Backend:
  1. Xác thực JWT, xác định employee + primary_branch
  2. Xác định ca làm hiện tại (work_schedule của nhân viên)
  3. Load branch config: geofences, wifi_whitelist
  4. Validation layer 1 (hard):
     - GPS trong geofence? HOẶC
     - BSSID khớp whitelist?
     → nếu cả hai đều fail → reject, log failed event
  5. Risk layer 2 (soft):
     - mock_location flag từ device?
     - accuracy > 100m?
     - device mới chưa trusted?
     - tốc độ di chuyển bất thường (so với event trước)?
     - IP/VPN bất thường?
  6. Tính trust_score (0-100) theo rule weight
  7. Tạo/cập nhật attendance_session (ngày hôm nay)
  8. Tạo attendance_event (type=check_in, status=success/failed)
  9. Xác định status ngày: on_time | late (vượt grace_minutes)
  10. Response: { status, trust_score, validation_method, risk_flags[] }
```

### 4.2 Check-out

- Flow tương tự check-in
- Cập nhật `attendance_session.check_out_at`, tính `worked_minutes`
- Đánh dấu `overtime` nếu vượt `overtime_after_minutes`
- Đánh dấu `early_leave` nếu ra trước giờ chuẩn

### 4.3 Quên check-out

- Cron job 23:59 mỗi ngày:
  - Với session có `check_in_at` nhưng không có `check_out_at`
  - Set `status = missing_checkout`
  - Không tính `overtime`, `worked_minutes` = null
  - Thông báo manager ngày hôm sau

### 4.4 Tổng hợp ngày công

- Cron job 00:30 mỗi ngày:
  - Duyệt tất cả active employee
  - Với nhân viên không có session hôm trước → tạo `daily_attendance_summary` status=`absent`
  - Nhân viên có session → tổng hợp vào `daily_attendance_summary`
- Dashboard đọc từ `daily_attendance_summary` thay vì join lại từ raw events → tăng performance

---

## 5. Rule nghiệp vụ cốt lõi

### 5.1 Validation rule

**Check-in hợp lệ** khi thỏa **1 trong 2**:
- **GPS valid**: vị trí nằm trong bất kỳ `branch_geofence` active của chi nhánh người dùng được gán, VÀ `accuracy ≤ 100m`
- **WiFi valid**: `BSSID` khớp với `branch_wifi_configs` active của chi nhánh (ưu tiên BSSID, fallback SSID)

Nếu **cả hai đều thỏa** → `validation_method = gps_wifi` → trust score cao hơn.

### 5.2 Trust Score (0-100)

| Yếu tố | Điểm |
|---|---|
| GPS trong geofence, accuracy ≤ 20m | +40 |
| GPS trong geofence, accuracy 20-100m | +25 |
| BSSID khớp whitelist | +35 |
| SSID khớp nhưng BSSID không | +15 |
| Thiết bị đã `is_trusted` | +15 |
| Thiết bị mới (lần đầu) | -10 |
| Mock location flag | -50 |
| Accuracy > 100m | -15 |
| Tốc độ di chuyển > 120 km/h so với event trước | -30 |
| IP công cộng / VPN detected | -10 |
| Không có cả GPS lẫn WiFi hợp lệ | tự động = 0, reject |

**Ngưỡng:**
- `score ≥ 70` → xanh (trusted)
- `40 ≤ score < 70` → vàng (review)
- `score < 40` → đỏ (suspicious, flag cho manager)

### 5.3 Ca làm & trạng thái ngày

**Ca mặc định:** 08:00–17:00, T2–T6, grace 10 phút, overtime sau 18:00.

| Status | Điều kiện |
|---|---|
| `on_time` | check_in ≤ 08:10 |
| `late` | 08:10 < check_in ≤ 12:00 |
| `absent` | không có check_in đến cuối ngày |
| `early_leave` | check_out < 17:00 |
| `overtime` | check_out > 18:00 (tính phút vượt) |
| `missing_checkout` | có check_in, thiếu check_out |

### 5.4 Nhân viên & chi nhánh

- Mỗi nhân viên có **1 `primary_branch_id`**
- Bảng `employee_branch_assignments` hỗ trợ `primary | secondary | temporary` với `effective_from/to`
- Check-in tại chi nhánh nào → hệ thống tự match theo vị trí; nếu khớp geofence của secondary branch đang active → vẫn valid

### 5.5 Check-in nhiều lần/ngày

- Mỗi ngày **1 `attendance_session`** chính/employee/branch
- Mọi attempt đều log `attendance_events` (kể cả failed)
- Check-in lần 2 trong cùng session → update `check_in_at` nếu lần đầu là fail, hoặc ignore nếu đã success

---

## 6. Anti-fraud strategy

### Lớp 1 — Hard validation (backend reject)
- Ngoài geofence VÀ không match WiFi
- Nhân viên chưa được gán vào branch
- Check-out khi chưa check-in
- Token hết hạn / bị revoke

### Lớp 2 — Risk flags (cho phép, nhưng gắn cờ)
- `mock_location_detected`
- `accuracy_poor` (>100m)
- `device_untrusted` (lần đầu thấy fingerprint này)
- `impossible_travel` (GPS 2 event quá xa trong thời gian ngắn)
- `vpn_suspected` (IP không khớp vùng địa lý)
- `reduced_accuracy` (iOS reduced accuracy mode)

### Lớp 3 — Trust score + Anomaly detection
- Score thấp → hiển thị trên dashboard manager
- Job chạy hằng ngày: phát hiện nhân viên có >3 event score thấp trong tuần → cảnh báo
- Top branch có tỷ lệ `late` hoặc `failed check-in` cao bất thường

**Lưu ý thực tế:**
- iOS (NEHotspotNetwork) cho phép lấy SSID/BSSID nhưng cần permission
- Android (WifiInfo) yêu cầu `ACCESS_FINE_LOCATION` + `NEARBY_WIFI_DEVICES` (Android 13+)
- Nếu không lấy được BSSID → fallback SSID + GPS, trust score giảm tương ứng
- Không hứa chống gian lận tuyệt đối — mục tiêu là nâng chi phí gian lận

---

## 7. Báo cáo & Dashboard

### 7.1 Employee (cá nhân)
- Lịch sử chấm công theo tháng
- Tổng giờ làm, số ngày on-time/late/absent
- Xem trust score từng lần check-in

### 7.2 Manager (chi nhánh)
- Danh sách nhân viên + trạng thái hôm nay (checked-in/not yet/absent)
- Báo cáo tuần/tháng chi nhánh
- Các lần check-in trust score thấp cần review
- Filter theo nhân viên, ngày, status

### 7.3 Admin (toàn hệ thống)
- Dashboard tổng:
  - Tổng nhân viên, tổng check-in hôm nay, tỷ lệ on-time
  - Top 5 chi nhánh đúng giờ / trễ nhiều nhất
  - Heatmap check-in theo giờ
- **Anomaly Dashboard:**
  - Chi nhánh có tỷ lệ trễ tăng bất thường (so với tuần trước)
  - Nhân viên có nhiều flag risk
  - Thiết bị mới chưa trusted
- Xuất báo cáo **CSV** theo khoảng thời gian (MVP)

### 7.4 Pagination & filter

- Mọi list API: `?page=1&limit=20&sort=check_in_at:desc`
- Filter: `branch_id`, `department_id`, `employee_id`, `date_from`, `date_to`, `status`
- Response chuẩn:
  ```json
  { "data": [...], "meta": { "page": 1, "limit": 20, "total": 1234, "total_pages": 62 } }
  ```

---

## 8. Scale strategy (100 chi nhánh × 5.000 nhân viên)

### 8.1 Peak load giả định
- Giờ cao điểm: 07:45–08:15 (30 phút)
- 5.000 nhân viên × ~1.2 attempts = 6.000 requests / 30 phút = **~3.3 req/s trung bình, peak ~10 req/s**
- Hoàn toàn xử lý được với 1 Node instance, nhưng thiết kế để scale ngang khi cần.

### 8.2 Database
- **Index:**
  - `attendance_sessions (employee_id, date)` UNIQUE
  - `attendance_sessions (branch_id, date)`
  - `attendance_events (session_id, created_at)`
  - `employee_branch_assignments (employee_id, effective_from, effective_to)`
- **Partition:** `attendance_events` partition by `RANGE (created_at)` theo tháng → giữ query hằng ngày nhanh, archive dễ.
- **Materialized view** hoặc bảng `daily_attendance_summaries` tổng hợp sẵn cho dashboard.

### 8.3 Caching
- Redis cache:
  - Branch config (geofence, wifi_whitelist) — TTL 5 phút, invalidate khi admin update
  - Dashboard aggregates — TTL 60s
  - Employee profile + role — TTL 10 phút

### 8.4 Queue
- BullMQ jobs:
  - `daily-summary` (00:30 mỗi ngày)
  - `missing-checkout-close` (23:59 mỗi ngày)
  - `report-export` (on-demand, tránh block request)
  - `anomaly-detection` (01:00 mỗi ngày)

### 8.5 Rate limit
- `/check-in`, `/check-out`: 10 req/phút/employee (Redis-backed)
- `/login`: 5 attempts/phút/IP
- Admin API: 60 req/phút/user

### 8.6 Horizontal scale (narrative trong README)
- API stateless → scale ngang sau load balancer
- Postgres: read replica cho dashboard query nặng
- Redis cluster khi cần
- Object storage (S3-compatible) cho export file

---

## 9. Module & API list (high-level)

### 9.1 Auth
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET  /auth/me`

### 9.2 Branches
- `GET    /branches` (pagination, filter)
- `POST   /branches` (admin)
- `GET    /branches/:id`
- `PATCH  /branches/:id`
- `DELETE /branches/:id`
- `GET    /branches/:id/wifi-configs`
- `POST   /branches/:id/wifi-configs`
- `GET    /branches/:id/geofences`
- `POST   /branches/:id/geofences`

### 9.3 Employees
- `GET    /employees` (filter by branch, department)
- `POST   /employees`
- `PATCH  /employees/:id`
- `POST   /employees/:id/assignments`
- `GET    /employees/:id/devices`

### 9.4 Attendance
- `POST /attendance/check-in`
- `POST /attendance/check-out`
- `GET  /attendance/me` (lịch sử cá nhân)
- `GET  /attendance/sessions` (manager/admin, filter)
- `GET  /attendance/sessions/:id`
- `PATCH /attendance/sessions/:id` (manager override, có audit log)

### 9.5 Reports
- `GET  /reports/daily-summary`
- `GET  /reports/branch/:id`
- `POST /reports/export` (trigger job, trả về job_id)
- `GET  /reports/export/:jobId` (poll status + download)

### 9.6 Dashboard
- `GET /dashboard/admin/overview`
- `GET /dashboard/manager/:branchId`
- `GET /dashboard/anomalies`

### 9.7 Schedules
- `GET  /work-schedules`
- `POST /work-schedules`
- `POST /work-schedules/:id/assign`

---

## 10. ERD (tham chiếu)

Chi tiết trong [`erd.md`](erd.md). Tóm tắt các bảng chính:

**Identity:** `users`, `roles`, `user_roles`
**Org:** `branches`, `departments`, `employees`, `employee_branch_assignments`
**Location config:** `branch_wifi_configs`, `branch_geofences`
**Devices:** `employee_devices`
**Schedule:** `work_schedules`, `work_schedule_assignments`
**Attendance:** `attendance_sessions`, `attendance_events`, `daily_attendance_summaries`
**Audit:** `audit_logs`

---

## 11. MVP scope (5 ngày)

### Must-have (ngày 1–3)
- [ ] Auth + RBAC 3 role
- [ ] Branch CRUD + WiFi/Geofence config
- [ ] Employee CRUD + assignment
- [ ] Check-in/out với validation GPS **OR** WiFi
- [ ] Lịch sử cá nhân + trang check-in mobile
- [ ] Dashboard admin cơ bản
- [ ] Docker Compose 1-command
- [ ] Seed 3 branch, 30 nhân viên, 7 ngày data mẫu

### Should-have (ngày 4)
- [ ] Trust Score tính đủ rule
- [ ] Late/absent/overtime logic
- [ ] Missing checkout cron
- [ ] Daily summary cron
- [ ] CSV export
- [ ] Manager dashboard chi nhánh

### Bonus (ngày 4–5 nếu kịp)
- [ ] Anomaly Dashboard
- [ ] Heatmap check-in theo giờ
- [ ] Notification (FE toast / mock email)
- [ ] Rate limit đầy đủ

### Explicitly out-of-scope
- Face recognition
- Realtime socket
- Payroll integration
- Push notification thật (mock là đủ)
- Mobile build production (demo dev build đủ)

---

## 12. Dữ liệu demo (seed)

- **3 chi nhánh:** HCM-Q1, HN-HoanKiem, DN-HaiChau
- Mỗi chi nhánh: 1 geofence + 1–2 WiFi BSSID
- **30 nhân viên** phân đều 3 chi nhánh
- **3 tài khoản test:**
  - `admin@demo.com` / `Admin@123`
  - `manager.hcm@demo.com` / `Manager@123`
  - `employee001@demo.com` / `Employee@123`
- **7 ngày attendance data** với mix status (on-time, late, absent, trust score cao/thấp)

---

## 13. Các quyết định đã chốt

| # | Quyết định | Lựa chọn |
|---|---|---|
| 1 | WiFi vs GPS | **OR** — 1 trong 2 là valid, cả hai → score cao hơn |
| 2 | Nhân viên & chi nhánh | 1 primary + bảng assignments mở rộng |
| 3 | Ca làm mặc định | 08:00–17:00, T2–T6, grace 10', overtime sau 18:00 |
| 4 | Check-in nhiều lần | 1 session/ngày, mọi attempt log vào events |
| 5 | Quên check-out | Cron 23:59 auto-close, status=`missing_checkout` |
| 6 | Sáng tạo chính | **Trust Score + Anomaly Dashboard** |
| 7 | Export báo cáo | **CSV** (MVP) |

---

## 14. Changelog

- **v0.1** (2026-04-15): Bản đầu tiên, chốt scope MVP 5 ngày.
