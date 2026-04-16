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
- **"Idempotent" phải verify bằng diff counts**, không bằng exit code (xem #04)
- **UUID namespace phải generate fresh + comment "do not change"**, không reuse từ examples (xem #04)
- **Postinstall hook > manual generate** cho artifact phụ thuộc schema (Prisma client) — tránh drift (xem #04)
- **AI có thể catch lỗi user** khi có context user không nhớ (vd: git log) — cho phép push back 2 chiều (xem #05)
- **Scope enum tránh trùng tên với conventional commit types** (test/fix/chore/docs/feat/...) — tránh ambiguity (xem #05)
- **CI credentials tách bạch khỏi dev/.env.example** — không reuse, ngay từ MVP (xem #05)
- **Nx cache local HIDE test failures** mà CI sẽ catch — trước commit task lớn `pnpm nx reset && nx run-many --target=test --all` (xem #06)
- **AI proactive về bảo mật khi prompt nhấn "đặc biệt cẩn thận"** — không cần chỉ định từng pattern (refresh rotation, replay detection) (xem #06)
- **Library type churn:** cast với comment + defer là acceptable pattern (xem #06)
- **Separation of concerns module:** business service không ở module infrastructure (Prisma/HTTP) (xem #07)
- **AI self-audit khả thi** khi prompt yêu cầu "known issues" explicit trong output (xem #07)
- **Pattern reuse accelerates velocity** — task sau của cùng domain ít push back hơn (T-005 → T-006) (xem #07)
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

## [#03] T-002 — Docker Compose skeleton (Postgres + Redis)

- **Date:** 2026-04-15
- **Tool:** Claude Code (Sonnet, agent mode)
- **Module:** infra
- **Phase:** scaffolding

### Mục tiêu

`docker compose up -d` chạy được Postgres 16 + Redis 7 cho dev local, có healthcheck, security tốt (localhost-only), và `.env.example` đầy đủ var cho T-001 → T-005.

### Prompt

Workflow 3 vòng (plan → confirm → exec) tiếp tục áp dụng:

**Vòng 1 — Yêu cầu plan + Git Flow đúng:**

```
Update trạng thái: T-001 ĐÃ commit + push xong... Pull develop về cho đồng bộ.
Sau đó BẮT ĐẦU T-002 với workflow chuẩn theo CLAUDE.md §6:
1. Tạo feature branch từ develop: feature/infra-docker-compose
2. LẬP PLAN T-002 trước khi exec — lưu vào docs/plans/T-002-plan.md
   (postgres config, redis config, .env vars, network, volumes, healthchecks,
   7 quyết định cần xác nhận với A/B options).
3. KHÔNG chạy lệnh nào, KHÔNG tạo file nào ngoài plan trước khi tôi confirm.
```

**Vòng 2 — Confirm 7 defaults + foreshadow Prisma:**

```
OK cả 7 defaults. Exec.
1 lưu ý nhỏ cho T-003: Prisma migrate dev cần CREATEDB. Đề xuất docker/postgres/init.sql.
KHÔNG implement init.sql trong T-002 — chỉ note vào plan mục "Followup for T-003".
Sau exec: in ra docker-compose.yml + .env.example để tôi review trước khi commit.
```

### AI sinh ra

- `docker-compose.yml` (48 lines): postgres:16-alpine + redis:7-alpine, named volumes, custom bridge network `sa-net`, healthchecks, `127.0.0.1:` binding.
- `.env.example` (22 lines): Postgres, Redis, API, JWT, frontend ports — comments rõ ràng, no real secrets.
- `docs/plans/T-002-plan.md` v0.1: 7 quyết định kiến trúc + risk matrix + acceptance mapping.

### Vấn đề phát hiện khi review

**Vấn đề 1: Port 5432 conflict trên máy dev local**

- Compose fail với: `Error response from daemon: Ports are not available: ... bind: address already in use`
- Root cause: máy dev đang chạy Postgres native (brew/Postgres.app)
- **Resolution:** không sửa `docker-compose.yml` (mặc định 5432 đúng cho repo). Thay vào đó, **chỉ override trong `.env` local** (POSTGRES_PORT=5433 + DATABASE_URL port 5433). Container internal vẫn 5432, chỉ host binding đổi.
- → Nhờ design tốt từ đầu (`POSTGRES_PORT=${POSTGRES_PORT:-5432}` trong compose), không cần touch file committed.

**Bonus discovery: CREATEDB không cần init.sql**

- Plan ban đầu lo `sa_app` không có CREATEDB → cần `docker/postgres/init.sql` cho T-003.
- Khi verify thực tế bằng `docker exec sa-postgres psql -U sa_app -d smart_attendance -c '\l'`:
  - `sa_app` là owner của TẤT CẢ databases (kể cả `template0`, `template1`)
  - → Postgres image cấp **superuser** cho user khai báo qua `POSTGRES_USER` env
  - → CREATEDB có sẵn, T-003 không cần init.sql
- **Update:** `docs/plans/T-002-plan.md` mục "Followup for T-003" rewrite từ "TODO" → "RESOLVED during verification". Trade-off: superuser trong dev OK; production cần tách non-superuser app role (note để hardening sau).

### Cách chỉnh sửa

1. Verify acceptance criteria: ✅ 4/4 (compose up, healthy, psql connect, redis ping)
2. Override `.env` POSTGRES_PORT=5433 (local-only, không commit)
3. Update plan file: rewrite "Followup for T-003"
4. Tạo PR develop ← feature/infra-docker-compose
5. User merge PR → pull develop → cleanup local branch

### Kết quả cuối cùng

- Commit feature: `a7fddc4` — `chore(infra): add docker compose for postgres + redis dev env`
- Merge commit: `bd539bb` — PR #1 merged
- Branch: `feature/infra-docker-compose` (deleted sau merge)
- Test: 4/4 acceptance criteria pass

### Bài học rút ra

- **Verify thực tế > đọc docs:** tài liệu Postgres image không nói rõ user qua `POSTGRES_USER` là superuser. Verify bằng `psql \l` 5 giây tiết kiệm 1 task không cần thiết (init.sql).
- **Đừng hardcode port trong compose committed:** dùng `${VAR:-default}` syntax ngay từ đầu — khi máy dev có conflict (rất thường gặp), chỉ cần override `.env` local.
- **Git Flow strict cho infra task vẫn đáng:** PR #1 cho thấy diff sạch, dễ review, có audit trail. Không tốn thời gian thêm so với commit thẳng develop.

---

<!-- Thêm entry mới ở dưới đây -->

## [#04] T-003 — Prisma schema + init migration + idempotent seed

- **Date:** 2026-04-15 → 2026-04-16
- **Tool:** Claude Code (Sonnet, agent mode)
- **Module:** db / infra
- **Phase:** scaffolding

### Mục tiêu

Wire Prisma 6 vào NestJS (PrismaService + global module), apply schema từ
`docs/erd.md §3` nguyên văn, tạo migration đầu, và viết seed **thật sự
idempotent** (chạy N lần → counts không đổi) cho 3 branches × 30 employees ×
7 ngày data theo `docs/spec.md §12`.

### Prompt

Workflow 3 vòng tiếp tục:

**Vòng 1 — Yêu cầu plan + lưu ý CREATEDB đã resolve:**

```
T-002 đã merge... Bắt đầu T-003 (Prisma + migration + seed)...
1. git checkout -b feature/db-prisma-init develop
2. Lập plan docs/plans/T-003-plan.md...
   - Verify: schema.prisma copy ĐÚNG NGUYÊN VĂN từ docs/erd.md §3
3. KHÔNG exec, KHÔNG cài dep. Reply plan để tôi confirm.
Note: Postgres sa_app đã có CREATEDB superuser (verified T-002), không cần
init.sql.
```

**Vòng 2 — Push back trên 1 trong 10 default + 2 câu hỏi chốt:**

```
9/10 OK. Đổi #5: DÙNG postinstall hook, KHÔNG manual generate.
Q-A: Prisma client output path → giữ default
Q-B: Seed idempotency thực sự → đề xuất deterministic timestamp
```

**Vòng 3 — Approve UUID v5 với 2 refinement:**

```
OK (a+) — approved.
R1. uuid là devDependency (KHÔNG dependency)
R2. Tách seed helpers ra file riêng (orchestrator vs helpers vs data)
SEED_NAMESPACE — generate fresh, KHÔNG dùng UUID từ ví dụ
```

### AI sinh ra

- `prisma/schema.prisma` (395 lines) — verbatim ERD §3, formatted + validated
- `prisma/migrations/20260415171458_init/migration.sql` (420 lines)
- `prisma/seed.ts` (orchestrator, 8 functions tuần tự)
- `prisma/seed/helpers.ts` — SEED_NAMESPACE constant + UUID v5 builders +
  bcrypt + date math
- `prisma/seed/data.ts` — static data (3 branches, 9 departments, 30 employee
  templates, 7-day patterns)
- `apps/api/src/prisma/{prisma.service,prisma.module,index}.ts`
- `package.json` — postinstall + 5 helper scripts + prisma config

### Vấn đề phát hiện khi review

**Insight #1: Idempotency phải sâu hơn "không lỗi"**

- AI ban đầu chỉ propose deterministic timestamp (proposal a)
- Push back: timestamp đơn lẻ không đủ vì `attendance_events` không có
  `@@unique` natural key → upsert vẫn duplicate
- AI tự đề xuất proposal a+: deterministic UUID v5 từ
  `(employeeCode|workDate|type)` → cùng input → cùng UUID → upsert by id =
  true idempotent
- **Lesson:** "idempotent seed" = chạy N lần cho EXACT counts giống nhau,
  không phải "không throw error". Verify bằng count diff trước/sau lần 2.

**Insight #2: Generate fresh SEED_NAMESPACE, không reuse từ examples**

- AI propose dùng UUID `6f1f8c9c-1234-5678-9abc-def012345678` từ comment ví dụ
- Push back: dùng UUID này → mọi project copy code đều cùng namespace →
  collision risk nếu dev import thư viện hoặc data từ project khác
- AI generate fresh: `1e26cc03-4675-471c-ad34-63f88e1e5d19` qua
  `node -e "console.log(crypto.randomUUID())"`
- Comment trong code: "DO NOT CHANGE — changes break seed idempotency
  across all dev machines"

**Insight #3: postinstall hook > manual generate cho team**

- AI đề xuất manual generate ban đầu (đơn giản hơn, không có magic)
- Push back: manual = drift type giữa schema vs client = bug khó debug
  trong team/CI
- AI accept, thêm `"postinstall": "prisma generate"` vào scripts
- Trade-off chấp nhận: pnpm install chậm hơn ~5s, đổi lại fresh client
  mọi lúc

**Insight #4 (bonus): T-002 followup được resolve trong T-002 → tiết kiệm task**

- Plan T-002 cảnh báo cần `init.sql` cho CREATEDB
- Verify thực tế trong T-002 phát hiện POSTGRES_USER bootstrap được cấp
  superuser → có sẵn CREATEDB
- T-003 không cần touch docker config → ít file hơn, ít risk hơn

### Cách chỉnh sửa

1. Confirm verify: `prisma migrate dev --name init` ✅, app start ✅
2. Verify idempotency: chạy `pnpm prisma db seed` 2 lần → counts identical
   (210 sessions, 394 events, 31 users)
3. Verify bcrypt: psql query — 3 hashes prefix `$2b$`, length 60
4. Verify schema match: `grep "^model |^enum"` → 27 (= ERD §3)
5. Tạo PR develop ← feature/db-prisma-init

### Kết quả cuối cùng

- Commit: `259575d` — `feat(db): add prisma schema, init migration, idempotent seed`
- Merge: `6a0378e` — PR #2 merged
- Branch deleted local + remote
- Test: 5/5 acceptance criteria pass + idempotency verified

### Bài học rút ra

- **"Idempotent" có nghĩa rõ: same input → same state**, không phải "không
  throw". Verify bằng diff counts, không phải bằng exit code.
- **UUID v5 namespace must be fresh và document rõ là không-được-đổi**
  trong code comment. Reuse namespace từ ví dụ = bom hẹn giờ.
- **Workflow 3 vòng tiếp tục hiệu quả:** 3 push back trong T-003 đều thay
  đổi quyết định AI — chứng minh không phải "rubber stamp".
- **Verify thực tế trong task trước có thể loại bỏ task sau:** init.sql
  defer từ T-002 → resolved → không cần làm trong T-003.

---

<!-- Thêm entry mới ở dưới đây -->

## [#05] T-004 — Git Flow tooling (commitlint + husky + lint-staged + CI)

- **Date:** 2026-04-16
- **Tool:** Claude Code (Sonnet, agent mode)
- **Module:** infra / ci
- **Phase:** scaffolding

### Mục tiêu

Enforce Conventional Commits + auto-format trên mọi commit, setup GitHub
Actions CI chạy lint/test/build trên PR. Mục tiêu phụ: ăn điểm "Git Flow
& Docker 15%" của đề bài.

### Prompt

**Vòng 1:** Lập plan theo workflow chuẩn 3 vòng đã thiết lập từ T-001.

**Vòng 2 — Push back trên scope enum:**

```
Approve Option A cho 1, 3, 4, 5, 6, 7, 8, 9.
Quyết định #2 → chọn (ii): Strict scope enum, KHÔNG có "test" trong enum.
Lý do: "test" là một TYPE trong conventional commits, thêm vào scope tạo
ambiguity. Update docs/tasks.md T-004 acceptance: feat(test) → feat(infra).
```

**Vòng 3 — AI catch lỗi của user (rất hay):**

```
[AI nhắc] Bạn propose 13 scopes nhưng bỏ "prompt-log" mà bạn đã dùng 3 lần
trong git log. Nếu enum không có → docs(prompt-log): ... sẽ FAIL.
Cũng nên thêm api/portal/mobile/shared cho Nx convention.
Đề xuất 18 scopes total.
```

**Vòng 4 — User accept:**

```
Chọn (A) — 18 scopes. Bạn bắt đúng lỗi của tôi.
Convention rule cho dev khi pick scope (priority order, document trong
commitlint.config.js header comment):
1. Module nghiệp vụ (auth/branches/...) → ưu tiên
2. Nx layer (api/portal/mobile/shared) → khi cross-module trong 1 layer
3. Cross-project → infra/ci/deps
4. PROMPT_LOG → prompt-log
5. Other docs → docs
```

### AI sinh ra

- `.husky/{commit-msg,pre-commit}` (minimal, npx --no-install pattern)
- `commitlint.config.js` — 18-scope enum + convention rule comment + tắt
  subject-case (cho tiếng Việt dấu) + tắt body/footer-max-line
- `.lintstagedrc.json` — eslint --fix + prettier --write per file type
- `.github/PULL_REQUEST_TEMPLATE.md` — summary/changes/test plan/checklist
- `.github/workflows/ci.yml` — postgres+redis services, draft skip,
  concurrency cancel, prisma migrate deploy, parallel lint/test/build
- `package.json` — `"prepare": "husky"` + 4 devDeps pinned

### Vấn đề phát hiện khi review

**Insight #1: AI catch lỗi user (role reversal hữu ích)**

- User propose 13 scopes nhưng quên scope đã dùng thực tế 3 lần
  (`prompt-log`)
- AI grep git log, phát hiện inconsistency, đề xuất bổ sung
- → **Lesson:** không phải lúc nào user cũng đúng. AI có context (git log)
  mà user không nhớ → push back hữu ích cả 2 chiều.

**Insight #2: "test" trong scope enum tạo ambiguity với conventional type**

- AI initial propose `test` trong scope enum (acceptance example dùng
  `feat(test): hello`)
- User push back: `test` đã là conventional type → `test(test): foo` đọc
  rất confusing
- Resolution: rewrite docs/tasks.md acceptance, không thêm `test` vào enum
- → **Lesson:** Đặt tên scope phải tránh xung đột với type list của
  conventional commits.

**Insight #3: CI credentials phải tách bạch dev/CI**

- Plan ban đầu định reuse `change_me_local_dev` từ `.env.example` cho CI
- Refinement: CI dùng `ci_test_pw` riêng — tránh dev creds leak vào CI
  logs, và tránh copy-paste CI creds vào dev local
- Document divergence trong T-004-plan.md

**Insight #4: Hooks verify thật, không chỉ "không error"**

- Test sequence: bad commit MUST fail → good commit MUST pass → reset
- Verify lint-staged thực sự format file khi commit (chứng cứ trong
  output: "8 files formatted")
- actionlint qua Docker validate YAML không cần install local

### Cách chỉnh sửa

1. Test bad commit `git commit --allow-empty -m "test bad format"` → reject ✅
2. Test good commit `feat(infra): hello commitlint` → pass ✅, sau đó reset
3. actionlint Docker validate ci.yml → exit 0 ✅
4. PR #3 mở → CI workflow chạy lần đầu trên GitHub → pass ✅
5. User merge PR

### Kết quả cuối cùng

- Commit: `897cbe7` — `chore(infra): add commitlint, husky, lint-staged, PR template, CI`
- Merge: `2bcb61d` — PR #3
- Branch deleted local + remote
- CI pass lần đầu trên GitHub Actions
- Test: 5/5 acceptance criteria pass

### Bài học rút ra

- **AI có thể catch lỗi user khi có context user không nhớ** (vd: git log
  history). 3-vòng workflow nên cho phép AI push back 2 chiều.
- **Scope enum design:** tránh trùng tên với conventional commit types
  (test/fix/chore/docs/feat/style/refactor/perf/build/ci/revert).
- **CI credentials phải tách bạch dev/staging/prod/CI** — không reuse,
  ngay từ MVP.
- **Verify hooks bằng test thật**, không chỉ check file tồn tại. Bad case
  - good case + reset.
- **Ngày 1 hoàn tất:** T-001 → T-004. Foundation sẵn sàng cho ngày 2 (auth
  - branches + employees + trust score + attendance core).

---

<!-- Thêm entry mới ở dưới đây -->

## [#06] T-005 — Auth module (JWT + RBAC + refresh rotation + rate limit)

- **Date:** 2026-04-16
- **Tool:** Claude Code (Sonnet, agent mode)
- **Module:** auth
- **Phase:** feature (task lớn nhất ngày 2)

### Mục tiêu

4 endpoints (login/refresh/logout/me) với JWT access+refresh, RBAC 3 role, refresh rotation atomic + replay detection, rate limit, Joi env validation, > 80% test coverage. Tạo nền tảng `libs/api/common` (Prisma + interceptor + filter) cho T-006/T-007 reuse.

### Prompt

Workflow 3 vòng tiếp tục, lần này prompt vòng 1 dài & chi tiết hơn vì task lớn (10 quyết định cần xác nhận + 4 ràng buộc bảo mật).

**Vòng 1 — Pre-work + plan + 10 decisions:**

```
Bắt đầu T-005 (Auth module — task lớn nhất ngày 2). Workflow chuẩn 3 vòng.
PRE-WORK: verify state hiện tại (libs/api/ chưa có, PrismaModule global,
bcrypt 6.0.0 đã cài, 3 test accounts từ T-003 seed).
Lập plan với 10 quyết định: lib structure, deps, endpoints, JWT config,
refresh storage (DB vs Redis), guards & decorators, rate limit, DTO,
unit tests scope, etc.
Đặc biệt cẩn thận: refresh rotation atomic ($transaction), JWT secret
strength check ≥32 char, no password_hash leak, no user enumeration.
```

**Vòng 2 — 3 confirm + 3 refinements:**

```
C1. Schema refresh_tokens: id (jti), userId cascade, expiresAt, revokedAt,
    replacedBy, ipAddress, userAgent. INDEX (userId, revokedAt).
C2. Side effects login: lastLoginAt + audit_log.action='login' trong cùng
    $transaction với create refresh_token.
C3. JWT secret strength check timing: Joi schema trong ConfigModule (NestJS
    standard, fail at boot).
R1. libs/api/common phải có sẵn types + DTO chung cho T-006 reuse.
R2. Throttler config tách ra libs/shared/constants/rate-limits.ts.
R3. Test naming "should <expected> when <condition>" (CLAUDE.md §4.6).
```

### AI sinh ra

- **`libs/api/auth`** (12 files): module + service + controller + jwt strategy + guards + decorators + 2 DTO + 2 spec (16 tests)
- **`libs/api/common`** (9 files): PrismaService (moved), ResponseTransformInterceptor, HttpExceptionFilter, BusinessException, ErrorCode enum, PaginationDto, types
- **`apps/api/src/app/env.validation.ts`** — Joi schema validate DATABASE*URL, JWT*\* ≥32 char, TTL regex
- **Migration** `add_refresh_tokens` — RefreshToken model với index (userId, revokedAt)
- **`libs/shared/constants/rate-limits.ts`** — RATE_LIMITS.LOGIN
- 16 unit tests pass, smoke 3/3 pass

### Vấn đề phát hiện khi review

**Insight #1: AI tự đề xuất security pattern OAuth2-grade**

- Vòng 1 plan đã tự include refresh rotation + replay detection (revoke ALL user's tokens khi replay)
- AI không cần được nhắc — proactive vì prompt nhấn mạnh "đặc biệt cẩn thận về bảo mật"
- **Lesson:** "đặc biệt cẩn thận" trong prompt giúp AI surface best practice ngay từ design

**Insight #2: CI fail vì stale Nx-generated test (Local cache hide failure)**

- Sau commit `2c8b97d`, CI fail với:
  > apps/api/src/app/app.controller.spec.ts: TS2339 Property 'getData' does not exist on type 'AppController'
- Root cause: T-005 đổi `getData()` → `getHealth()` trong controller, nhưng spec file Nx-generated từ T-001 vẫn ref `getData()`
- Local `pnpm nx test api` PASS vì Nx cache cũ — chỉ test các spec đã thay đổi, không re-test stale spec
- CI fresh cache → catch ngay
- **Resolution:** commit `5f788bd` fix spec để dùng `getHealth()`
- **Lesson critical:** trước commit task lớn, CHẠY `pnpm nx reset && pnpm nx run-many --target=test --all` để force fresh run. Hoặc tin CI là source of truth.

**Insight #3: @nestjs/jwt v11 type strictness cho expiresIn**

- @nestjs/jwt v11 dùng `ms` library `StringValue` template literal type cho `expiresIn`
- Env trả `string` thường, không tự inferable
- AI dùng cast `as unknown as number` (3 chỗ) — runtime work, type không verify
- AI flag rõ trong commit message + đề xuất defer refactor sang helper
- **Lesson:** không phải mọi type warning đều cần fix ngay. Cast với comment + defer là acceptable khi library API churn.

**Insight #4: 36 files được lint-staged auto-format khi commit**

- Lần đầu commit task lớn sau khi setup commitlint + lint-staged (T-004)
- 36 TS files (Nx-generated + new) được prettier format auto
- Không có conflict, không rollback — workflow setup đúng
- **Lesson:** đầu tư T-004 (Git Flow tooling) đã trả công ngay tại T-005.

### Cách chỉnh sửa

1. Verify nx test auth + common pass local
2. Smoke 3 cases với curl thật (login success/fail/rate limit)
3. Commit `2c8b97d` (36 files tự format qua lint-staged)
4. Push → PR #4 → CI fail → fix stale spec (commit `5f788bd`) → CI pass
5. User merge → cleanup branch

### Kết quả cuối cùng

- Commits:
  - `2c8b97d` — `feat(auth): add JWT auth + RBAC + refresh rotation + rate limit`
  - `5f788bd` — `fix(api): update stale app controller spec for getHealth rename`
- Merge: `2d7ef5c` — PR #4
- Branch deleted local + remote
- Test: 16/16 unit + 3/3 smoke + CI pass
- Coverage: > 80% cho libs/api/auth

### Bài học rút ra

- **Nx cache local có thể HIDE test failures mà CI sẽ catch.** Trước commit task lớn → `pnpm nx reset && pnpm nx run-many --target=test --all`. Hoặc tin CI là first source of truth.
- **AI tự đề xuất OAuth2 best practice** khi prompt nhấn "đặc biệt cẩn thận về bảo mật" — không cần chỉ định từng pattern.
- **Library type churn (như @nestjs/jwt v11 `ms` types):** cast với comment + defer refactor là acceptable, không cần fix ngay.
- **T-004 investment paid off ngay tại T-005** — 36 files auto-formatted qua lint-staged, không conflict.
- **Refresh rotation atomic + replay detection = revoke all** là pattern bắt buộc cho production-grade auth, dù MVP cũng nên dùng (cost thấp, benefit lớn cho điểm "thương mại hóa được").

---

<!-- Thêm entry mới ở dưới đây -->

## [#07] T-006 — Branches CRUD + WiFi/Geofence + Manager Scope + Audit

- **Date:** 2026-04-16
- **Tool:** Claude Code (Sonnet, agent mode)
- **Module:** branches
- **Phase:** feature

### Mục tiêu

10 endpoints CRUD branches + sub-resource wifi-configs/geofences, manager scope (own branches only), soft delete với 409 khi còn employee active, audit log atomic, tái sử dụng tối đa infra từ T-005.

### Prompt

Workflow 3 vòng nhưng rút gọn hơn T-005 vì pattern đã established.

**Vòng 1 — Pre-work + plan + 10 decisions:**

```
Bắt đầu T-006 (Branches CRUD). Workflow chuẩn 3 vòng.
PRE-WORK: verify state sau T-005 (libs/api/common đã có Prisma/interceptor/
filter/errors, libs/api/auth đã có guards/decorators — REUSE hết).
Lập plan với 10 quyết định: lib structure (gộp hay tách 3 services?),
manager scope (helper vs guard), soft delete cascade?, AuditLogService
placement, validation messages language, sort default, /restore endpoint,
search pattern, geofence overlap check, check-in radius source.
Lessons learned từ T-005: pnpm nx reset trước test cuối, naming convention,
cast+comment+defer pattern.
```

**Vòng 2 — Push back trên AuditLogService placement:**

```
Approve 10/10 + 3 extras.
Open question — AuditLogService placement: KHÔNG bỏ vào PrismaModule.
PrismaModule là infrastructure, không nên chứa business logic.
Đề xuất: Add vào libs/api/common's CommonModule (cùng cấp PrismaService).
R1. AuditLogService API design: cần 2 method — .log() và
    .logInTransaction(tx, input) — version tx BẮT BUỘC cho atomic op.
```

### AI sinh ra

- **`libs/api/branches`**: 1 module + 3 controllers + 3 services + scope helper + 5 DTOs + 1 spec (11 tests)
- **`libs/api/common` additions**:
  - `AuditLogService` — `.log()` + `.logInTransaction(tx, input)` với TxClient type chính xác (Omit PrismaClient với các `$*` method)
  - `pagination.util.ts` — `buildPaginationMeta()`
  - **Merged PrismaModule → CommonModule @Global()** (single source of global providers)
  - BREAKING: `PaginationMeta.totalPages` → `total_pages` (snake_case match api-spec §1.3)
- **`ErrorCode.BRANCH_HAS_ACTIVE_EMPLOYEES`**
- Dep `+@nestjs/mapped-types@2.1.1` cho `PartialType(CreateBranchDto)`
- 11 unit tests pass, 7/7 smoke pass

### Vấn đề phát hiện khi review

**Insight #1: AI propose design lệch — user kéo lại**

- Vòng 2 AI lean "put AuditLogService in PrismaModule"
- Push back: PrismaModule là infrastructure (connection lifecycle), không nên chứa business logic
- Resolution: gộp vào CommonModule (đã @Global) — PrismaService + AuditLogService cùng provider pool
- **Lesson:** separation of concerns quan trọng hơn "least modules". Business service không ở module infrastructure.

**Insight #2: AI tự propose tx variant chính xác**

- R1 refinement đặt ra: cần `.logInTransaction(tx, input)` version
- AI implement với type `TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>` — chính xác kiểu tx internal của Prisma
- **Lesson:** prompt đề cập `$transaction` pattern → AI hiểu đúng type implication của tx argument.

**Insight #3: AI tự flag latent bug**

- `getManagerBranchIds` không filter `effective_from <= today`
- Seed không có future-dated assignment → bug latent, không fail test
- AI tự flag trong commit message ("Known gap, non-blocking")
- **Lesson:** AI có thể self-audit nếu prompt yêu cầu "known issues" explicit.

**Insight #4: DeepMockProxy + Prisma $transaction overload**

- jest-mock-extended không mock cleanly được `$transaction(async (tx) => ...)` overload — tx argument undefined trong vài assertion
- AI workaround: check `mock.calls[0][1]` thay vì `toHaveBeenCalledWith(anything, matcher)`
- Production path không ảnh hưởng, flag rõ
- **Lesson:** mocking library có limitation — workaround + document là acceptable.

**Insight #5: Commitlint warning `footer-leading-blank` non-blocking**

- Footer "Refs: docs/tasks.md T-006" sát body → warning level 1
- Không fail commit
- **Lesson:** hiểu 3 level commitlint (0/1/2) để tune strictness đúng tốc độ team.

### Cách chỉnh sửa

1. `pnpm nx reset && nx run-many --target=test --all` trước commit (T-005 lesson applied)
2. Smoke 7 scenarios (admin/manager/employee + BSSID valid/invalid + cascade-block + create)
3. Verify audit_logs entries
4. Commit `13015fb` — 33 files auto-formatted qua lint-staged
5. PR #5 → CI pass → user merge

### Kết quả cuối cùng

- Commit: `13015fb` — `feat(branches): add CRUD + WiFi/Geofence config + manager scope + audit`
- Merge: `1d31592` — PR #5
- Test: 11/11 unit + 7/7 smoke + CI pass
- Pattern established cho T-007 reuse: split services, scope helper, AuditLogService tx variant, soft delete, DTO với PartialType

### Bài học rút ra

- **Separation of concerns module design:** business service không ở module infrastructure.
- **AI self-audit khả thi** khi prompt yêu cầu "known issues" explicit.
- **Pattern reuse accelerates velocity:** T-006 ít push back hơn T-005 vì libs/api/common đã có template.
- **Mocking library edge case** (DeepMockProxy + $transaction) — workaround + doc là acceptable.
- **Commitlint level 0/1/2:** hiểu rõ để tune strictness.

---

<!-- Thêm entry mới ở dưới đây -->

## [#08] <Next: T-007 Employees CRUD>

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
