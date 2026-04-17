# T-005 Plan — Auth module (login + JWT + refresh + RBAC + rate limit)

> Generated 2026-04-16. Branch: `feature/auth-jwt-rbac`. Largest task day 2.

## Pre-work verify (done)

| Check                                                         | Status                                                                |
| ------------------------------------------------------------- | --------------------------------------------------------------------- |
| `libs/` chỉ có `shared/` — cần tạo `libs/api/auth`            | ✅ confirmed                                                          |
| `PrismaModule` đã `@Global` — inject `PrismaService` anywhere | ✅                                                                    |
| `bcrypt@6.0.0` đã cài (T-003)                                 | ✅ reuse                                                              |
| Seed có 3 test accounts với bcrypt hash rounds=10             | ✅ (`admin@demo.com`, `manager.hcm@demo.com`, `employee001@demo.com`) |

## Pinned versions (verified)

| Package                     | Version  | Peer check                                            |
| --------------------------- | -------- | ----------------------------------------------------- |
| `@nestjs/jwt`               | `11.0.2` | peer `@nestjs/common ^11` ✅                          |
| `@nestjs/passport`          | `11.0.5` | peer `@nestjs/common ^11`, `passport ^0.7` ✅         |
| `passport`                  | `0.7.0`  | —                                                     |
| `passport-jwt`              | `4.0.1`  | —                                                     |
| `@types/passport-jwt` (dev) | `4.0.1`  | —                                                     |
| `@nestjs/throttler`         | `6.5.0`  | peer `@nestjs/common ^11`, `reflect-metadata ^0.2` ✅ |

Total install ≈ 2MB. Không conflict với ecosystem hiện tại.

## Decisions — recommendations

| #   | Câu hỏi                         | Recommendation                                                                        | Rationale                                                                                                                                                                                                |
| --- | ------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Auth code ở đâu?                | **`libs/api/auth`** via `nx g @nx/nest:lib auth --directory=libs/api/auth`            | CLAUDE.md §3 yêu cầu. Reusable nếu sau này có API gateway/worker. `app.module.ts` import lib.                                                                                                            |
| 2   | Refresh token storage           | **DB table `refresh_tokens`** (new migration)                                         | Audit-friendly, survives Redis restart. Performance overhead (~5ms/refresh) chấp nhận được ở MVP scale. Schema: `id (uuid = jti), user_id, issued_at, expires_at, revoked_at, replaced_by, device_meta`. |
| 3   | JwtAuthGuard scope              | **Global** via `APP_GUARD` + `@Public()` decorator bypass                             | Default-secure. Quên add guard không thành risk. `@Public()` dùng cho `/login`, `/refresh`.                                                                                                              |
| 4   | Refresh rotation                | **Revoke cũ + cấp mới** trong `prisma.$transaction`                                   | Standard OAuth 2.0 rotation. Re-use token cũ (sau rotation) → detect replay → revoke ALL user's refresh tokens + log audit.                                                                              |
| 5   | Throttler storage               | **In-memory** (default) cho MVP                                                       | Spec §11.5 nói 5/phút/IP đơn giản. Redis-backed throttler cần thêm dep `@nest-lab/throttler-storage-redis`, thêm 1 failure mode, defer.                                                                  |
| 6   | Response wrapper                | **Tạo ngay** trong T-005 vào `libs/api/common` (interceptor + types)                  | T-006+ sẽ cần ngay. Defer = refactor nhiều service. Interceptor 30 dòng, tests 2 cases.                                                                                                                  |
| 7   | Error filter                    | **Global `HttpExceptionFilter`** cùng `libs/api/common`                               | Format chuẩn `{ error: { code, message, details } }` theo api-spec §1. Map built-in NestJS exception + custom `BusinessException`.                                                                       |
| 8   | `@CurrentUser()` return shape   | **Slim object** `{ id, email, roles: string[] }` (= JWT payload sau validate + fetch) | Không leak sensitive fields. Controller cần thêm thì inject `PrismaService`.                                                                                                                             |
| 9   | Bcrypt rounds                   | **10** (continue T-003)                                                               | Consistent với seed. Change later = invalid all existing passwords.                                                                                                                                      |
| 10  | `/change-password` trong T-005? | **Defer**                                                                             | Spec/api-spec không yêu cầu. T-005 đã 60' work.                                                                                                                                                          |

