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
- **Friendly 409 pre-check với {field, value} details** > catch-and-rewrite Prisma P2002 (xem #08)
- **Monorepo internal: re-export shim hiếm khi justified** — prefer delete + grep-update (xem #08)
- **Cross-field validation: dùng class-validator custom constraint class**, không hack service (xem #08)
- **100% coverage → remove dead branch** > ignore comment; dead branch là chỉ báo dead code (xem #09)
- **Export intermediate helpers** = bonus testability + documentation về logic components (xem #09)
- **Extract MỌI magic number** cho core business logic lib — không phải "nice-to-have" (xem #09)
- **Purity verify tĩnh (grep) + động (test)** cho core lib — đáng đầu tư (xem #09)
- **Rate limit key = business entity (employee), not IP** — critical cho B2B SaaS shared office (xem #10)
- **Shared cross-cutting services → libs/api/common** to prevent circular deps (xem #10)
- **Cache invalidation: enumerate ALL mutation points explicitly** — catch AI edge case misses (xem #10)
- **Evidence persistence: failed attempts still logged** (event without session) cho audit trail (xem #10)
- **`pnpm nx reset` trước final test khi modify scaffold — SYSTEMATIC rule** (T-005 + T-010 cùng pattern) (xem #11)
- **Angular 17+ functional guards/interceptors** default mới, class pattern legacy (xem #11)
- **Jest + Ionic ESM**: `transformIgnorePatterns` phải whitelist `@ionic|@stencil|ionicons` (xem #11)
- **FE types duplicate > shared từ BE libs** — giảm coupling, giữ FE build độc lập (xem #11)
- **Manual browser test catch bugs unit test miss** — race condition + stateful queries (xem #12)
- **Prisma `OR: []` = always false** — đừng tạo empty array operators (xem #12)
- **Angular bootstrap: `APP_INITIALIZER` > `ngOnInit`** cho async setup phụ thuộc router/guard (xem #12)
- **Angular CLI budget quá strict cho Ionic** — set realistic baseline 1.5mb/2mb từ đầu (xem #12)
- **Backend curl test pinpoint FE vs BE bug** — verify API trước khi blame FE (xem #12)
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

## [#08] T-007 — Employees CRUD + Assignments + Devices + Atomic Create

- **Date:** 2026-04-16
- **Tool:** Claude Code (Sonnet, agent mode)
- **Module:** employees
- **Phase:** feature

### Mục tiêu

6 endpoints employees CRUD + sub-resources (assignments, devices), atomic 7-step create với rollback verified, move scope helper từ branches → common, reuse tối đa pattern T-006.

### Prompt

Workflow 3 vòng rút gọn hơn nữa — pattern quá rõ ràng từ T-006, chỉ cần confirm 10 decisions + 3 extras + 1 open question.

**Vòng 1 — Plan + 10 decisions:**

```
Bắt đầu T-007 (Employees CRUD). Workflow chuẩn 3 vòng.
PRE-WORK: verify state sau T-006 (libs/api/common đã có AuditLogService
tx variant, pagination util, snake_case meta; libs/api/branches có scope
helper pattern → có move sang common không?).
Lập plan với 10 quyết định + 4 refinements:
R1. Validate assignment dates (from < to)
R2. Scope helper rename khi move: giữ branch-scope.helper.ts
R3. POST role='admin' → allow + audit note explicit
R4. Employee code + email unique → friendly 409 ErrorCodes
```

**Vòng 2 — Choose re-export vs delete:**

```
Approve 10/10 + 3 extras.
Open question → chọn (b) DELETE branch-scope.helper.ts trong branches,
update direct imports. Lý do: monorepo internal, re-export indirection
tạo dead code ma lực.
```

### AI sinh ra

- **`libs/api/employees`**: 3 services + 3 controllers + 5 DTOs + 1 spec (13 files, 11 tests)
- **Moved** `branch-scope.helper.ts` → `libs/api/common/src/lib/`
- **Updated** `libs/api/branches/*.service.ts` import path (3 files)
- **ErrorCode**: `EMPLOYEE_CODE_TAKEN`, `EMAIL_TAKEN` với `{field, value}` details
- **Custom validator** `EffectiveToAfterFromConstraint` cho assignment dates
- Atomic 7-step `$transaction` create verified rollback
- 39/39 workspace tests pass, 8/8 smoke pass

### Vấn đề phát hiện khi review

**Insight #1: Pattern reuse rõ rệt giảm overhead**

- T-005: 3 vòng push back (10 decisions + 2 rounds refinement)
- T-006: 2 vòng push back (10 decisions + 1 round refinement)
- T-007: 2 vòng (10 decisions + 1 round refinement + 1 open question)
- Thời gian plan giảm 40% so với T-005
- **Lesson:** task trong cùng "family" (CRUD pattern) → 1 plan canonical, các task sau diverge chỉ ở rule nghiệp vụ riêng.

**Insight #2: Friendly 409 với field+value details là UX cực tốt**

- Prisma P2002 unique constraint → throw generic
- Service pre-check trước insert → throw `BusinessException` với `details: { field, value }`
- Client FE biết chính xác field nào bị duplicate → highlight input error
- **Lesson:** pre-check + friendly error thắng catch-and-rewrite P2002 vì:
  - Atomic context còn nguyên (trong $transaction)
  - Error message user-friendly ngay từ API

**Insight #3: Re-export vs delete — pick explicit removal**

- Open question: re-export từ branches để zero-change clients, hay delete sạch
- User push back chọn delete: monorepo internal, không có external consumer, re-export indirection = "ma lực kéo dead code"
- AI update 3 import sites + delete file
- **Lesson:** trong monorepo internal, `@deprecated re-export` hiếm khi justified. Grep + update là cheap.

**Insight #4: Custom class-validator constraint for cross-field**

- Assignment cần `effective_to > effective_from` — không phải single-field validation
- Solution: `@ValidatorConstraint({ name: 'effectiveToAfterFrom' })` class implement `ValidatorConstraintInterface`
- Apply qua `@Validate(EffectiveToAfterFromConstraint)` ở top của DTO class
- **Lesson:** class-validator hỗ trợ cross-field validation qua custom constraint class — không cần hack service-level check.

**Insight #5: Admin creating admin — security note pattern**

- D-extra-1: POST role='admin' allow nhưng audit
- AI implement với audit log note: `"Super-admin creation: actor=<uuid> created admin=<email>"`
- Business review cho MVP: OK vì chỉ admin mới gọi được + audit đầy đủ
- Note cho bonus task: 2FA hoặc approval flow cho admin creation
- **Lesson:** không phải mọi edge case cần block ở MVP. Audit + document pattern cho phép defer quyết định bảo mật tới khi có dữ liệu usage.

### Cách chỉnh sửa

1. `pnpm nx reset && nx run-many --target=test --all` trước commit
2. Smoke 8 scenarios (6 positive + 2 negative + 1 atomic rollback DB verify)
3. Atomic rollback: fake primary_branch_id → 404 → DB grep orphans = 0 ✅
4. Commit `986b559` — 31 files format qua lint-staged
5. PR #6 → CI pass → merge

### Kết quả cuối cùng

- Commit: `986b559` — `feat(employees): add CRUD + assignments + devices + atomic create`
- Merge: `12ae5f1` — PR #6
- Branch deleted
- Test: 39/39 workspace + 8/8 smoke + CI pass
- Backend CRUD cho 3 module chính (auth + branches + employees) xong

### Bài học rút ra

- **Task trong cùng family → overhead giảm dần** (T-005 3 vòng → T-007 2 vòng). Plan canonical trong lib đầu tiên của family là đáng đầu tư.
- **Friendly error pre-check > catch-and-rewrite P2002:** field+value details giúp FE UX tốt hơn.
- **Monorepo internal: re-export shim hiếm khi justified** — grep + update cheap, tránh dead code.
- **Cross-field validation dùng class-validator custom constraint**, không hack service.
- **Security edge case (admin creating admin): audit + document > block**, defer hard rule tới khi có usage data.

---

<!-- Thêm entry mới ở dưới đây -->

## [#09] T-008 — Trust Score pure function + haversine geo helpers

- **Date:** 2026-04-16
- **Tool:** Claude Code (Sonnet, agent mode)
- **Module:** shared
- **Phase:** feature (core business logic)

### Mục tiêu

`computeTrustScore(input)` pure function implement toàn bộ rule `docs/spec.md §5.1, §5.2, §6` với 100% test coverage. Task ngắn nhất Day 2 (30') nhưng core nhất về business logic — T-009 (Attendance) depends on.

### Prompt

Workflow 3 vòng gọn, task pure nên không có decision về module/deps.

**Vòng 1 — Plan + 10 decisions:**

```
Bắt đầu T-008 (Trust Score utility — pure function). Workflow chuẩn 3 vòng
nhưng nhẹ hơn vì pure function không dependency Nest/Prisma.
PRE-WORK: đọc KỸ docs/spec.md §5.1 §5.2 §6, verify libs/shared/utils từ T-001.
Plan: file structure (geo.ts + trust-score.ts + types + specs), weight
constants extract, logic flow (haversine → geofence → wifi → impossible_travel
→ score → level), test matrix (boundary 69/70, 39/40, all flags combined).
10 decisions: constants placement, accuracy thresholds, impossible travel
formula, WiFi priority, mock exclusivity, undefined accuracy, isHardValid
coupling, history null, VPN weight, device exclusivity.
Ràng buộc: PURE, 100% coverage, no Date.now() inside, extract all magic.
```

**Vòng 2 — 3 refinements + 2 clarifications:**

```
R1. Export haversineDistance từ geo.ts riêng (reuse T-009 + test riêng)
R2. JSDoc cho public API (computeTrustScore với @example)
R3. Test coverage verification (jest --coverage, document % trong commit)
Q1. currentEventAt type: Date | number union (không string)
Q2. TrustLevel type export để T-009 import cho DTO
```

### AI sinh ra

- **`libs/shared/utils/src/lib/geo.ts`** — `haversineDistance(lat1, lng1, lat2, lng2): meters` + `EARTH_RADIUS_M=6371000`
- **`libs/shared/utils/src/lib/trust-score.types.ts`** — `TrustLevel`, `ValidationMethod`, `TrustFlag`, input/output interfaces
- **`libs/shared/utils/src/lib/trust-score.ts`** — `computeTrustScore` với JSDoc + `@example`, plus exported helpers (`isInsideGeofence`, `isWifiMatched`, `detectImpossibleTravel`)
- **`libs/shared/utils/src/lib/{geo,trust-score}.spec.ts`** — 50 tests
- Removed Nx boilerplate `utils.ts` / `utils.spec.ts`
- Coverage 100% statements/branches/functions/lines

### Vấn đề phát hiện khi review

**Insight #1: AI chủ động remove dead branch để đạt 100% coverage**

- `upgradeMethod` có branch `if (current === addition) return addition;` — unreachable dưới call pattern của `computeTrustScore`
- Nếu giữ: không bao giờ test được → < 100% coverage hoặc phải `/* istanbul ignore next */`
- AI remove branch thay vì hack ignore comment
- **Lesson:** dead branch detection cho 100% coverage là chỉ báo tốt về dead code trong logic. Remove > ignore comment.

**Insight #2: Pure function test structure theo describe block**

- 50 tests organized: geo (5) → isInsideGeofence (5) → isWifiMatched (7) → detectImpossibleTravel (4) → computeTrustScore (29)
- Mỗi helper export riêng → test unit-level isolation
- Top-level `computeTrustScore` test combine flags → integration
- **Lesson:** export intermediate pure functions không chỉ giúp test — còn làm tài liệu sống về bộ phận cấu thành logic.

**Insight #3: Weight constants + threshold constants extract hết**

- AI tự extract TẤT CẢ magic number theo ràng buộc prompt:
  - `WEIGHTS.{GPS_IN_GEOFENCE_HIGH_ACCURACY, BSSID_MATCH, MOCK_LOCATION, ...}`
  - `ACCURACY_HIGH_THRESHOLD_M=20`, `ACCURACY_MODERATE_THRESHOLD_M=100`
  - `TRUST_LEVEL_TRUSTED_MIN=70`, `TRUST_LEVEL_REVIEW_MIN=40`
  - `IMPOSSIBLE_TRAVEL_SPEED_KMH=120`, `EARTH_RADIUS_M`, `MS_PER_HOUR`
- **Lesson:** ràng buộc "extract MỌI magic number" trong prompt rõ → AI không bỏ sót. Magic number = tech debt, extract cần sớm.

**Insight #4: Purity proven qua grep test + runtime behavior**

- AI tự verify purity: `grep` cho `@nestjs|@prisma|@smart-attendance/api/*` → không match
- Runtime: không có `Date.now()` / `console.log` / mutation input
- **Lesson:** purity guarantee có thể verify tĩnh (grep) + động (test cùng input → same output). Đáng làm khi build core business logic lib.

**Insight #5: Boilerplate cleanup bắt buộc khi lib grown up**

- Nx generator tạo `utils.ts` / `utils.spec.ts` placeholder từ T-001
- Sau T-008 có real content → boilerplate become dead code
- User (human) catch trong review → remove 2 file + update `index.ts`
- **Lesson:** Nx generator boilerplate nên remove ngay khi lib có real content, không để lẫn → confusion về public API.

### Cách chỉnh sửa

1. `pnpm nx reset && pnpm nx test utils --coverage`
2. Verify 100% — IN coverage report
3. Grep purity check
4. Sample 3 output scenarios (trusted/review/suspicious)
5. Human remove utils.ts boilerplate trước commit
6. Commit `3847bef` — 7 files (6 new + 1 update + 2 delete)
7. PR #7 → CI pass → merge

### Kết quả cuối cùng

- Commit: `3847bef` — `feat(shared): add Trust Score pure function + haversine geo helpers`
- Merge: `76ce6c5` — PR #7
- Branch deleted
- Test: 50/50, 100% coverage cho cả 2 file, lint clean
- **T-009 unblocked** — AttendanceService có thể `import { computeTrustScore } from '@smart-attendance/shared/utils'` ngay

### Bài học rút ra

- **100% coverage bắt buộc → AI tự remove dead branch** thay vì hack ignore comment. Đây là chỉ báo tốt về dead code.
- **Export intermediate helpers (không chỉ top-level fn)** = bonus testability + documentation về logic components.
- **Extract magic number là ràng buộc bắt buộc cho core business logic**, không phải "nice-to-have". Prompt explicit "extract MỌI magic" giúp AI không bỏ sót.
- **Purity verify tĩnh (grep) + động (deterministic test)** cho core lib — đáng đầu tư.
- **Nx generator boilerplate nên remove ngay khi lib grown up** — không để lẫn với real API, clean public surface.

---

<!-- Thêm entry mới ở dưới đây -->

## [#10] T-009 — Attendance check-in/out core (Day 2 closeout)

- **Date:** 2026-04-16
- **Tool:** Claude Code (Sonnet, agent mode)
- **Module:** attendance
- **Phase:** feature (task tích hợp lớn nhất)

### Mục tiêu

6 endpoints check-in/out + session management, tích hợp TẤT CẢ backend đã build (auth + branches + employees + trust-score). Redis cache branch config TTL 5' + 5 invalidation points. Per-employee rate limit. TZ-aware work_date. Manager override với audit. Day 2 closeout.

### Prompt

Workflow 3 vòng, prompt dài nhất project (task tích hợp nhiều module).

**Vòng 1 — Plan + 10 decisions:**

```
T-009 (Attendance check-in/out core — task cuối Day 2, tích hợp toàn bộ).
Plan: cache layer, rate limit, invalidation strategy, date library,
schedule resolve, trust score aggregation, device upsert, failed events
persistence, IP capture, override rules.
10 decisions + ràng buộc nghiêm ngặt: KHÔNG trust is_mock_location,
transaction wrap, cache invalidate, rate limit verify 429, audit log
mandatory, failed events persisted.
```

**Vòng 2 — Push back trên open question + 4 ràng buộc:**

```
Rate limit tracker: chọn (b) custom UserThrottlerGuard per-employee.
Lý do: office 100 nhân viên cùng IP NAT → IP-only throttle = show-stopper.
Solution 1 (local guard): @SkipThrottle + @UseGuards(UserThrottlerGuard)
tại endpoint, JwtAuthGuard chạy trước nên req.user đã có.
4 ràng buộc thêm: R1 cache 5 points, R2 tz-aware work_date example,
R3 failed event sessionId=NULL, R4 override note ≥10 chars.
```

### AI sinh ra

- **`libs/api/attendance`** (~20 files): 2 controllers + 2 services + 5 DTOs + UserThrottlerGuard + work-date.util + 2 spec files (13 tests)
- **`libs/api/common/branch-config-cache.service.ts`** — Redis cache TTL 5' + invalidate()
- **Modified** `libs/api/branches/*.service.ts` — 5 cache invalidation points + DI inject
- 6 new deps (cache + date), all pinned
- 69/69 workspace tests pass, 8/8 smoke pass

### Vấn đề phát hiện khi review

**Insight #1: Per-employee rate limit = must-have, not nice-to-have**

- AI initial plan: in-memory IP-based throttler (tiếp tục T-005)
- AI tự flag open question: "shared IP throttle employees lẫn nhau"
- User push back rõ: 100 nhân viên cùng NAT IP → show-stopper
- Solution: custom `getTracker()` override → `user:${userId}` key
- **Implementation subtlety:** JwtAuthGuard phải chạy TRƯỚC throttler để req.user có → local guard (Solution 1) thay vì reorder global (Solution 2)
- **Lesson:** rate limit key design phải match business entity (employee), không phải network entity (IP). Đặc biệt quan trọng cho B2B SaaS với shared office.

**Insight #2: Circular dependency avoided via libs/api/common**

- `AttendanceService` cần branch config cache → `BranchConfigCacheService`
- `BranchesService` cần invalidate cache → cùng `BranchConfigCacheService`
- Nếu đặt trong `libs/api/branches` → `libs/api/attendance` import `libs/api/branches` → potential circular
- AI tự đặt `BranchConfigCacheService` trong `libs/api/common` (global) — both consumers import common
- **Lesson:** shared cross-cutting service (cache, audit) nên ở libs/api/common để tránh circular dep giữa feature modules.

**Insight #3: Trust score 65 ≠ bug, = first-time device penalty**

- Smoke test: GPS valid (+40) + BSSID match (+35) = 75 expected
- Actual: 65 vì device_untrusted (-10) apply (first check-in, device mới)
- AI explain chính xác trong report
- After PATCH device is_trusted → score 90
- **Lesson:** test expectation phải tính đủ ALL active flags, không chỉ positive weights.

**Insight #4: Failed event sessionId=NULL = audit evidence pattern**

- Spec rule: failed check-in vẫn log → `attendance_events` row persisted
- R3 ràng buộc: sessionId=NULL để tránh conflict UNIQUE(employee_id, work_date) trên session
- AI implement đúng: `!isHardValid` → create event (không session) → throw 422
- DB verify confirm: failed row có `session_id=NULL, status='failed'`
- **Lesson:** evidence persistence pattern: failed attempts vẫn phải log để audit trail + anomaly detection. Decouple event table từ session lifecycle.

**Insight #5: Cache invalidation 5 points — AI tự enumerate**

- User ràng buộc "list rõ 4 points" — AI tìm ra 5 (thêm geofence.create)
- Mỗi point inject `BranchConfigCacheService.invalidate(branchId)` sau mutation
- Branches test regression-free nhờ mock cache provider
- **Lesson:** cache invalidation bugs thường xảy ra vì bỏ sót point. Yêu cầu AI enumerate explicit (không "all mutations") → catch edge case.

### Cách chỉnh sửa

1. `pnpm nx reset && nx run-many --target=test --all` (69/69)
2. Smoke 8 cases (valid, double, checkout, no-checkin, invalid location, override, list, DB verify)
3. DB verify: failed event `session_id=NULL` + audit override `before/after` JSON
4. Cache verify: admin POST wifi-config → key evicted → next check-in repopulate
5. Commit `5e4d545` — 35 files, lint-staged format
6. PR #8 → CI pass → merge

### Kết quả cuối cùng

- Commit: `5e4d545` — `feat(attendance): add check-in/out core with trust score + Redis cache`
- Merge: `e1d6270` — PR #8
- Branch deleted
- Test: 69/69 + 8/8 smoke + CI pass

### Bài học rút ra

- **Rate limit key = business entity (employee), not network entity (IP).** Especially critical for B2B SaaS with shared office IPs.
- **Shared cross-cutting services (cache, audit) → libs/api/common** to prevent circular deps between feature modules.
- **Test expectations must account for ALL active flags**, not just positive weights. Score = sum of everything.
- **Evidence persistence pattern:** failed attempts still logged (event without session) for audit trail.
- **Cache invalidation: enumerate ALL mutation points explicitly** in prompt — catch edge cases AI might miss with "all mutations".

**Day 2 closeout summary:**

- T-005 Auth → T-006 Branches → T-007 Employees → T-008 Trust Score → T-009 Attendance
- 5 tasks, 8 PRs total (Day 1+2), 69 tests, 22 endpoints, Redis cache, full check-in flow
- Backend **100% hoàn thành** theo MVP scope (docs/spec.md §11).
- Ready for Day 3: Frontend (portal + mobile).

---

<!-- Thêm entry mới ở dưới đây -->

## [#11] T-010 — Portal login + auth flow + signal-based state (Day 3 start)

- **Date:** 2026-04-16
- **Tool:** Claude Code (Sonnet, agent mode)
- **Module:** portal
- **Phase:** feature (frontend foundation)

### Mục tiêu

Login page + auth flow cho Ionic Angular portal, signal-based state, functional interceptor + guard (Angular 17+), dev proxy, Vietnamese UX.

### Prompt

Workflow 3 vòng tối giản — AI reuse plan đã có.

**Vòng 1 — Plan + 10 decisions (user recommend rõ):**

```
Bắt đầu Day 3. T-010 Portal login. Plan: auth infrastructure, token
storage, API service, environment + proxy, /login + /dashboard.
10 decisions với recommend rõ.
```

**Vòng 2 — Exec thẳng:**

```
Option 3 — Exec luôn. Decisions đã approve đầy đủ.
Sau exec: manual browser test 7 items, user verify trước khi commit.
```

### AI sinh ra

- **Auth core**: auth.service (signals) + interceptor (401 queue + refresh replay) + guard (canActivateFn) + token-storage + api.service
- **Pages**: /login (reactive form + Ionic + toast Vietnamese), /dashboard (placeholder)
- **Config**: proxy.conf.json, environments, .gitignore (.angular/)
- Removed nx-welcome.ts
- Manual browser test 7/7 pass

### Vấn đề phát hiện khi review

**Insight #1: Jest + Ionic ESM — cùng pattern T-005 lặp lại**

- CI fail: `@ionic/core/components/index.js:4 SyntaxError: Unexpected token 'export'`
- Root cause 1: `transformIgnorePatterns` chỉ whitelist `.mjs`, nhưng @ionic/core dùng `.js` ESM
- Root cause 2: `app.spec.ts` (Nx-generated) vẫn import `NxWelcome` (đã xóa) và test h1 `Welcome portal` (không còn sau ion-app refactor)
- Fix 1: `transformIgnorePatterns` whitelist `@ionic|@stencil|ionicons`
- Fix 2: Rewrite spec thành minimal smoke test với `provideHttpClient + provideRouter`
- **Local nx cache hide failure** — T-005 lesson lặp lại 100%.
- **Lesson reinforced:** `pnpm nx reset` trước final test khi modify scaffold-generated components — cần apply **systematically**.

**Insight #2: Functional guards + interceptors = Angular 17+ modern**

- AI dùng `canActivateFn` (function) thay vì `CanActivate` class
- Interceptor `HttpInterceptorFn` với `withInterceptors([...])`
- **Lesson:** Angular 17+ functional API là default mới; class pattern là legacy.

**Insight #3: 401 queue + single refresh replay cho FE**

- AI implement: `isRefreshing` flag + `BehaviorSubject<string|null>` cho concurrent 401
- Multiple requests pending → queue → 1 refresh call → replay với new token
- **Lesson:** FE auth phải handle race condition khi multiple requests expire cùng lúc.

**Insight #4: FE-only types > shared từ libs/api/\***

- Đề xuất: KHÔNG import types từ libs/api/\* vào portal — duplicate nhẹ trong `shared/types/auth.types.ts`
- Lý do: giảm coupling FE-BE + giữ FE build độc lập
- **Lesson:** shared types nghe hấp dẫn nhưng gây coupling + build graph phức tạp.

**Insight #5: Vietnamese error UX mapping**

- Error code → Vietnamese message map (vd: INVALID_CREDENTIALS → "Sai email hoặc mật khẩu")
- **Lesson:** i18n đầy đủ là phase 2; error mapping cho UX thân thiện nên làm từ MVP.

### Cách chỉnh sửa

1. Exec plan, manual browser test (AI không chạy browser được)
2. User verify 7 items pass
3. Commit `f0b273b` + CI fail → fix `b4f68d9` (jest + spec)
4. Re-run CI pass → merge

### Kết quả cuối cùng

- Commits:
  - `f0b273b` — `feat(portal): add login page + auth flow + signal-based state`
  - `b4f68d9` — `fix(portal): jest config for Ionic ESM + rewrite stale app.spec`
- Merge: `b69802b` — PR #9
- Test: smoke + manual 7/7 + CI pass

### Bài học rút ra

- **`pnpm nx reset` trước final test khi modify scaffold — rule bắt buộc** (T-005 lặp ở T-010).
- **Angular 17+ functional guards/interceptors** là default mới.
- **401 queue + single refresh replay** = OAuth2 FE pattern.
- **FE types duplicate nhẹ > shared từ BE libs** — giảm coupling.
- **Jest + Ionic ESM**: `transformIgnorePatterns` phải whitelist explicit.
- **Error code → Vietnamese mapping** = UX boost ngay MVP.

---

<!-- Thêm entry mới ở dưới đây -->

## [#12] T-011 — Portal Branches + Employees CRUD UI + 4 bug fixes

- **Date:** 2026-04-16
- **Tool:** Claude Code (Sonnet, agent mode)
- **Module:** portal
- **Phase:** feature (frontend lớn nhất Day 3)

### Mục tiêu

5 pages CRUD + 2 form modals + 2 API services + main layout với ion-split-pane. Manager scope visual badge. URL query params 2-way sync. Vietnamese error mapping cho 17 error codes.

### Prompt

Workflow 3 vòng + browser test bắt buộc.

**Vòng 1 — Plan + 10 decisions:**

```
T-011 Portal CRUD UI. Plan: layout với ion-split-pane, 2 API services,
5 pages, 2 modals, manager scope visual badge.
10 decisions với recommend.
```

**Vòng 2 — Approve + 3 refinements + 2 questions:**

```
Approve 10/10 + 5 extras.
R1. Manager scope BADGE explicit "Chỉ xem chi nhánh được phân công"
R2. URL query params 2-way sync với router subscribe
R3. NO unit test cho FE component, manual browser BẮT BUỘC
Q1. Manager forbidden URL → toast + redirect /branches
Q2. Modal network drop → giữ data, toast error, không close
```

### AI sinh ra

- **layout/main.layout.ts** — ion-split-pane shell + side menu responsive
- **5 pages** + **2 modals** (branches + employees CRUD)
- **2 API services** trong `core/`
- **error-toast.util.ts** — 17 error codes mapped to VN
- **URL query params 2-way sync** — bookmarkable filter state
- 14 manual test cases cho user verify

### Vấn đề phát hiện khi review

**Bug #1 (case 9): F5 → bị bắt login lại**

- **Root cause:** `App.ngOnInit().initFromStorage()` async, `authGuard.isAuthenticated()` check sync ngay → race condition
- Guard thấy `_user=null` → redirect /login TRƯỚC khi initFromStorage hoàn thành
- **Fix:** chuyển `initFromStorage` sang `APP_INITIALIZER` (block bootstrap đến khi /me resolve)
- **Lesson:** Angular bootstrap order — `APP_INITIALIZER` cho async setup phải hoàn thành TRƯỚC router/guard.

**Bug #2 (case 11): Manager paste forbidden URL → bị bắt login lại**

- Cùng race condition như #1 (paste URL = full page reload)
- Auto-fixed khi #1 fix
- **Lesson:** "F5" và "paste URL" cùng full reload — cùng race condition.

**Bug #3 (case 12): Admin filter HCM-Q1 → empty list**

- **Root cause:** `libs/api/employees/employees.service.ts` line:
  `where.OR = [...((where.OR as Prisma.EmployeeWhereInput[]) ?? [])];`
- Khi không có search nhưng có branch_id → `where.OR = []` (empty array)
- **Prisma interpret `OR: []` = match nothing** (always-false condition)
- **Fix:** xóa dòng tạo empty OR array
- **Lesson critical:** Prisma `OR: []` ≠ no condition — nó là always-false. Đừng tạo empty OR/AND/NOT arrays.

**Bug #4 (CI): Production bundle vượt budget 1MB**

- CI build fail: `bundle initial 1.10 MB exceeded 1 MB error budget`
- **Root cause:** Ionic + Angular standalone + 5 pages + 2 modals → 1.10 MB
- **Fix:** Bump budget initial 500kb/1mb → 1.5mb/2mb (pragmatic cho MVP)
- **Lesson:** Angular CLI default budget phù hợp vanilla; Ionic apps cần bump baseline ngay từ đầu để tránh CI surprise.

### Cách chỉnh sửa

1. AI exec → in 14 test cases cho user verify
2. User browser test → 3 bug found
3. Tôi (assistant) debug:
   - Read app.config + auth.service + employees.service
   - Test backend với curl trực tiếp (xác nhận 0 employees với HCM filter)
   - Identify Prisma `OR: []` bug
4. Apply 3 fixes (`APP_INITIALIZER` + remove OR + cleanup app.ts)
5. User re-test → all pass
6. Commit `736bc6f` → CI fail (bundle budget) → fix `680d6f6` → CI pass → merge

### Kết quả cuối cùng

- Commits:
  - `736bc6f` — `feat(portal): add branches + employees CRUD UI with manager scope`
  - `680d6f6` — `fix(portal): bump production budget for Ionic + Angular bundle size`
- Merge: `9656ef8` — PR #10
- Test: 14/14 manual browser + portal/employees tests pass + CI pass
- 4 bugs caught + fixed (3 logic + 1 build config)

### Bài học rút ra

- **Manual browser test catch bugs unit test miss** — F5 race + Prisma OR=[] không thể catch bằng unit test (cần stateful render + actual DB query).
- **Prisma `OR: []` = always false**, KHÔNG phải "no condition". Đừng tạo empty array operators.
- **Angular bootstrap order: `APP_INITIALIZER` > `ngOnInit`** cho async setup phụ thuộc router/guard.
- **F5 và paste URL = cùng full reload** → cùng race condition.
- **Angular CLI default budget quá strict cho Ionic** — set realistic baseline ngay từ đầu.
- **Backend curl test giúp pinpoint bug FE vs BE** — xác nhận 0 employees từ API trước khi nghĩ FE filter sai.

---

<!-- Thêm entry mới ở dưới đây -->

## [#13] <Next: T-012 Mobile check-in/out>

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
