# T-001 Plan — Init Nx Workspace

> Generated 2026-04-15. Verified via `npm view` against live registry.
>
> **Changelog**
> - `v0.1` (2026-04-15) — initial plan, preset `ts`.
> - `v0.2` (2026-04-15) — corrected preset choice after generator error.
>   `--preset=ts` trong Nx 21 tạo workspace **package-based** với TS project
>   references (`composite: true`, `customConditions`) — Angular compiler
>   KHÔNG tương thích (angular/angular#37276). Chuyển sang `--preset=apps`
>   với `--workspaces=false` → integrated monorepo cổ điển dùng `tsconfig`
>   paths, là setup official support cho Angular + Nest đồng thời.

## Stack pinned versions

| Package | Version | Peer-dep verified |
|---|---|---|
| `nx`, `@nx/*` (workspace, js, nest, node, angular, eslint, jest) | `21.6.10` | `@nx/angular@21` caps `@angular-devkit/* < 21.0.0` → Angular 20 compatible |
| `@angular/*` | `20.3.18` | latest 20.x LTS patch |
| `typescript` | `5.9.3` | Angular 20.3 peer `>=5.8 <6.0` ✅ |
| `@nestjs/core`, `common`, `platform-express`, `testing` | `11.1.19` | |
| `@ionic/angular`, `@ionic/core` | `8.8.3` | peer `@angular/core >=16` ✅ |
| `ionicons` | `7.4.0` | |
| `@capacitor/core`, `@capacitor/cli` | `8.3.0` | iOS/Android **defer T-012** |
| `@capacitor/app` | `8.1.0` | |
| `@capacitor/haptics` | `8.0.2` | |
| `prisma`, `@prisma/client` | `7.7.0` | |
| `rxjs` | `7.8.2` | |
| `class-validator`, `class-transformer`, `reflect-metadata` | `0.15.1`, `0.5.1`, `0.2.2` | |
| `prettier` | `3.8.3` | |
| `jest`, `ts-jest`, `@types/jest` | `30.3.0`, `29.4.9`, `30.0.0` | |
| `eslint` | 9.x (Nx generator default) | flat config |
| `supertest` | `7.2.2` | |

## Decisions confirmed

1. **Bootstrap**: Option A — scaffold ở `/tmp/sa-init` → rsync về repo (exclude `.git`, `docs/`, root `*.md`, `.gitignore`). **Preset = `apps` với `--workspaces=false`** (integrated monorepo) — KHÔNG phải `ts` (đó là package-based, không tương thích Angular).
2. **Angular**: 20.3.18 (LTS), **không** 21.
3. **TypeScript**: 5.9.3.
4. **Generate order**: api → portal → mobile. Không dùng `--frontendProject`.
5. **Capacitor**: chỉ `core`+`cli`+`app`+`haptics` + `cap init`. **Defer** `cap add ios/android` sang T-012.
6. **ESLint**: để generator tự chọn (9.x flat).
7. **Ionic integration**: manual — `nx g @nx/angular:app` + `pnpm add @ionic/angular @ionic/core` + `provideIonicAngular()`. **Không** dùng `@nxext/ionic-angular` (chưa support Nx 21/22).
8. **pnpm**: `.npmrc` với `node-linker=hoisted` + `strict-peer-dependencies=false` (chuẩn bị cho Capacitor native khi T-012).

## Execution guards

- Print full commands + wait 3s trước khi scaffold/rsync (cho user Ctrl+C).
- rsync exclude list literal (verify không overwrite `docs/`, `CLAUDE.md`, `.gitignore`, v.v.).
- Post-rsync: `git status`, `git diff .gitignore` (nếu có), `head -50 package.json`, `nx graph --file=/tmp/nx-graph.json`.
- Bất kỳ lệnh fail → STOP, báo lỗi nguyên văn, không tự `--force` hoặc đổi version/flag.
- **Không commit** — user commit thủ công sau khi review.

## Rsync exclude list

```
--exclude=.git/
--exclude=docs/
--exclude=ASSIGNMENT.md
--exclude=CLAUDE.md
--exclude=PROMPT_LOG.md
--exclude=README.md
--exclude=resarch1.md
--exclude=.gitignore
```

## Structure target (sau khi hoàn tất)

```
smart-attendance/
├── .git/                 (giữ)
├── .gitignore            (giữ — user's version)
├── .npmrc                (mới)
├── .prettierrc           (mới, từ Nx generator)
├── eslint.config.mjs     (mới)
├── nx.json
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── jest.preset.js
├── CLAUDE.md             (giữ)
├── PROMPT_LOG.md         (giữ)
├── README.md             (giữ)
├── ASSIGNMENT.md         (giữ)
├── resarch1.md           (giữ)
├── docs/                 (giữ — gồm plans/T-001-plan.md)
├── apps/
│   ├── api/              (NestJS)
│   ├── api-e2e/
│   ├── portal/           (Angular 20 + Ionic 8, standalone)
│   └── mobile/           (Angular 20 + Ionic 8 + Capacitor 8 web-only)
└── libs/shared/
    ├── types/
    ├── constants/
    └── utils/
```