## Library + file structure

```
libs/api/auth/
├── src/
│   ├── index.ts
│   └── lib/
│       ├── auth.module.ts
│       ├── auth.controller.ts
│       ├── auth.service.ts
│       ├── dto/
│       │   ├── login.dto.ts
│       │   ├── refresh.dto.ts
│       │   └── auth-response.dto.ts
│       ├── guards/
│       │   ├── jwt-auth.guard.ts
│       │   └── roles.guard.ts
│       ├── strategies/
│       │   └── jwt.strategy.ts
│       ├── decorators/
│       │   ├── public.decorator.ts
│       │   ├── roles.decorator.ts
│       │   └── current-user.decorator.ts
│       └── interfaces/
│           └── jwt-payload.interface.ts
├── eslint.config.mjs
├── jest.config.ts
├── project.json
├── tsconfig.json, tsconfig.lib.json, tsconfig.spec.json
└── README.md

libs/api/common/            # NEW (Decision #6, #7)
├── src/
│   ├── index.ts
│   └── lib/
│       ├── response-transform.interceptor.ts
│       ├── http-exception.filter.ts
│       ├── business-exception.ts
│       └── error-codes.ts   # enum match api-spec §10
└── (...)

apps/api/src/
├── app/app.module.ts       # MODIFY: import AuthModule + ConfigModule (global) + ThrottlerModule + APP_GUARD/APP_FILTER/APP_INTERCEPTOR providers
├── main.ts                 # MODIFY: set global prefix 'api/v1', validation pipe

prisma/
└── migrations/
    └── <timestamp>_refresh_tokens/migration.sql   # new

prisma/schema.prisma        # ADD: model RefreshToken + relation on User
```

## Schema addition (new migration)

```prisma
model RefreshToken {
  id          String    @id @db.Uuid            // = jti trong JWT
  userId      String    @map("user_id") @db.Uuid
  issuedAt    DateTime  @default(now()) @map("issued_at")
  expiresAt   DateTime  @map("expires_at")
  revokedAt   DateTime? @map("revoked_at")
  replacedBy  String?   @map("replaced_by") @db.Uuid
  userAgent   String?   @map("user_agent")
  ipAddress   String?   @map("ip_address")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, revokedAt])
  @@index([expiresAt])
  @@map("refresh_tokens")
}

// Thêm vào model User:
//   refreshTokens RefreshToken[]
```

**Migration name**: `add_refresh_tokens`

## Endpoints — contract

| Method | Path                   | Guard                            | DTO          | Response                                               |
| ------ | ---------------------- | -------------------------------- | ------------ | ------------------------------------------------------ |
| POST   | `/api/v1/auth/login`   | `@Public()` + Throttler 5/min/IP | `LoginDto`   | `{ data: { access_token, refresh_token, user } }`      |
| POST   | `/api/v1/auth/refresh` | `@Public()`                      | `RefreshDto` | `{ data: { access_token, refresh_token } }`            |
| POST   | `/api/v1/auth/logout`  | JWT (global)                     | none         | `{ data: { success: true } }`                          |
| GET    | `/api/v1/auth/me`      | JWT (global)                     | none         | `{ data: { id, email, full_name, roles, employee? } }` |

## JWT config

```typescript
// Access token
{ sub: userId, email, roles: ['admin'|'manager'|'employee'][] }
// iat, exp tự set (exp = iat + JWT_ACCESS_TTL)
// signed với JWT_ACCESS_SECRET

// Refresh token
{ sub: userId, jti: uuid() }   // jti = RefreshToken.id
// signed với JWT_REFRESH_SECRET (khác secret)
// exp = iat + JWT_REFRESH_TTL
```

**Boot-time secret strength check** (trong `AuthModule.forRootAsync` hoặc `ConfigModule` validate schema): nếu `JWT_ACCESS_SECRET` hoặc `JWT_REFRESH_SECRET` < 32 char → throw, app không start.

## Rate limit

```typescript
// app.module.ts
ThrottlerModule.forRoot([{ name: 'auth', ttl: 60_000, limit: 5 }])

// auth.controller.ts
@Throttle({ auth: { limit: 5, ttl: 60_000 } })
@Public()
@Post('login')
```

In-memory storage (default) cho MVP. Note trong code: "scale up cần @nest-lab/throttler-storage-redis".

