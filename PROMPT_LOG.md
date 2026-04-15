# PROMPT_LOG.md — Nhật ký làm việc với AI IDE

> Ghi lại mọi prompt quan trọng + cách review/refine. Đây là **một trong những phần được chấm điểm** của bài thi (15% AI workflow).

---

## Cách dùng file này

Mỗi entry theo format:

```markdown
## [#XX] <Mục tiêu ngắn gọn>
- **Date:** YYYY-MM-DD
- **Tool:** Claude Code | Cursor | Copilot
- **Module:** auth | attendance | dashboard | ...
- **Phase:** spec | scaffolding | feature | bugfix | refactor | test | docs

### Mục tiêu
<1-2 câu mô tả muốn AI làm gì>

### Prompt
\`\`\`
<paste prompt thực tế đã gửi>
\`\`\`

### AI sinh ra
<tóm tắt: file/function nào, dùng pattern gì>

### Vấn đề phát hiện khi review
- ...
- ...

### Cách chỉnh sửa
- ...

### Kết quả cuối cùng
- Commit: `<hash>` hoặc PR `#NN`
- Test: pass/fail
- Note: <điều rút ra>
```

---

## Nguyên tắc ghi log

1. **Không ghi đối phó.** Tránh format kiểu "Prompt 1: tạo login → xong". Phải có review + chỉnh sửa.
2. **Ghi cả prompt fail.** Khi AI sinh sai, ghi lại để rút kinh nghiệm prompt sau.
3. **Ghi quyết định KHÔNG dùng AI.** Vd: "Tự viết trust score logic vì AI hiểu sai weight" — cũng là AI workflow tốt.
4. **Tham chiếu commit/PR.** Mỗi entry có thể trace về code thực tế.
5. **Phân loại theo phase** để cuối kỳ tổng kết.

---

## Bài học chung (cập nhật dần)

- AI hay sinh `findMany()` không có `take` → luôn nhắc pagination trong prompt
- AI hay quên guard role → review từng controller endpoint
- AI hay thêm dependency lạ → check `package.json` diff
- AI hay viết comment kiểu "// added for X" → xóa hết khi review
- **Workflow 3 vòng (plan → verify peer deps → execute)** tránh được rollback (xem #02)
- **Verify preset/template compat với TỪNG generator**, không chỉ version package (xem #02)
- AI hay đề xuất bypass safeguard (`NX_IGNORE_UNSUPPORTED_*`, `--force`, `--no-verify`) khi gặp lỗi → reject, buộc tìm root cause
- (thêm dần khi gặp)

---

# ENTRIES

---

## [#01] Khởi tạo spec + ERD + API contract
- **Date:** 2026-04-15
- **Tool:** Claude Code (Opus 4.6)
- **Module:** docs
- **Phase:** spec

### Mục tiêu
Phân tích đề bài + tạo bộ tài liệu nền: `spec.md`, `erd.md`, `api-spec.md`, `CLAUDE.md`, `PROMPT_LOG.md`, `README.md`.

### Prompt
```
giúp tôi phân tích bài tập README.MD
Công nghệ: ionic + nestjs + prisma
IONIC build web portal + app cho người dùng
dùng nx, postgres cho database
đánh giá phân tích resarch1.md
→ chúng ta cần làm spec trước
→ viết tài liệu giúp tôi
→ tiếp tục theo thứ tự ưu tiên
```

### AI sinh ra
- `docs/spec.md` (14 mục, ~470 dòng): rule nghiệp vụ, trust score, anti-fraud, scale strategy, MVP scope
- `docs/erd.md` (10 mục): Mermaid ERD + Prisma schema đầy đủ + index strategy + partition plan
- `docs/api-spec.md` (13 mục): convention, 8 module API với request/response + error catalog
- `CLAUDE.md`: context file cho AI IDE — conventions, structure, forbidden list
- `PROMPT_LOG.md`: file này
- `README.md`: khung dự án

### Vấn đề phát hiện khi review
- (chờ team review)
- Cần verify Capacitor plugin Wi-Fi cho iOS/Android trước ngày 2
- Schema chưa migration thực tế — cần `prisma migrate dev` để confirm

### Cách chỉnh sửa
- (cập nhật khi review xong)

### Kết quả cuối cùng
- Commit: `165a53f` — `docs: initial spec, ERD, API contract, AI context`
- Test: N/A (docs)
- Note: Bộ tài liệu này là **đầu vào bắt buộc** cho mọi prompt sau. Mỗi feature mới phải reference spec/api-spec.

---

## [#02] T-001 — Khởi tạo Nx workspace
- **Date:** 2026-04-15
- **Tool:** Claude Code (Sonnet, agent mode)
- **Module:** infra / monorepo
- **Phase:** scaffolding

### Mục tiêu
Tạo Nx monorepo với 3 apps (api/portal/mobile) + 3 libs shared theo `CLAUDE.md §3` và `docs/tasks.md` T-001.

### Prompt
Workflow 3 vòng (plan → verify → execute), không chạy 1 phát:

**Vòng 1 — Yêu cầu plan chi tiết:**
```
Chọn option 2 — lập plan chi tiết TRƯỚC khi thực thi.
Cụ thể tôi cần plan gồm: [danh sách lệnh, dependency pinned, structure cây
thư mục, file root, quyết định kiến trúc cần xác nhận, risk + alternative].
KHÔNG chạy lệnh nào cho đến khi tôi review plan và confirm.
```

**Vòng 2 — Verify peer dependencies trước khi exec:**
```
Verify Nx 22 vs Angular 20 peer compatibility. Lưu plan thành
docs/plans/T-001-plan.md. Sau rsync xong, in git status để tôi review,
KHÔNG tự commit.
```

**Vòng 3 — Quyết định khi gặp incident (xem dưới):**
```
Chọn Option B — rescaffold với --preset=apps. Update docs/plans/T-001-plan.md
v0.2 + tạo docs/plans/T-001-incident-log.md.
```

### AI sinh ra
- `docs/plans/T-001-plan.md` (v0.2) — chốt tech stack: Nx 21.6.10 + Angular
  20.3 + Ionic 8.8.3 + Capacitor 8.3 + TS 5.9
- `docs/plans/T-001-incident-log.md` — root cause + lesson learned
- Workspace: `apps/{api,api-e2e,portal,mobile}` + `libs/shared/{types,constants,utils}`
- 7 projects trong nx graph
- Path mapping `@smart-attendance/shared/*` trong `tsconfig.base.json`

### Vấn đề phát hiện khi review

**Incident #1: Sai preset chọn ban đầu**
- AI ban đầu chọn `--preset=ts` cho `create-nx-workspace`. Generate apps/api
  (NestJS) thành công, nhưng `nx g @nx/angular:app portal` fail với:
  > The "@nx/angular:application" generator doesn't support the existing
  > TypeScript setup. The Angular framework doesn't support a TypeScript
  > setup with project references.
- **Root cause:** trong Nx 21, preset `ts` = package-based với TS project
  references (composite: true, customConditions, module nodenext) → Angular
  compiler không tương thích (angular/angular#37276).
- **Resolution:** rescaffold với `--preset=apps` (integrated monorepo classic
  với paths thay vì project references) — đây mới là preset chính thức cho
  full-stack Angular + Nest.
- **AI ban đầu đề xuất Option A** (`NX_IGNORE_UNSUPPORTED_TS_SETUP=true`)
  → bị reject vì vi phạm cờ đỏ "không tắt safeguard" trong tasks.md.

**Vấn đề khác khi review:**
- `package.json` name = `@sa-init/source` (từ tên scaffold tạm) → đổi thành
  `@smart-attendance/source`.
- `scripts: {}` trống → thêm convenience scripts (start:api, build, test, lint).
- `prettier ^2.6.2` (cũ) → defer upgrade 3.x.
- `jest-preset-angular ~14.6.1` peer wants jest@^29 nhưng cài jest@30 → defer
  fix until FE test thực sự fail (sẽ revisit T-011/T-012).
- `reflect-metadata ^0.1.13` → defer verify khi T-005 NestJS auth.

### Cách chỉnh sửa
1. Switch preset → tự rescaffold `/tmp/sa-init` với `--preset=apps`.
2. Rsync về repo chính, exclude `.git/`, `docs/`, `*.md` root, `.gitignore`.
3. Sửa `package.json` name + scripts (manual edit).
4. Append known issues vào `T-001-incident-log.md` để revisit sau.

### Kết quả cuối cùng
- Commit: `75c87ea` — `chore: init nx workspace with api, portal, mobile apps`
- Branch: `develop` (pushed)
- Test: `nx graph` 7 projects ✅, `pnpm install` OK ✅
- File tracking: `docs/plans/T-001-plan.md` v0.2 + `T-001-incident-log.md`

### Bài học rút ra (cập nhật vào header file)
- **Khi planning Nx:** verify preset compatibility với TỪNG generator dự định
  dùng, không chỉ verify version package. `--preset=ts` ≠ "TypeScript-friendly
  preset" — nó là package-based với project references.
- **Workflow 3 vòng (plan → verify → execute) hiệu quả:** tránh được phải
  rollback hoặc bypass safeguard. Nếu chạy 1 phát ngay từ vòng 1, AI sẽ tự
  set `NX_IGNORE_UNSUPPORTED_TS_SETUP=true` để "fix" → tích nợ kỹ thuật
  không rõ ràng.
- **Cờ đỏ trong tasks.md hoạt động:** AI đề xuất bypass safeguard (Option A)
  → user reject → buộc tìm giải pháp đúng (Option B).

---

<!-- Thêm entry mới ở dưới đây -->

## [#03] <Next: T-002 Docker skeleton>
- **Date:**
- **Tool:**
- **Module:**
- **Phase:**

### Mục tiêu

### Prompt
```
```

### AI sinh ra

### Vấn đề phát hiện khi review

### Cách chỉnh sửa

### Kết quả cuối cùng
