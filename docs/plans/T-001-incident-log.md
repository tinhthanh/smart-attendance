# T-001 Incident Log

## Incident #1 — Angular generator fail với `--preset=ts`

**Timestamp:** 2026-04-15

### Issue
`pnpm exec nx g @nx/angular:app apps/portal ...` fail ngay sau khi scaffold workspace bằng `create-nx-workspace@21.6.10 --preset=ts`.

### Error message (nguyên văn)
```
NX   The "@nx/angular:application" generator doesn't support the existing TypeScript setup

The Angular framework doesn't support a TypeScript setup with project references.
See https://github.com/angular/angular/issues/37276 for more details.
You can ignore this error, at your own risk, by setting the
"NX_IGNORE_UNSUPPORTED_TS_SETUP" environment variable to "true".
```

### Root cause
Nx 21 `--preset=ts` tạo workspace kiểu **package-based** với:
- `tsconfig.base.json` có `composite: true`, `emitDeclarationOnly: true`, `customConditions`, `module: nodenext`
- `pnpm-workspace.yaml` với `packages: ["packages/*"]`
- Lib resolution qua TS project references + npm workspaces (không dùng `paths`)

Angular compiler (ngc) không support composite project references trong tsconfig — tracked upstream từ 2020 tại [angular/angular#37276](https://github.com/angular/angular/issues/37276), chưa có fix.

NestJS (SWC/ts-loader) không có ràng buộc này nên `@nx/nest:app` generate thành công.

### Resolution
Switch sang `--preset=apps` với `--workspaces=false`:
```
pnpm dlx create-nx-workspace@21.6.10 sa-init \
  --preset=apps \
  --pm=pnpm \
  --nxCloud=skip \
  --useGitHub=false \
  --skipGit=true \
  --workspaces=false \
  --no-interactive
```
`apps` preset tạo **integrated monorepo** cổ điển:
- `tsconfig.base.json` với `paths` (không `composite`)
- Không dùng pnpm workspaces — Nx tự handle project graph
- Support đồng thời `@nx/nest:app` + `@nx/angular:app` + `@nx/js:lib`

### Lesson learned
**Khi plan Nx scaffold, verify preset compatibility với TẤT CẢ generators dự định dùng — không chỉ verify version của plugins.**

Cụ thể:
- `ts` preset → package-based, TS project references → **KHÔNG** dùng được `@nx/angular:app`
- `apps` preset → integrated, tsconfig paths → full compatibility
- `npm` preset → package-based, JS-first → không khuyến nghị cho TS-heavy stack
- Các preset framework-specific (`angular-monorepo`, `nest`, ...) → ép stack cố định, không linh hoạt cho multi-stack monorepo

Checklist verify preset trước khi scaffold:
1. Đọc Nx docs mô tả preset (`nx.dev/reference/nx-commands#create-nx-workspace`)
2. Run `pnpm dlx create-nx-workspace@<version> --help` để list preset options
3. Scaffold thử ở `/tmp` + chạy `nx g <plugin>:<generator> --dry-run` cho MỌI generator dự định dùng, TRƯỚC khi commit plan

### Impact
- Mất ~5 phút scaffold lại
- Không ảnh hưởng repo chính (scaffold ở `/tmp`, rsync chưa chạy)
- Plan cập nhật lên `v0.2` với changelog

### Reference cho PROMPT_LOG
Entry này nên đưa vào `PROMPT_LOG.md` khi T-001 close, section "T-001 Retrospective".

---

## Known issues to revisit (deferred)

Các item phát hiện trong T-001 nhưng **cố ý defer** để không mở rộng scope:

| # | Issue | Defer to | Rationale |
|---|---|---|---|
| 1 | `prettier@2.6.2` (generator default, legacy) → upgrade lên `3.x` | Chore task sau T-001 | Không block build/test. Prettier 3 có breaking config (trailingComma default `all`, single attribute per line). Muốn align CLAUDE.md §4.1 + ecosystem. |
| 2 | `jest-preset-angular@~14.6.1` peer yêu cầu `jest@^29`, nhưng root đã cài `jest@30` | Khi `nx test portal` hoặc `nx test mobile` fail lần đầu | Peer warning non-fatal lúc install. Nếu test runner vẫn chạy được thì để yên. Nếu fail: upgrade `jest-preset-angular` lên 16.x (compat jest 30 + Angular 20). |
| 3 | `reflect-metadata@0.1.13` (NestJS generator default) — chính thức 0.2.x đã release | T-005 (NestJS auth module) | NestJS 11 chính thức support 0.2.x. 0.1.13 vẫn chạy nhưng thiếu fix security + có warning "deprecated" từ TC39 decorators spec. Verify + upgrade khi wire `@nestjs/jwt` + guards. |