## Refresh rotation logic (atomic)

```typescript
async refresh(token: string) {
  const payload = jwt.verify(token, refreshSecret);  // throws if invalid/expired
  return prisma.$transaction(async (tx) => {
    const record = await tx.refreshToken.findUnique({ where: { id: payload.jti } });
    if (!record) throw new Unauthorized('INVALID_REFRESH');
    if (record.revokedAt) {
      // Replay attack — revoke all user's tokens
      await tx.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new Unauthorized('REFRESH_REPLAY_DETECTED');
    }
    if (record.expiresAt < new Date()) throw new Unauthorized('REFRESH_EXPIRED');

    const newJti = randomUUID();
    await tx.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date(), replacedBy: newJti },
    });
    await tx.refreshToken.create({
      data: { id: newJti, userId: record.userId, expiresAt: addDays(new Date(), 7) },
    });
    // sign new pair
    return { access_token: ..., refresh_token: ... };
  });
}
```

## Error codes (api-spec §10)

| HTTP | Code                      | When                             |
| ---- | ------------------------- | -------------------------------- |
| 400  | `VALIDATION_FAILED`       | class-validator errors           |
| 401  | `INVALID_CREDENTIALS`     | login wrong email/password       |
| 401  | `INVALID_TOKEN`           | JWT malformed/expired for access |
| 401  | `INVALID_REFRESH`         | refresh JWT fail/no DB row       |
| 401  | `REFRESH_EXPIRED`         | DB row expired                   |
| 401  | `REFRESH_REPLAY_DETECTED` | token đã revoke reused           |
| 401  | `ACCOUNT_INACTIVE`        | User.status != active            |
| 403  | `FORBIDDEN`               | RolesGuard deny                  |
| 429  | `TOO_MANY_ATTEMPTS`       | throttler exceed                 |

Map trong `HttpExceptionFilter`.

## Unit tests (libs/api/auth/src/lib/\*\*.spec.ts)

**AuthService** (mock PrismaService + JwtService):

- `login success` → trả access + refresh, tạo RefreshToken DB row
- `login wrong password` → throws `INVALID_CREDENTIALS`
- `login inactive user` → throws `ACCOUNT_INACTIVE`
- `login unknown email` → throws `INVALID_CREDENTIALS` (same code = no enumeration)
- `refresh valid` → rotates, revokes old
- `refresh expired DB row` → throws `REFRESH_EXPIRED`
- `refresh replay (revoked)` → throws + revokes all user tokens
- `logout` → marks revokedAt

**JwtStrategy.validate**:

- valid payload → returns `{ id, email, roles }`
- user không còn trong DB → throws UnauthorizedException

**RolesGuard**:

- no `@Roles()` metadata → allow
- user has role → allow
- user missing role → deny

Target coverage ≥ 80% cho `libs/api/auth`.

## Smoke test (manual)

```bash
# 1. Start services
docker compose up -d postgres redis
pnpm nx serve api &

# 2. Login 3 accounts
curl -sS -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@demo.com","password":"Admin@123"}' | jq .

curl ... manager.hcm@demo.com / Manager@123
curl ... employee001@demo.com / Employee@123

# 3. Wrong password
curl -sS -X POST ... -d '{"email":"admin@demo.com","password":"bad"}' | jq .
# expect 401 INVALID_CREDENTIALS

# 4. Rate limit (6 attempts/min)
for i in {1..6}; do curl -sS -X POST ... -d '{"email":"x","password":"y"}' -w "\n%{http_code}\n"; done
# last should be 429

# 5. /me
TOKEN="..."
curl -sS http://localhost:3000/api/v1/auth/me -H "Authorization: Bearer $TOKEN" | jq .

# 6. Refresh
curl -sS -X POST http://localhost:3000/api/v1/auth/refresh -d '{"refresh_token":"..."}' | jq .
```

## Execution steps (sau confirm)

