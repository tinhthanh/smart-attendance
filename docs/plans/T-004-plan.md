# T-004 Plan — Git Flow tooling (husky + commitlint + lint-staged + PR template + CI)

> Generated 2026-04-16. Branch: `feature/infra-git-flow-tooling`.

## Goal

- Commit không đúng Conventional Commit → **reject** ở `commit-msg` hook
- Pre-commit: ESLint + Prettier tự fix trên file staged
- PR mở lên GitHub → hiện template sẵn
- CI chạy lint + test + build trên Node 20 khi PR vào `develop`/`main`

## Scope

- IN: `.husky/`, `commitlint.config.js`, `.lintstagedrc.json`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/workflows/ci.yml`, scripts in `package.json`
- OUT: release automation (semantic-release/release-please — **explicitly skipped**, over-engineering cho 5-day MVP), branch protection rules (GitHub UI config, không commit được)

## Pinned versions (verified via `npm view`)

| Package                                 | Version  | Note                                           |
| --------------------------------------- | -------- | ---------------------------------------------- |
| `husky` (dev)                           | `9.1.7`  | v9 là standard 2024+, bỏ husky-init deprecated |
| `@commitlint/cli` (dev)                 | `20.5.0` | latest, compat Node 20+                        |
| `@commitlint/config-conventional` (dev) | `20.5.0` | match CLI major                                |
| `lint-staged` (dev)                     | `16.4.0` | latest                                         |

Total size: ~3MB. Không conflict peer với Nx / Prisma / Angular ecosystem (verified).

## File structure sẽ tạo

```
smart-attendance/
├── .husky/
│   ├── commit-msg          # chạy commitlint
│   └── pre-commit          # chạy lint-staged
├── commitlint.config.js    # extends config-conventional + scope enum
├── .lintstagedrc.json      # eslint --fix + prettier --write
├── .github/
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── workflows/
│       └── ci.yml
├── package.json            # MODIFY: add "prepare": "husky" + devDeps
```

## commitlint config — spec

```js
// commitlint.config.js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2, // error level
      'always',
      [
        // Feature modules (docs/spec.md §9)
        'auth',
        'branches',
        'employees',
        'attendance',
        'reports',
        'dashboard',
        'schedules',
        // Infra & cross-cutting
        'db', // prisma schema/migration/seed
        'api', // NestJS app-level changes
        'portal', // Ionic web portal
        'mobile', // Ionic + Capacitor mobile
        'shared', // libs/shared/*
        'infra', // docker, CI, env
        'deps', // dependency bumps
        'docs', // documentation
        'prompt-log', // PROMPT_LOG.md updates
        'release', // version/tag commits
      ],
    ],
    'scope-empty': [2, 'never'], // scope required
    'subject-case': [0], // allow any case for i18n/VI subjects
    'subject-max-length': [2, 'always', 100],
    'header-max-length': [2, 'always', 120],
    'body-max-line-length': [0], // long URLs OK
    'footer-max-line-length': [0],
  },
};
```

**Why scope enum (strict)**: Prevents `feat(stuff):` / `fix(x):` drift. 18 scopes covers all MVP work. Easy to extend when new module arrives (PR edits this file).

## .lintstagedrc.json — spec

```json
{
  "*.{ts,tsx,js,mjs,cjs}": ["nx affected:lint --uncommitted --fix=true", "prettier --write"],
  "*.{json,md,yml,yaml,scss,html}": ["prettier --write"]
}
```

**Gotcha**: `nx affected:lint` dùng project graph, có thể overkill cho staged file lẻ. **Alternative (đơn giản hơn)**: dùng `eslint --fix` trực tiếp trên file path lint-staged truyền vào. Cần quyết định — xem Decision #3.

## .husky/commit-msg

```sh
npx --no-install commitlint --edit "$1"
```

## .husky/pre-commit

```sh
npx --no-install lint-staged
```

Husky v9 KHÔNG còn cần shebang/sourcing `_/husky.sh` như v8 — file chỉ cần executable và nội dung chạy trực tiếp.

## .github/PULL_REQUEST_TEMPLATE.md — spec

```markdown
## Summary

<!-- 1-3 bullet: gì thay đổi và tại sao -->

## Changes

<!-- Bullet list file/module -->

## Linked spec / task

<!-- Reference docs/spec.md §X, docs/tasks.md T-XXX -->

## Test plan

