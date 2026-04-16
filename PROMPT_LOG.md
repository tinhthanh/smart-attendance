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
- **AI verify dependency availability TRƯỚC commit** — tránh promise rồi fallback (xem #13)
- **UX expectation align với business logic** — limitation document, không phải bug (xem #13)
- **Auth pattern stable = template chung** — đáng investment khi reuse 3+ lần (xem #13)
- **Platform abstraction qua service** — graceful web vs native fallback (xem #13)
- **Pattern reuse + lessons applied = CI pass first try** — T-012 không CI fail (xem #13)
- **Default filter cho list endpoints với nhiều records** — tránh load all (xem #14)
- **Destructive/audit-impact action cần preview + warning UX** — không chỉ button click (xem #14)
- **Environment gotcha document** — Mac sleep/wake port conflict, future smoke không stuck (xem #14)
- **Rules cứng cần exception clear khi use case hợp lý** — raw SQL cho analytics (xem #15)
- **Hybrid scheduling (timer + queue) > single tool** — separation timing vs retry/persistence (xem #15)
- **Idempotency 2 layers (queue + DB) = belt-and-suspenders** (xem #15)
- **Dependent cron jobs cần coordination filter** — race condition silent killer (xem #15)
- **Scope enum locked → plan sớm hoặc semantic remap** (xem #15)
- **Prisma `$queryRaw` against UUID columns LUÔN cast `::uuid` explicit** — auto-cast không work (xem #16)
- **Version pinning sớm cascade tới downstream choices** — accept trade-off (xem #16)
- **Read model (CQRS-lite) cho dashboard scale** — 60s staleness cho 10x speed (xem #16)
- **Role-based default routing > neutral default** — auto-redirect manager (xem #16)
- **Empty state = communication opportunity** — "Hệ thống bình thường" thay vì "No data" (xem #16)
- **AI tự document deviation + xin approve TRƯỚC commit** — pattern trưởng thành (xem #17)
- **Defense-in-depth scope check (create + download)** — single layer trên secure URL là risky (xem #17)
- **Streaming + cursor batching cho export từ MVP** — build-then-write vỡ memory (xem #17)
- **Blob download với HttpClient + auth header** — token in URL leak risk (xem #17)
- **UTF-8 BOM cho CSV Vietnamese** — Excel render UX (xem #17)
- **AI pre-work verify > blind follow prompt** — source code là source of truth (xem #18)
- **Nx @nx/dependency-checks strict — mọi cross-lib import PHẢI declare** trong package.json (kể cả type-only) (xem #18)
- **Backward compat wrapper khi refactor shared utility** — giảm migration risk (xem #18)
- **Severity scheme match data domain** — 4-tier > 3-tier khi có positive signals (xem #18)
- **Single source of truth = compile-time Record + runtime fallback** — defensive design (xem #18)
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

## [#13] T-012 — Mobile check-in/out screen với GPS + tabs

- **Date:** 2026-04-16
- **Tool:** Claude Code (Sonnet, agent mode)
- **Module:** mobile
- **Phase:** feature (Capacitor + permission flow)

### Mục tiêu

App mobile cho nhân viên check-in/out qua GPS, history, profile. Capacitor 8 plugins. Tab navigation. Vietnamese UX. WiFi plugin investigated nhưng skip vì ecosystem abandoned.

### Prompt

Workflow 3 vòng + browser test với Chrome DevTools mock GPS.

**Vòng 1 — Plan + 10 decisions:**

```
T-012 Mobile check-in/out. Capacitor plugins, permission flow, tab structure,
trust score badge, 10 decisions. Quan trọng: không trust mock_location từ
client (chỉ flag). Test web mode đủ cho acceptance.
```

**Vòng 2 — Approve + 3 refinements + 3 lưu ý:**

```
Approve 10/10 + 4 extras.
R1. Trust score limitation document (mobile cap ~55 yellow without WiFi)
R2. Demo data setup với coordinates cụ thể (HCM 10.7769,106.7009 / HN 21.0,105.85)
R3. Tab bar layout với ion-tabs + ion-tab-bar slot="bottom"
L1-L3. Web mode permission notes (HTTPS not required for localhost,
  Network plugin OK trên web, Device.getId() fallback UUID lưu Preferences)
```

### AI sinh ra

- **4 Capacitor plugins** pinned: Geolocation, Device, Network, Preferences
- **WiFi plugin SKIPPED** (research thật: no viable Capacitor 8 option)
  - `wifi.service.ts` stub return null + comment giải thích
- **Mobile app structure** (mirror T-010 portal):
  - core/{auth, api, capacitor, checkin, util}
  - 4 pages (login, home, history, profile)
  - tabs.layout với bottom tab bar
- **Vietnamese error mapping**: 13 codes + 7 risk_flag messages
- **Cleanup**: xóa nx-welcome.ts + app.html + app.scss (boilerplate)
- **Jest fix**: transformIgnorePatterns whitelist Ionic ESM (T-010 pattern)
- Manual browser test 9/9 pass

### Vấn đề phát hiện khi review

**Insight #1: AI tự research ecosystem trước khi commit dependency**

- Plan ban đầu propose `@capacitor-community/wifi` cho WiFi
- AI tự verify npm install → 404 / abandoned package
- Decision: skip WiFi, document rõ trade-off (trust score cap ~55)
- **Lesson:** AI nên verify dependency availability TRƯỚC khi promise feature. Tránh hứa rồi phải fallback giữa task.

**Insight #2: Trust score cap thấp ≠ bug, là spec limitation**

- Mobile check-in chỉ có GPS → max score 55 (review/yellow), không bao giờ trusted (xanh ≥70)
- AI phát hiện và document rõ trong commit + plan
- Backend KHÔNG cần thay đổi weights — đây là expected behavior
- **Lesson:** UX expectation phải align với business logic. Nếu mobile-only luôn yellow, user không nên hoang mang — đây là design constraint, không phải bug.

**Insight #3: Pattern reuse từ T-010 = velocity tăng**

- Mobile auth flow tái dùng 100% pattern T-010 portal:
  - APP_INITIALIZER (đã learn từ T-011 bug fix)
  - Functional interceptor + guard
  - Signal-based state
  - Vietnamese error mapping
- Khác biệt: token storage dùng `@capacitor/preferences` (native secure) thay vì `localStorage`
- **Lesson:** auth pattern stable đáng đầu tư template chung — 3 lần reuse rồi (T-005 backend, T-010 portal, T-012 mobile).

**Insight #4: Platform-specific abstraction qua service**

- `device.service.ts`: `Device.getId()` native, fallback UUID v4 lưu Preferences trên web
- `wifi.service.ts`: stub trả null trên cả native + web (no plugin)
- `geolocation.service.ts`: Capacitor API hoạt động đồng nhất web + native
- **Lesson:** abstraction qua service layer cho phép platform fallback gracefully — không hardcode platform check trong page logic.

**Insight #5: Defer e2e test discipline để Day 5**

- User question về Playwright e2e
- Trade-off analysis: Option A (manual only), B (NOW), C (Day 5 sweep)
- Choose Option C — feature first, e2e nice-to-have cuối
- T-B05 added vào tasks.md để không quên
- **Lesson:** test infrastructure decision dựa vào time budget — không phải "always yes" hay "always no". Document trade-off trong tasks.

### Cách chỉnh sửa

1. AI exec với pattern T-010 + new mobile-specific code
2. Manual test 9 cases (DevTools mock GPS + 2 location coords)
3. User pass all 9 → commit `0fba3db` → CI pass → merge
4. Không bug nào caught trong T-012 — pattern T-010/T-011 lessons đã apply trước (APP_INITIALIZER, Jest Ionic ESM)

### Kết quả cuối cùng

- Commit: `0fba3db` — `feat(mobile): add check-in/out screen with GPS + tabs + history`
- Merge: `d2018e2` — PR #11
- Branch deleted
- Test: 1 smoke + manual 9/9 + CI pass first try

### Bài học rút ra

- **AI verify dependency availability TRƯỚC commit** — tránh promise feature rồi fallback giữa task.
- **UX expectation align với business logic** — mobile-only yellow badge không phải bug, document để user hiểu.
- **Auth pattern stable đáng template chung** — 3 lần reuse rồi (T-005/T-010/T-012).
- **Platform abstraction qua service** — graceful fallback web vs native.
- **Test infrastructure decision dựa vào time budget**, document trade-off trong tasks.
- **Pattern reuse + lessons applied = CI pass first try** (T-012 không có CI fail nào, khác T-010/T-011).

---

<!-- Thêm entry mới ở dưới đây -->

## [#14] T-013 — Portal Attendance Sessions (list + detail + override) — Day 3 closeout

- **Date:** 2026-04-16
- **Tool:** Claude Code (Sonnet, agent mode)
- **Module:** portal
- **Phase:** feature (Day 3 cuối)

### Mục tiêu

Portal attendance UI: list + detail với events timeline + manager override modal với audit log. Mobile history đã có sẵn từ T-012 → scope narrow to portal only. Task nhỏ nhất Day 3 nhưng dense về UX detail.

### Prompt

Workflow 3 vòng rất gọn — pattern T-011 đã dày đủ để reuse.

**Vòng 1 — Plan + 10 decisions:**

```
T-013 History views. Mobile history DONE T-012 → scope narrow to portal.
Plan: 3 pages + 1 service + override modal. Reuse T-011 pattern hoàn toàn.
10 decisions với recommend.
```

**Vòng 2 — Approve + 3 refinements:**

```
Approve 10/10 + 4 extras.
R1. Override modal preview status before/after + audit warning
R2. Date defaults 7 ngày + quick filter buttons + client validation
R3. Empty states VN cho list + detail 404
```

### AI sinh ra

- **3 pages**: sessions-list, session-detail, override-session.modal
- **1 API service**: attendance.api.service.ts (list/get/override)
- **Types** FE-only: Session, Event, Query, OverrideDto
- **Menu**: "Chấm công" với time-outline icon
- **Quick filter buttons**: Hôm nay / 7 ngày / 30 ngày
- **Events timeline**: vertical list với color-coded icons (check-in/out/failed)
- **Override preview**: chips "current → new" + audit warning
- Manual test 8/8 pass

### Vấn đề phát hiện khi review

**Insight #1: Default filter phải có — tránh load full dataset**

- List endpoint trả 210 sessions từ seed → nếu không default filter, user đợi lâu
- Solution: default 7-day filter + quick filter buttons
- **Lesson:** list endpoints với nhiều records → PHẢI có default filter hợp lý, không phải "load all rồi user filter".

**Insight #2: Action với audit trail cần preview + warning**

- Override là destructive-feeling action (ghi đè status + audit log vĩnh viễn)
- AI add preview chips "current → new" + warning text
- User phải "hiểu rõ" trước submit — UX tốt cho compliance
- **Lesson:** destructive/audit-impact action cần confirm UX rõ ràng, không phải "click button done".

**Insight #3: Pattern reuse đạt "zero bug" trong task này**

- T-013 không có bug nào caught trong manual test (lần đầu từ T-010)
- Lý do:
  - URL query sync pattern T-011 proven
  - APP_INITIALIZER đã fix từ T-011
  - Error toast helper đã có 17 codes (no new)
  - Manager scope badge pattern replicated
- **Lesson:** mature pattern + lessons applied → velocity tăng + bug giảm. T-013 là evidence cho investment-in-patterns paid off.

**Insight #4: Port 3000 conflict (Mac sleep/wake artifact)**

- Orphan API process từ session trước vẫn hold port 3000
- AI fix bằng `pkill -9 -f "nx serve api" + sleep + restart`
- Không phải code bug, là developer environment issue
- **Lesson:** document environment gotcha để future Day 4-5 smoke test không bị stuck.

### Cách chỉnh sửa

1. AI exec với pattern T-011 + override modal specific
2. Manual test 8 cases (admin + manager + filter + override)
3. User pass all 8 → commit `78d8ad6` → CI pass → merge
4. Không bug caught (first time, pattern reuse mature)

### Kết quả cuối cùng

- Commit: `78d8ad6` — `feat(portal): add attendance sessions list + detail + manager override`
- Merge: `4223419` — PR #12
- Branch deleted
- Test: manual 8/8 + CI pass first try

**Day 3 closeout summary:**

- T-010 → T-013: Frontend hoàn thành 100% cho MVP
- Portal: login, branches CRUD, employees CRUD, attendance sessions, override
- Mobile: login, check-in/out with GPS + trust score, history, profile
- 4 PRs merged (T-010/T-011/T-012/T-013), 2 với CI fix sau commit (T-010, T-011)
- Pattern maturity rõ: T-010 fix, T-011 fix+bug, T-012 zero-bug, T-013 zero-bug
- PROMPT_LOG grown từ 10 → 14 entries, 15 insights mới về FE workflow

### Bài học rút ra

- **Default filter cho list endpoints với nhiều records** — tránh load all.
- **Destructive/audit-impact action cần preview + warning UX**, không chỉ button click.
- **Pattern reuse → velocity cao + bug giảm** (T-013 zero-bug first time trong Day 3).
- **Environment gotcha document để future smoke test** không stuck (Mac sleep/wake port conflict).
- **Frontend MVP 100% done sau 4 tasks Day 3** — ready cho Day 4 (dashboards + cron + CSV export).

---

<!-- Thêm entry mới ở dưới đây -->

## [#15] T-014 — BullMQ cron jobs (daily summary + missing checkout + anomaly)

- **Date:** 2026-04-16
- **Tool:** Claude Code (Sonnet, agent mode)
- **Module:** attendance / jobs
- **Phase:** feature (Day 4 start)

### Mục tiêu

3 scheduled jobs theo `docs/spec.md §4.3 §4.4 §8.4`. Hybrid `@nestjs/schedule` (timing) + BullMQ (retry/dedup). Manual trigger admin endpoint cho dev test + catch-up. Anomaly aggregation dùng raw SQL (analytics exception).

### Prompt

Workflow 3 vòng + 1 push back về raw SQL exception.

**Vòng 1 — Plan + 10 decisions:**

```
T-014 Cron jobs với BullMQ. Plan: dependencies, module structure, 3 jobs
logic, manual trigger endpoint, queue config, unit tests.
10 decisions với recommend.
Ràng buộc: KHÔNG setInterval, KHÔNG sync main thread, idempotent,
logger per job, timezone aware.
```

**Vòng 2 — Approve + raw SQL exception (a) + 6 refinements:**

```
Approve 10/10 + 4 extras.
Open concern → chọn (a): Accept raw SQL exception cho anomaly.
3 ràng buộc cứng: R1 parameterize, R2 typed results, R3 test với
mocked queryRaw.
3 refinements thêm: R4 detailed response, R5 daily/missing coordination,
R6 double-safe idempotency.
```

### AI sinh ra

- **`libs/api/jobs`** (12 files): module + scheduler + 3 processors + admin controller + DTOs + 3 specs + queues constants + date util
- **3 deps pinned**: @nestjs/bullmq@11.0.4, bullmq@5.74.1, @nestjs/schedule@6.1.3
- **3 cron jobs** với jobId pattern `{name}-{YYYY-MM-DD}` (BullMQ dedup)
- **Manual trigger** endpoint `POST /admin/jobs/:name/run` (admin only, hidden from Swagger)
- **Anomaly raw SQL** với 3 typed result interfaces + tagged template literals
- 10/10 unit tests + 5/5 smoke pass

### Vấn đề phát hiện khi review

**Insight #1: Raw SQL exception cho analytics — document policy, không hack**

- CLAUDE.md §8 nói "NO raw SQL — Prisma only" — strict cho CRUD
- Anomaly aggregation cần CTE + GROUP BY HAVING → Prisma findMany + JS aggregate sẽ slow + memory bloat (35k rows)
- Solution: chấp nhận raw SQL có scope giới hạn cho analytics + 3 hard constraints (R1-R3)
- Plan committed update CLAUDE.md §8 sau merge: "Raw SQL allowed for analytics aggregation only (CTE, window functions). CRUD must use Prisma."
- **Lesson:** rules cứng (§8 "no raw SQL") cần exception clear khi gặp use case hợp lý. Document exception > hack workaround. AI tự đề xuất scope-limited exception là pattern tốt.

**Insight #2: Hybrid scheduling = clean separation of concerns**

- @nestjs/schedule @Cron triggers → enqueue BullMQ job → processor handles
- Schedule = WHEN (timing logic), Queue = HOW (retry, observability, idempotency, persistence)
- Tránh single tool làm cả hai → tránh limit
- **Lesson:** scheduled background work nên dùng pattern hybrid timer + queue. Một tool làm cả hai (vd: BullMQ repeatable) sacrifice flexibility.

**Insight #3: Double-safe idempotency = belt-and-suspenders**

- BullMQ jobId `daily-summary-2026-04-14` → BullMQ skip duplicate enqueue
- DB `@@unique(employeeId, workDate)` upsert → DB skip duplicate row
- Either layer fail → other layer catch
- Verified: chạy 2 lần → counts identical (31 rows, không tăng)
- **Lesson:** background job idempotency cần 2 layer (queue + DB). Single layer bug → silent duplicate, khó debug.

**Insight #4: Daily/missing checkout coordination prevents race**

- Daily summary chạy 00:30 (sau missing checkout 23:59 đêm trước)
- Nếu missing checkout chậm → daily summary có thể aggregate session chưa close
- Solution: daily summary filter `checkOutAt IS NOT NULL OR status IN ('missing_checkout','absent')` → skip open sessions
- **Lesson:** dependent cron jobs cần explicit coordination filter — không assume sequential execution. Race condition giữa cron jobs là silent killer.

**Insight #5: Commitlint scope rejected `jobs` (không trong enum)**

- Initial commit `feat(jobs):` → commitlint fail "scope must be one of [enum]"
- Resolution: dùng `feat(attendance):` (semantic match — jobs aggregate attendance data)
- **Lesson:** scope enum locked from T-004 — phải plan thêm scope nếu module mới có nhiều commit. Hoặc map về scope existing semantically. Cho `jobs`, dùng `attendance` OK vì cả 2 đều liên quan attendance domain.

**Insight #6: Cache-manager Redis baseline issue (pre-existing T-009)**

- AI phát hiện cache không persist tới Redis DB (chỉ in-memory in-process)
- Pre-existing từ T-009, không phải T-014 regression
- AI flag rõ trong commit message + plan
- Anomaly cache vẫn work cho dashboard single-process, không survive restart
- **Lesson:** AI tự audit dependency của task hiện tại + flag pre-existing issues. Không silently inherit bug.

### Cách chỉnh sửa

1. AI exec với 3 ràng buộc R1-R3 cho raw SQL
2. Verify smoke 5/5: daily upsert idempotent, missing close 0, anomaly shape, RBAC 403
3. Verify idempotency: chạy daily 2 lần → counts identical
4. Commit lần 1 fail commitlint scope `jobs` → đổi `attendance` → commit pass
5. PR #13 → CI pass → user merge

### Kết quả cuối cùng

- Commit: `355c241` — `feat(attendance): add BullMQ cron jobs for daily summary + checkout + anomaly`
- Merge: `a05d1cd` — PR #13
- Branch deleted
- Test: 10/10 unit + 5/5 smoke + CI pass

### Bài học rút ra

- **Rules cứng cần exception clear khi gặp use case hợp lý** — document exception > hack workaround.
- **Hybrid scheduling pattern (timer + queue) > single tool** — clean separation timing vs retry/persistence.
- **Idempotency 2 layers (queue + DB) = belt-and-suspenders** — single layer bug silent.
- **Dependent cron jobs cần explicit coordination filter** — race condition silent killer.
- **Scope enum locked → plan scope mới sớm hoặc semantic remap** (jobs → attendance).
- **AI tự audit pre-existing issues**, không silently inherit (cache-manager Redis baseline).

---

<!-- Thêm entry mới ở dưới đây -->

## [#16] T-015 — Dashboards (admin overview + manager branch + anomalies)

- **Date:** 2026-04-16
- **Tool:** Claude Code (Sonnet, agent mode)
- **Module:** dashboard
- **Phase:** feature (Day 4 task lớn)

### Mục tiêu

3 dashboard endpoints + 3 portal pages với charts (KPI cards, bar/line/heatmap). Reads từ `daily_attendance_summaries` (T-014 read model). Manager scope. Auto-redirect manager → branch dashboard.

### Prompt

Workflow 3 vòng + bug discovery trong smoke test.

**Vòng 1 — Plan + 10 decisions:**

```
T-015 Dashboards. 3 endpoints + 3 pages + charts. Reuse T-014
daily_attendance_summaries + anomaly Redis cache.
10 decisions: charts library, heatmap impl, cache strategy, manager UX,
refresh policy.
```

**Vòng 2 — Approve + 3 refinements + 1 verify:**

```
Approve 10/10 + 5 extras.
R1. Bundle size watch (apexcharts +190KB → fit 1.5mb budget)
R2. Smoke prereq: admin trigger daily-summary cron để populate data
R3. Cache invalidation policy: accept 60s lag, không invalidate on cron
V1. Verify apexcharts heatmap support hour 0-23 trước khi viết SQL
```

### AI sinh ra

- **`libs/api/dashboard`**: service + controller + module + types + 7 specs
- **3 endpoints**: admin overview / manager branch / anomalies
- **Frontend portal**:
  - `/dashboard` rewritten — 4 KPI cards + 2 horizontal bar charts + heatmap
  - `/dashboard/branch/:id` (manager auto-redirect)
  - `/anomalies` — 3 sections + manual refresh + empty state
- **Charts library**: ng-apexcharts@2.4.0 (only Angular 20 option)
- **Menu**: thêm "Dashboard" + "Bất thường" items
- 7/7 backend tests + 4/4 backend smoke + 8/8 manual browser test

### Vấn đề phát hiện khi review

**Bug discovered: Prisma $queryRaw UUID cast missing**

- Smoke test `week_trend` raw SQL fail với:
  > Postgres error "operator does not exist: uuid = text"
- **Root cause:** `WHERE branch_id = ${branchId}` — Prisma tagged template không auto-cast string parameter sang UUID khi compare với UUID column
- **Fix:** explicit cast `WHERE branch_id = ${branchId}::uuid`
- AI tự catch trong smoke test trước khi commit
- **Lesson critical:** Khi dùng `$queryRaw` chống lại UUID columns, LUÔN cast string params explicitly (`::uuid`). Add vào CLAUDE.md raw SQL guidelines (R4).

**Insight #1: Charts library lựa chọn bị ép buộc bởi Angular version**

- AI verify peer deps: ngx-echarts + ng2-charts đều require Angular 21
- Chỉ ng-apexcharts compat với Angular 20 (dự án ta pin Angular 20)
- → Quyết định bị ép, không phải "chọn tốt nhất"
- **Lesson:** version pinning sớm (T-001 chọn Angular 20 vì Ionic compat) ảnh hưởng cascade tới chart lib chọn — accept trade-off.

**Insight #2: Read model > raw join cho dashboard performance**

- Dashboard đọc từ `daily_attendance_summaries` (T-014 cron populate)
- KHÔNG join raw `attendance_sessions` + `attendance_events`
- → Query đơn giản, fast, predictable
- T-014 cron là enabler cho T-015 dashboard scale
- **Lesson:** read model pattern (CQRS-lite) cho dashboard là đáng đầu tư khi list view + aggregation. Tradeoff: 60s staleness cho 10x speed.

**Insight #3: Manager auto-redirect = clean UX**

- Admin /dashboard → admin overview
- Manager /dashboard → auto-redirect /dashboard/branch/{ownBranchId}
- Tránh bắt manager click thêm 1 lần để vào branch view
- **Lesson:** role-based default routing tốt cho UX > "neutral default page".

**Insight #4: Empty state design cho good news**

- Anomaly empty payload (no anomalies) → "Hệ thống bình thường" + green icon
- Không phải "No data" sterile message
- **Lesson:** empty state = communication opportunity. Negative event empty = positive UX message.

**Insight #5: Cache invalidation policy trade-off documented**

- Admin trigger daily-summary cron → cache vẫn cũ tới 60s
- Solution A (invalidate trên cron complete) vs B (accept lag)
- Choose B cho MVP — đơn giản hơn, lag chấp nhận được cho dashboard "near real-time"
- Document rõ trade-off trong commit
- **Lesson:** không phải mọi cache invalidation đáng làm. Lag policy + document > complex invalidation logic.

### Cách chỉnh sửa

1. AI exec với 5 plan extras + 3 user refinements
2. Smoke test catch UUID cast bug → fix `::uuid`
3. Verify 4/4 backend smoke + manual browser test
4. AI tự test all 8 browser cases (user delegate AI test thay vì manual)
5. Commit `8bdd9c2` → CI pass → merge

### Kết quả cuối cùng

- Commit: `8bdd9c2` — `feat(dashboard): add admin overview + manager branch + anomalies UI`
- Merge: `fc6ce97` — PR #14
- Branch deleted
- Test: 7/7 unit + 4/4 backend smoke + 8/8 manual + CI pass first try

### Bài học rút ra

- **Prisma `$queryRaw` against UUID columns LUÔN cast `::uuid` explicit** — auto-cast không hoạt động.
- **Version pinning sớm cascade tới downstream choices** — Angular 20 → chart lib bị ép ng-apexcharts.
- **Read model (CQRS-lite) cho dashboard scale** — 60s staleness cho 10x speed.
- **Role-based default routing > neutral default** — manager auto-redirect = clean UX.
- **Empty state = communication opportunity** — "Hệ thống bình thường" thay vì "No data".
- **Cache invalidation policy: lag + document > complex invalidation** cho MVP.

---

<!-- Thêm entry mới ở dưới đây -->

## [#17] T-016 — CSV export async với BullMQ + streaming + scope check

- **Date:** 2026-04-16
- **Tool:** Claude Code (Sonnet, agent mode)
- **Module:** reports
- **Phase:** feature

### Mục tiêu

3 endpoints async CSV export với BullMQ, csv-stringify streaming, UTF-8 BOM cho Excel, defense-in-depth scope check trên download endpoint, frontend modal polling + blob download. Reuse pattern T-014.

### Prompt

Workflow 3 vòng + 3 deviation acknowledged.

**Vòng 1 — Plan + 10 decisions:**

```
T-016 CSV export. 3 endpoints async với BullMQ. csv-stringify, file
storage /tmp local MVP, manager scope, rate limit 3/min/user.
10 decisions với recommend.
```

**Vòng 2 — Approve + 3 refinements + 2 verifications:**

```
Approve 10/10 + 5 extras.
R1. Download endpoint scope enforcement (defense in depth)
R2. Audit log với filter params đầy đủ
R3. Job status response shape consistency với api-spec §6 snake_case
V1. Verify csv-stringify maintained
V2. Confirm column order
```

### AI sinh ra

- **`libs/api/reports`**: service + controller + module + processor + cleanup scheduler + DTOs + 11 specs
- **3 endpoints** match api-spec §6
- **csv-stringify@6.7.0** streaming + UTF-8 BOM + 11 cols Vietnamese
- **Frontend**: API service + export-progress modal (2s polling + blob download) + button trên /attendance
- **3 deviations** documented + accepted
- 11/11 unit tests + 7/7 smoke pass

### Vấn đề phát hiện khi review

**Insight #1: 3 deviations from plan — AI tự document + xin approve**

D1: AuditAction enum không có 'export'

- Workaround: `action='create'` + `entityType='AttendanceReport'`
- Per CLAUDE.md §9: don't modify schema without asking
- Audit data preserved trong entity_type + after JSON
- Future: migration add 'export' enum nếu cần

D2: Per-IP rate limit thay per-user

- UserThrottlerGuard (T-009 pattern) + @SkipThrottle metadata conflict
- Same NAT trade-off như T-009 documented
- For exports (admin/manager only, không bulk employee), per-IP acceptable
- Future: custom APP_GUARD replacement

D3: `os.tmpdir()` không hardcode `/tmp`

- Cross-platform: /var/folders/.../T/ Mac, /tmp Linux/CI
- Pragmatic improvement over plan

- **Lesson critical:** AI gặp obstacle implementation → tự document deviation + xin user approve TRƯỚC commit, không silently work-around. Đây là pattern AI workflow trưởng thành.

**Insight #2: Defense-in-depth scope check khác layers**

- Layer 1: createExportJob check user role + scope → reject if not allowed
- Layer 2: Download endpoint re-check ownership (`requestedBy === user.id` || admin || (manager AND filter.branch_id ∈ own branches))
- Lý do: dù jobId UUID v4 unguessable, không nên rely on obscurity
- **Lesson:** scope check tại CỬA VÀO (create) + CỬA RA (download) — defense in depth. Single layer assume secure URLs là risky.

**Insight #3: Streaming CSV pipe = constant memory**

- `csv-stringify.pipe(writeStream)` — không build full string trong memory
- Cursor-based DB query (skip/take 500/page) thay vì loadAll
- 10k row cap thêm safety net
- **Lesson:** export endpoints PHẢI streaming + cursor batching từ MVP. Build-then-write pattern fine cho 100 rows, vỡ memory ở 10k+.

**Insight #4: Blob download với auth header > token in URL**

- Frontend: `HttpClient.get(url, { responseType: 'blob' })` với auth interceptor
- Tạo blob URL với `URL.createObjectURL(blob)`, trigger download, sau đó `URL.revokeObjectURL`
- KHÔNG dùng `<a href="/download?token=...">` (token leak vào browser history, server logs, referer)
- **Lesson:** auth-protected file download phải qua HttpClient blob, không expose token trong URL.

**Insight #5: UTF-8 BOM cho Excel = Vietnamese rendering**

- Without BOM: Excel mở .csv → tiếng Việt thành mojibake (â,ð,ê)
- With BOM `\uFEFF` prefix: Excel detect UTF-8 → render đúng
- 3 byte overhead, savings: user không phải import wizard manual
- **Lesson:** CSV export cho người dùng Vietnamese ALWAYS prefix BOM. Documented trong file header constant.

### Cách chỉnh sửa

1. AI exec với 3 ràng buộc R1-R3 + 5 extras
2. Smoke 7/7 pass: admin success, manager scope, employee 403, rate limit
3. Verify CSV file: bytes count, BOM hex, Vietnamese render trong Excel manual
4. Verify audit_logs: 7 entries với entity_type + after JSON
5. Commit `956e7e9` → CI pass → merge

### Kết quả cuối cùng

- Commit: `956e7e9` — `feat(reports): add async CSV export with BullMQ + streaming`
- Merge: `546308d` — PR #15
- Branch deleted
- Test: 11/11 unit + 7/7 smoke + CI pass

### Bài học rút ra

- **AI tự document deviation + xin approve TRƯỚC commit** = pattern trưởng thành (D1-D3 cycle).
- **Defense-in-depth scope check (create + download)** — single layer assume secure URL là risky.
- **Streaming + cursor batching cho export từ MVP** — build-then-write vỡ memory ở scale.
- **Blob download với HttpClient + auth header** — token in URL leak risk.
- **UTF-8 BOM cho CSV Vietnamese** — Excel render UX, 3 byte overhead.

---

<!-- Thêm entry mới ở dưới đây -->

## [#18] T-017 — Anti-fraud UX polish + shared risk-flags (Day 4 closeout)

- **Date:** 2026-04-16
- **Tool:** Claude Code (Sonnet, agent mode)
- **Module:** shared / portal / mobile
- **Phase:** feature (polish, Day 4 cuối)

### Mục tiêu

Shared risk-flags constant (single source of truth), 4-severity chip component, anomaly rows clickable, mobile fail dialog primary+secondary layout, README anti-fraud section. Task polish không feature mới.

### Prompt

Workflow 3 vòng rất gọn — plan đã rõ, task polish scope nhỏ.

**Vòng 1 — Plan + 10 decisions:**

```
T-017 Anti-fraud UX polish. Shared risk-flags map, 4-severity chip,
README section. 10 decisions với recommend.
```

**Vòng 2 — Approve + 2 refinements:**

```
Approve 10/10 + 5 extras.
R1. Severity mapping explicit trong shared constant
R2. README anti-fraud section 3 paragraphs với 12-flag table
```

### AI sinh ra

- **`libs/shared/constants/risk-flags.ts`** — Record<TrustFlag, RiskFlagInfo> với 12 flags mapped
- **`RiskFlagChipComponent`** (portal standalone) — ion-chip + ion-popover hover tooltip
- **`pickPrimaryFlag()` helper** — severity rank cho mobile primary display
- **Portal modifications**: session-detail, branch-dashboard, anomalies (rows clickable routerLink)
- **Mobile**: drop local FLAG_MESSAGES, re-export shared
- **README "Anti-fraud strategy" section** — 3 paragraphs
- 49 tests pass, 6/6 smoke pass

### Vấn đề phát hiện khi review

**Insight #1: AI pre-work verify tìm ra gap so với user input**

- User prompt list 7 flags (outside_geofence, wifi_mismatch, etc.)
- AI grep canonical source `libs/shared/utils/trust-score.types.ts` → 12 flags (bao gồm positive: bssid_match, device_trusted)
- Report rõ gap trong plan → severity design phải 4 tier (success/info/warning/danger) thay vì 3
- **Lesson:** pre-work verification > blindly follow user prompt. Source code là source of truth, không phải recall của user.

**Insight #2: CI fail — Nx dependency-checks lint**

- CI fail: `libs/shared/constants/package.json: missing dependency for @smart-attendance/shared/utils`
- Root cause: `import type { TrustFlag }` từ shared/utils — type-only import nhưng Nx lint require declare
- Fix: thêm `"@smart-attendance/shared/utils": "workspace:*"` vào package.json
- **Lesson:** Nx monorepo với `@nx/dependency-checks` — MỌI cross-lib import (kể cả type-only) phải declare trong package.json.

**Insight #3: Backward compat wrapper cho migration**

- Mobile có `flagMessage(flag, distance)` helper với distance suffix logic
- Shared constant mới chỉ return label (không distance)
- AI giữ wrapper `flagMessage()` trong mobile — call shared `getRiskFlagInfo()` bên trong + append distance
- **Lesson:** khi refactor shared utility từ app-local sang workspace-shared, giữ backward compat wrapper giảm migration risk.

**Insight #4: 4-tier severity fit Ionic + positive flags**

- 3-tier (red/yellow/gray) không express được positive signals
- 4-tier (success/info/warning/danger) = Ionic built-in color tokens
- Positive flags được hiển thị rõ ràng (xanh)
- **Lesson:** severity scheme phải match data domain, không default "3 level negative only".

**Insight #5: Shared constant drift mitigation**

- Risk: BE thêm flag mới → shared map outdated → FE crash
- Mitigation: TypeScript Record strict typing + runtime fallback `getRiskFlagInfo('unknown')` → severity=info, label=raw
- **Lesson:** single source of truth cần defensive fallback — compile-time type safety + runtime graceful handling.

### Cách chỉnh sửa

1. AI exec với 2 refinements R1-R2
2. Test 49/49 + smoke 6/6 pass
3. Commit `272543f` → CI fail (constants package.json dep check) → fix `c6ecb4f` → CI pass → merge
4. Day 4 closeout

### Kết quả cuối cùng

- Commits:
  - `272543f` — `feat(shared): polish anti-fraud UX with shared risk-flags + 4-severity chip`
  - `c6ecb4f` — `fix(shared): declare @smart-attendance/shared/utils as constants dep`
- Merge: `649d274` — PR #16
- Branch deleted
- Test: 49/49 workspace + 6/6 smoke + CI pass (sau fix dep)

**Day 4 closeout summary:**

- T-014 → T-017: Reports + Dashboards + Polish DONE
- 4 PRs merged, chỉ T-017 có CI fail (Nx lint quirk)
- Pattern maturity: T-012/T-013 zero-bug, T-014/T-015/T-016 CI pass first try, T-017 caught edge case
- PROMPT_LOG grown 15 → 18 entries
- Backend + Frontend 100% feature complete theo docs/spec.md §11 MVP scope

### Bài học rút ra

- **AI pre-work verification > blind follow prompt** — source code là source of truth cho flag enumeration.
- **Nx @nx/dependency-checks lint strict — mọi cross-lib import PHẢI declare** trong package.json, kể cả type-only.
- **Backward compat wrapper khi refactor shared utility** — giảm migration risk.
- **Severity scheme match data domain**, không default 3-tier negative only.
- **Single source of truth = compile-time Record + runtime fallback** — defensive design.

---

<!-- Thêm entry mới ở dưới đây -->

## [#19] <Next: Day 5 — T-018 Production Docker>

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