1. Install deps: `pnpm add -w @nestjs/jwt@11.0.2 @nestjs/passport@11.0.5 passport@0.7.0 passport-jwt@4.0.1 @nestjs/throttler@6.5.0` + `pnpm add -Dw @types/passport-jwt@4.0.1`
2. Generate libs: `nx g @nx/nest:lib auth --directory=libs/api/auth --importPath=@smart-attendance/api/auth --no-interactive` + same cho `common`
3. Update `prisma/schema.prisma` → thêm model `RefreshToken` + relation trên User
4. `pnpm prisma migrate dev --name add_refresh_tokens`
5. Tạo DTOs, decorators, guards, strategy, service, controller
6. Tạo interceptor + filter + business-exception + error-codes trong `libs/api/common`
7. Update `apps/api/src/app/app.module.ts`: import ConfigModule (global), ThrottlerModule, AuthModule; providers `APP_GUARD: JwtAuthGuard`, `APP_FILTER: HttpExceptionFilter`, `APP_INTERCEPTOR: ResponseTransformInterceptor`
8. Update `apps/api/src/main.ts`: `app.setGlobalPrefix('api/v1')`, global `ValidationPipe({ whitelist: true, transform: true })`
9. Write unit tests
10. Verify: `pnpm nx test auth` → all pass, coverage ≥ 80%
11. Manual smoke: start postgres + api, curl 6 scenarios trên
12. Report files + `git status`
13. **Không commit** — user review + commit thủ công

## Risk

| Risk                                                                       | Mitigation                                                                                                               |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `nx g @nx/nest:lib` trong libs/api/ (2 levels deep) tạo `importPath` weird | Pass explicit `--importPath=@smart-attendance/api/auth`                                                                  |
| Global `APP_GUARD` khóa luôn `/api/health` nếu có                          | Check — T-005 không tạo health endpoint; nếu sau này cần, `@Public()`                                                    |
| ConfigModule global load `.env` nhưng CI không có `.env` file              | CI set env vars qua job config (T-004 đã set DATABASE*URL/JWT*\*)                                                        |
| `passport-jwt` deprecated API với NestJS 11                                | @nestjs/passport@11 + passport-jwt@4 là combo supported hiện tại                                                         |
| Unit test PrismaService mock phức tạp                                      | Dùng `DeepMockProxy` từ `jest-mock-extended` — xem Decision bổ sung                                                      |
| Migration `add_refresh_tokens` trên DB đã có data                          | Prisma `migrate dev` auto apply, không mất data existing                                                                 |
| Test commit không pass commitlint                                          | Commit đúng scope: `feat(auth): ...`, `feat(shared): ...` (libs/api/common scope = `api`), `feat(db): ...` cho migration |

## Decision bổ sung cần confirm

**D-extra-1**: Testing mock library — `jest-mock-extended` (`DeepMockProxy`) hay manual mock `jest.fn()`?

- Option A (recommend): install `jest-mock-extended@4` devDep, dùng `DeepMockProxy<PrismaClient>` cho test — clean, type-safe
- Option B: manual jest.fn() — zero extra dep, verbose

**D-extra-2**: Validation DTO — `LoginDto.password` min length check gì?

- Option A (recommend): min 8, max 100 (demo password "Admin@123" = 9 char OK)
- Option B: không validate length → empty password cũng pass DTO → fail ở bcrypt compare

**D-extra-3**: `@CurrentUser()` inject shape có thêm `employee` relation không?

- Option A (recommend): chỉ `{ id, email, roles }` từ JWT — nhanh, stateless
- Option B: full join với `Employee + Branch` — mỗi request 1 query extra

## Acceptance mapping (docs/tasks.md T-005)

- [ ] Login 3 accounts → step 11 smoke test ✅
- [ ] Wrong password → 401 INVALID_CREDENTIALS → unit test + smoke ✅
- [ ] 6 login/min → 429 → smoke test ✅
- [ ] Access decode `{ sub, email, roles }` → JwtPayload interface + smoke `jwt.io` decode ✅
- [ ] Refresh works + old revoked → unit test `refresh rotates` + DB check ✅
- [ ] `GET /me` expired → 401 → smoke test ✅
- [ ] Unit tests pass → `pnpm nx test auth` ✅
- [ ] Password not in response → DTO mapping `AuthResponseDto` chỉ có public fields ✅
- [ ] Secret từ ConfigService → `JwtModule.registerAsync` inject ConfigService ✅
- [ ] JwtAuthGuard global → APP_GUARD provider ✅
- [ ] Error codes khớp api-spec §10 → error-codes.ts enum ✅

## Chờ confirm

Reply `OK hết` hoặc # + extra# cần đổi → exec. Chưa generate/install gì.
