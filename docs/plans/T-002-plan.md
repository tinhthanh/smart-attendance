# T-002 Plan — Docker Compose skeleton (Postgres + Redis)

> Generated 2026-04-15. Branch: `feature/infra-docker-compose`.

## Goal
`docker compose up -d postgres redis` chạy được 2 service healthy; NestJS app (T-001) kết nối qua `DATABASE_URL` + `REDIS_URL` từ `.env`.

## Scope
- IN: `docker-compose.yml`, `.env.example`, docs/plan.
- OUT: Dockerfile cho api/portal/mobile (defer T-00X), prod compose, TLS, backup.

## Files sẽ tạo

| File | Mục đích |
|---|---|
| `docker-compose.yml` | 2 services (postgres, redis) + named volume + bridge network |
| `.env.example` | Template các env var, commit được (không chứa secret thật) |
| `docker/` | Empty for now — reserved cho sau (Dockerfiles, init scripts) |

**Không sửa** `.gitignore` — đã verify có `.env`, `.env.local`, `.env.*.local` (lines 15-17).

## docker-compose.yml — spec

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: sa-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-smart_attendance}
      POSTGRES_USER: ${POSTGRES_USER:-sa_app}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?required}
    ports:
      - "127.0.0.1:${POSTGRES_PORT:-5432}:5432"   # bind localhost only
    volumes:
      - sa-postgres-data:/var/lib/postgresql/data
    networks: [sa-net]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  redis:
    image: redis:7-alpine
    container_name: sa-redis
    restart: unless-stopped
    command: ["redis-server", "--appendonly", "yes"]
    ports:
      - "127.0.0.1:${REDIS_PORT:-6379}:6379"       # bind localhost only
    volumes:
      - sa-redis-data:/data
    networks: [sa-net]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
      start_period: 5s

volumes:
  sa-postgres-data:
  sa-redis-data:

networks:
  sa-net:
    driver: bridge
    name: sa-net
```

**Notes:**
- `POSTGRES_PASSWORD:?required` → compose fail nếu chưa set (guard chống quên).
- `127.0.0.1:` prefix port → chỉ listen localhost, không expose ra LAN/Internet (review checklist: "Không expose port không cần thiết ra ngoài" ✅).
- `restart: unless-stopped` → dev thân thiện, tắt bằng `docker compose down`.
- Redis bật AOF (`--appendonly yes`) để persist queue state (sau này BullMQ sẽ dùng).

## .env.example — spec

```env
# ============ Postgres ============
POSTGRES_DB=smart_attendance
POSTGRES_USER=sa_app
POSTGRES_PASSWORD=change_me_local_dev
POSTGRES_PORT=5432
DATABASE_URL=postgresql://sa_app:change_me_local_dev@localhost:5432/smart_attendance?schema=public

# ============ Redis ============
REDIS_PORT=6379
REDIS_URL=redis://localhost:6379/0

# ============ API ============
API_PORT=3000
NODE_ENV=development

# ============ JWT (generate real secrets: openssl rand -hex 32) ============
JWT_ACCESS_SECRET=replace_with_openssl_rand_hex_32
JWT_REFRESH_SECRET=replace_with_openssl_rand_hex_32
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d