- [ ] Unit tests pass: `pnpm test`
- [ ] Build pass: `pnpm build`
- [ ] Lint pass: `pnpm lint`
- [ ] Manual smoke (describe):
- [ ] (UI) Screenshot attached

## Screenshot

<!-- Chỉ nếu thay đổi UI -->

## Checklist

- [ ] Branch theo `feature/...` hoặc `fix/...` (CLAUDE.md §6.1)
- [ ] Commit subject follow Conventional Commits
- [ ] Docs/plan updated nếu cần
- [ ] No secrets / credentials in diff
```

## .github/workflows/ci.yml — spec

```yaml
name: CI

on:
  pull_request:
    branches: [develop, main]
  push:
    branches: [develop, main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: '20'
  PNPM_VERSION: '10.18.1'

jobs:
  ci:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: smart_attendance
          POSTGRES_USER: sa_app
          POSTGRES_PASSWORD: ci_test_pw
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U sa_app -d smart_attendance"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 3s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://sa_app:ci_test_pw@localhost:5432/smart_attendance?schema=public
      REDIS_URL: redis://localhost:6379/0
      JWT_ACCESS_SECRET: ci_dummy_access_secret
      JWT_REFRESH_SECRET: ci_dummy_refresh_secret
      JWT_ACCESS_TTL: 15m
      JWT_REFRESH_TTL: 7d
      NODE_ENV: test

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # nx affected needs history

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm

      - name: Install
        run: pnpm install --frozen-lockfile

      - name: Prisma migrate (CI db)
        run: pnpm prisma migrate deploy

      - name: Nx lint
        run: pnpm nx run-many --target=lint --all --parallel=3

      - name: Nx test
        run: pnpm nx run-many --target=test --all --parallel=3

      - name: Nx build
        run: pnpm nx run-many --target=build --all --parallel=2

      - name: Cache .nx
        uses: actions/cache@v4
        with:
          path: .nx/cache
          key: nx-${{ runner.os }}-${{ github.sha }}
          restore-keys: nx-${{ runner.os }}-
```

**Design notes:**

- **1 job** không matrix: matrix node 20 only → không cần matrix (tasks.md nói "matrix node 20" nhưng chỉ 1 version → dùng 1 job đơn). Nếu muốn future-proof thì matrix `[20, 22]` — xem Decision #4.
- `pnpm install --frozen-lockfile` → fail nếu lockfile drift.
- `prisma migrate deploy` (không phải `dev`) → CI mode, không tạo shadow DB, không prompt.
- Services `postgres:16-alpine` + `redis:7-alpine` match docker-compose T-002.
- `actions/cache@v4` cho `.nx/cache` → speedup tăng dần.
- `concurrency.cancel-in-progress` → PR mới push commit → cancel CI cũ, tiết kiệm minute.

## Risk

| Risk                                                                                 | Mitigation                                                                                                                  |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `husky` v9 install path khác v8                                                      | Dùng `prepare` script chuẩn của husky v9 docs: `"prepare": "husky"` (không phải `husky install`)                            |
| lint-staged chạy `nx affected:lint` có thể slow cho file lẻ                          | Decision #3 — chọn ESLint trực tiếp hay Nx affected                                                                         |
| commitlint reject commit đã tạo (vì scope không match)                               | Developer chạy `git commit --amend -m "..."` — không mất code. Doc trong PR template/README sau.                            |
| CI thiếu `.env` → Nx command đọc env fail                                            | Set env block ở job-level (đã có trong spec YAML)                                                                           |
| `prisma migrate deploy` cần migrations có sẵn → đã có từ T-003 `20260415171458_init` | ✅                                                                                                                          |
| GitHub Actions không chạy `postinstall` → Prisma client không generate               | `pnpm install` sẽ trigger `postinstall` (đã config T-003) → `prisma generate` tự chạy. Verify khi CI chạy lần đầu.          |
| `actionlint` không cài local → không validate YAML trước commit                      | Dùng Docker một-shot: `docker run --rm -v $PWD:/r rhysd/actionlint:latest -color /r/.github/workflows/ci.yml` — Decision #5 |
| Commit hook reject commit từ AI (khi AI commit trên bản build CI)                    | T-004 acceptance yêu cầu verify hook thật sự reject → chủ ý verify, không bypass                                            |

## Quyết định cần confirm

| #   | Câu hỏi                                     | Option A (recommend)                                                                                   | Option B                                                                                  |
| --- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| 1   | **Husky install via `prepare` script**      | **Có** — `"prepare": "husky"` (idempotent, chạy sau mọi `pnpm install`)                                | Manual `pnpm exec husky init` — chỉ lần đầu, dễ quên trên máy mới                         |
| 2   | **Scope enum strict**                       | **Strict** với 18 scopes (spec §9 + infra). New scope = edit `commitlint.config.js` trong PR tương ứng | Loose — `'scope-enum': [0]` (tắt check). Mất kỷ luật.                                     |
| 3   | **lint-staged runner**                      | **ESLint direct** trên staged files (`eslint --fix`) — nhanh, predictable                              | `nx affected:lint --uncommitted --fix` — đúng monorepo spirit, nhưng overhead với file lẻ |
| 4   | **CI node matrix**                          | **1 version node 20** (match tasks.md "matrix node 20")                                                | Matrix `[20, 22]` future-proof, tốn 2x CI minute                                          |
| 5   | **actionlint validation trước commit**      | **Có**, dùng Docker `rhysd/actionlint` (không cần install local)                                       | Skip, trust GitHub Actions runtime để fail                                                |
| 6   | **CI có chạy Prisma migrate + seed không?** | `migrate deploy` (không seed) — đủ cho test có schema. Seed là dev data, không cần CI                  | Migrate + seed → test có thể depend data → brittle                                        |
| 7   | **semantic-release / release-please**       | **KHÔNG** (tasks.md: "over-engineering cho 5 ngày"). Manual tag khi release.                           | Có — auto changelog + version bump                                                        |
| 8   | **Body/Footer max-line-length**             | `0` (disabled) — cho URL dài + AI co-author footer                                                     | `100` default                                                                             |
| 9   | **Subject case**                            | Disabled `[0]` — cho phép tiếng Việt subject (có dấu viết hoa)                                         | `lower-case` enforce                                                                      |

## Execution plan (sau confirm)

1. Install deps: `pnpm add -Dw husky@9.1.7 @commitlint/cli@20.5.0 @commitlint/config-conventional@20.5.0 lint-staged@16.4.0`
2. Thêm `"prepare": "husky"` vào `package.json` scripts
3. Chạy `pnpm install` — trigger `prepare` → tạo `.husky/` folder
4. Tạo `commitlint.config.js`
5. Tạo `.lintstagedrc.json`
6. Tạo `.husky/commit-msg` + `.husky/pre-commit` (chmod +x)
7. Tạo `.github/PULL_REQUEST_TEMPLATE.md`
8. Tạo `.github/workflows/ci.yml`
9. **Validate YAML**: `docker run --rm -v $PWD:/r rhysd/actionlint:latest -color /r/.github/workflows/ci.yml` → expect no errors
10. **Test hook reject**: `git commit --allow-empty -m "test"` → expect FAIL (KHÔNG dùng `--no-verify`)
11. **Test hook accept**: `git commit --allow-empty -m "feat(infra): verify hook"` → expect PASS, rồi `git reset HEAD~1` để không giữ commit test
12. `git status` cho user review
13. **Không push, không tạo PR thật** — user commit + push/PR thủ công

## Acceptance mapping

- [ ] `git commit -m "test"` reject → step 10 ✅
- [ ] `git commit -m "feat(test): hello"` → **FAIL** vì scope `test` không trong enum (strict). Should pass theo tasks.md → confirm Decision #2: nếu strict thì `test` không OK. Cần dùng scope hợp lệ (vd: `feat(infra): hello`). **Đây là trade-off cần bạn confirm**.
- [ ] PR template hiện khi `gh pr create --web` → step 7 (GitHub tự pick lên từ `.github/PULL_REQUEST_TEMPLATE.md`) ✅
- [ ] CI YAML valid → step 9 (actionlint) ✅

**⚠️ Mâu thuẫn giữa acceptance và strict scope**: tasks.md acceptance ví dụ `feat(test): hello` pass. Nhưng với strict enum không có `test`, câu đó FAIL. 2 cách xử lý:

- (i) Thêm `test` vào scope enum (loose hơn — chấp nhận "test" là scope hợp lệ cho demo/smoke)
- (ii) Diễn đạt lại acceptance → dùng scope hợp lệ (vd `feat(auth): hello`)

→ Recommend (i) thêm `test` vào enum như một **escape hatch cho smoke/demo**, và tài liệu trong README. Confirm hay đổi?

## Known issues (defer)

- Branch protection rules (GitHub UI) — không thuộc scope commit-able
- CODEOWNERS file — defer đến khi có team chính thức
- Dependabot config — defer