# ============ Frontend ports (dev servers) ============
PORTAL_PORT=4200
MOBILE_PORT=8100
```

## Decisions cần bạn confirm

| # | Câu hỏi | Option A (recommend) | Option B |
|---|---|---|---|
| 1 | **Postgres user** | Tạo dedicated `sa_app` (match prod least-privilege) | Dùng default `postgres` superuser (đơn giản, không realistic) |
| 2 | **pgAdmin / RedisInsight** container cho dev | **KHÔNG** — developer tự dùng DBeaver/TablePlus/redis-cli local; giảm RAM, giảm surface | Có, tiện debug không cần cài client |
| 3 | **Env file convention** | `.env` (compose mặc định đọc file này). `.env.local` = override cá nhân (đã có trong `.gitignore`) | `.env.local` là canonical, `.env` là template |
| 4 | **Healthcheck params** | `interval=10s, timeout=5s, retries=5` cho pg; `interval=10s, timeout=3s, retries=5` cho redis | Chặt hơn (5s/3s) — spam hơn, ít lợi cho dev |
| 5 | **Redis password dev local** | **KHÔNG** — bind 127.0.0.1, dev env, simple | Có — mô phỏng prod (overhead) |
| 6 | **Postgres port binding** | `127.0.0.1:5432:5432` (localhost-only) | `5432:5432` (expose LAN — risk) |
| 7 | **Volume type** | Named volume (`sa-postgres-data`) — docker-managed | Bind mount `./data/postgres` — lẫn vào repo, dễ nhầm commit |

Mình đã đi theo Option A cho tất cả trong spec ở trên. Nếu OK hết → plan sẵn sàng exec. Nếu khác → reply item # cần đổi.

## Execution steps (sau khi confirm)

1. Tạo `docker-compose.yml` + `.env.example` theo spec trên.
2. Verify local:
   - `cp .env.example .env` (user làm thủ công — mình không tạo `.env`)
   - `docker compose up -d postgres redis`
   - `docker compose ps` → 2 services healthy
   - `psql "$DATABASE_URL" -c '\l'` → list DBs
   - `redis-cli -u "$REDIS_URL" ping` → PONG
3. `docker compose down` (không `-v` để giữ data).
4. `git status` cho bạn review.
5. **Không commit** — bạn commit thủ công.

## Risk

| Risk | Mitigation |
|---|---|
| Port 5432/6379 đã dùng trên máy dev (có Postgres/Redis cài local) | `.env` cho phép override `POSTGRES_PORT`/`REDIS_PORT`. Plan note rõ. |
| `docker compose` (v2, space) vs `docker-compose` (v1, hyphen) | Dùng `docker compose` (v2, standard 2023+). Note trong docs/plans. |
| AOF file grows trên dev lâu dài | Dev thôi — chấp nhận, có `docker compose down -v` reset. |
| Healthcheck `pg_isready` cần env `POSTGRES_USER` + `POSTGRES_DB` expanded trong container — `$${VAR}` (double $ escape compose) | Đã dùng `$${...}` trong command để compose không interpolate, Docker exec trong container sẽ expand. |

## Acceptance mapping (docs/tasks.md T-002)

- [ ] `docker compose up -d postgres redis` → step 2 ✅
- [ ] `docker compose ps` 2 healthy → step 2 ✅
- [ ] `psql $DATABASE_URL -c '\l'` kết nối → step 2 ✅
- [ ] `redis-cli -u $REDIS_URL ping` PONG → step 2 ✅
- [ ] `.env.example` đầy đủ → spec ✅
- [ ] `.env` trong .gitignore → đã verify (lines 15-17) ✅
- [ ] Volume persist sau restart → named volume `sa-postgres-data` ✅
- [ ] Không expose port thừa → `127.0.0.1:` binding ✅

---

## Followup for T-003 (Prisma migration) — RESOLVED during T-002 verification

**Original concern:** Prisma `migrate dev` needs CREATEDB privilege for shadow database.

**Discovery during T-002 verification (2026-04-15):** When `POSTGRES_USER` is set in the postgres image bootstrap, the entrypoint script creates that user as **superuser** (which implicitly has CREATEDB). Verified via `docker exec sa-postgres psql -U sa_app -d smart_attendance -c '\l'` — `sa_app` is owner of all databases including `template0`/`template1`, confirming superuser.

**Conclusion:** No `init.sql` needed for T-003. `prisma migrate dev` will work out-of-the-box with `sa_app`.

**Trade-off note:** `sa_app` having superuser in dev is acceptable for MVP. Production deployment (out of scope) should use a separate non-superuser app role with explicit grants — document this in production hardening guide later.
