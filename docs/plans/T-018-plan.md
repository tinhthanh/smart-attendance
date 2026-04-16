# T-018 Plan — Production Dockerfiles + 1-command compose deploy

> Generated 2026-04-16. Branch: `feature/production-docker`. 90' task, Day 5.

## Pre-work verify

| Check                                                                                                                                                                                                  | Status                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| Existing `docker-compose.yml` — postgres:16-alpine + redis:7-alpine only, healthchecks ✓, network `sa-net`, all bound 127.0.0.1                                                                        | ✅ extend                                |
| Existing Dockerfiles for api/portal                                                                                                                                                                    | ❌ none — create both                    |
| `.dockerignore` at root                                                                                                                                                                                | ❌ none — create                         |
| API build: webpack → `dist/apps/api/{main.js, package.json, pnpm-lock.yaml, assets/}` ; entry `src/main.ts` ; port `API_PORT \|\| 3000` ; prefix `api/v1` ; health `@Get('health')` → `/api/v1/health` | ✅ ready                                 |
| Portal build: `@angular/build:application` → `dist/apps/portal/browser/` ; `apiUrl: '/api/v1'` (relative — REQUIRES reverse proxy)                                                                     | ⚠ nginx must proxy                       |
| Prisma 2 migrations: `init` + `add_refresh_tokens` ; `prisma generate` via postinstall hook                                                                                                            | ✅ run `migrate deploy` at api boot      |
| package.json — no `engines`, no `packageManager`, no .nvmrc                                                                                                                                            | pin Node 20 + pnpm 10.18.1 in Dockerfile |
| `enableCors()` — NOT enabled in api → must keep portal/api same-origin via nginx                                                                                                                       | ✅ design accommodated                   |
| Webpack `optimization: false`                                                                                                                                                                          | leave as-is (scope creep to enable)      |
| Mobile app                                                                                                                                                                                             | ⛔ NOT dockerized per requirement        |

## File structure (new)

```
apps/api/
└── Dockerfile                  # NEW — multi-stage Node 20 alpine
apps/portal/
└── Dockerfile                  # NEW — multi-stage Node build → nginx alpine
docker/
├── nginx.conf                  # NEW — SPA fallback + /api/v1 proxy → api:3000
└── api-entrypoint.sh           # NEW — prisma migrate deploy && exec node main.js
.dockerignore                   # NEW — root
docker-compose.yml              # MODIFY — add api + portal services + healthchecks + depends_on
.env.example                    # MODIFY — add api/portal-specific defaults if missing
```

Total: 5 new + 2 modify. ~250 LoC config.

## apps/api/Dockerfile

```dockerfile
# syntax=docker/dockerfile:1.7

# ---------- Stage 1: deps ----------
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10.18.1 --activate
WORKDIR /workspace
COPY pnpm-lock.yaml package.json .npmrc* ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm fetch

# ---------- Stage 2: build ----------
FROM node:20-alpine AS build
RUN corepack enable && corepack prepare pnpm@10.18.1 --activate
RUN apk add --no-cache openssl
WORKDIR /workspace
COPY --from=deps /workspace /workspace
COPY . .
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=false
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --offline --frozen-lockfile
RUN pnpm prisma generate
RUN pnpm nx build api --configuration=production --skip-nx-cache
# Install runtime deps only (smaller node_modules in next stage)
RUN cd dist/apps/api && \
    --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --prod --frozen-lockfile --node-linker=hoisted

# ---------- Stage 3: runtime ----------
FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl tini
WORKDIR /app
ENV NODE_ENV=production \
    API_PORT=3000
COPY --from=build /workspace/dist/apps/api/ ./
COPY --from=build /workspace/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /workspace/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /workspace/prisma ./prisma
COPY docker/api-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh && \
    chown -R node:node /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/v1/health || exit 1
ENTRYPOINT ["/sbin/tini","--","/usr/local/bin/entrypoint.sh"]
CMD ["node","main.js"]
```

Notes:

- `--mount=type=cache` on build stages (BuildKit) for repeated pnpm fetches.
- `pnpm install --prod` inside `dist/apps/api/` — webpack output ships `package.json` so we can install runtime deps separately. Avoids hauling devDependencies into runtime.
- Prisma client copied via `node_modules/.prisma` + `node_modules/@prisma` — those are needed for runtime queries.
- `tini` as PID 1 for proper signal forwarding (BullMQ workers need clean SIGTERM).

## docker/api-entrypoint.sh

```sh
#!/bin/sh
set -e

echo "[entrypoint] running prisma migrate deploy..."
node ./node_modules/prisma/build/index.js migrate deploy --schema=./prisma/schema.prisma

echo "[entrypoint] starting node $@"
exec "$@"
```

`exec` so node inherits PID and tini can forward signals correctly.

## apps/portal/Dockerfile

```dockerfile
# syntax=docker/dockerfile:1.7

# ---------- Stage 1: build ----------
FROM node:20-alpine AS build
RUN corepack enable && corepack prepare pnpm@10.18.1 --activate
WORKDIR /workspace
COPY pnpm-lock.yaml package.json .npmrc* ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm fetch
COPY . .
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --offline --frozen-lockfile
RUN pnpm nx build portal --configuration=production --skip-nx-cache

# ---------- Stage 2: runtime (nginx) ----------
FROM nginx:1.27-alpine AS runtime
RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /workspace/dist/apps/portal/browser/ /usr/share/nginx/html/
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz || exit 1
# nginx:alpine already runs nginx as non-root via /docker-entrypoint.sh; default CMD is fine
```

## docker/nginx.conf

```nginx
server {
  listen 80 default_server;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  # Compression
  gzip on;
  gzip_vary on;
  gzip_proxied any;
  gzip_min_length 1024;
  gzip_types text/plain text/css application/javascript application/json image/svg+xml;

  # Reverse proxy /api/v1/* → api service (same origin from browser POV)
  location /api/v1/ {
    proxy_pass http://api:3000/api/v1/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 60s;
    # Stream CSV downloads (T-016)
    proxy_buffering off;
  }

  # Container healthcheck endpoint
  location = /healthz {
    access_log off;
    add_header Content-Type text/plain;
    return 200 'ok';
  }

  # Static assets — long cache
  location ~* \.(?:css|js|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|ico|webp)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    try_files $uri =404;
  }

  # SPA fallback — let Angular Router handle non-asset paths
  location / {
    try_files $uri $uri/ /index.html;
    add_header Cache-Control "no-cache, no-store, must-revalidate";
  }
}
```

## .dockerignore (root)

```
**/node_modules
**/dist
**/.nx
**/coverage
**/.cache
**/.angular
.git
.github
.vscode
.idea
*.log
.env
.env.*
!.env.example
docs/
README.md
PROMPT_LOG.md
ASSIGNMENT.md
*.md
!CLAUDE.md
docker-compose.yml
docker-compose.*.yml
**/*.spec.ts
**/*.e2e-spec.ts
test-output/
tmp/
.claude/
```

(Keep CLAUDE.md so build can reference if needed; exclude generated docs.)

## docker-compose.yml — full new file

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: sa-postgres
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-smart_attendance}
      POSTGRES_USER: ${POSTGRES_USER:-sa_app}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?required}
    ports:
      - '127.0.0.1:${POSTGRES_PORT:-5433}:5432'
    volumes:
      - sa-postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD', 'pg_isready', '-U', '${POSTGRES_USER:-sa_app}', '-d', '${POSTGRES_DB:-smart_attendance}']
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    networks: [sa-net]
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: sa-redis
    ports:
      - '127.0.0.1:${REDIS_PORT:-6380}:6379'
    volumes:
      - sa-redis-data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 3s
      retries: 5
      start_period: 5s
    networks: [sa-net]
    restart: unless-stopped

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    image: smart-attendance-api:latest
    container_name: sa-api
    environment:
      NODE_ENV: production
      API_PORT: 3000
      DATABASE_URL: postgresql://${POSTGRES_USER:-sa_app}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-smart_attendance}?schema=public
      REDIS_URL: redis://redis:6379
      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET:?required}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET:?required}
      JWT_ACCESS_TTL: ${JWT_ACCESS_TTL:-15m}
      JWT_REFRESH_TTL: ${JWT_REFRESH_TTL:-7d}
    ports:
      - '127.0.0.1:${API_PORT:-3000}:3000'
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    healthcheck:
      test: ['CMD', 'wget', '-qO-', 'http://127.0.0.1:3000/api/v1/health']
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
    networks: [sa-net]
    restart: unless-stopped

  portal:
    build:
      context: .
      dockerfile: apps/portal/Dockerfile
    image: smart-attendance-portal:latest
    container_name: sa-portal
    ports:
      - '127.0.0.1:${PORTAL_PORT:-4200}:80'
    depends_on:
      api: { condition: service_healthy }
    healthcheck:
      test: ['CMD', 'wget', '-qO-', 'http://127.0.0.1/healthz']
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    networks: [sa-net]
    restart: unless-stopped

volumes:
  sa-postgres-data:
  sa-redis-data:

networks:
  sa-net:
    driver: bridge
```

Notable:

- `version:` field omitted (Compose v2 deprecated it).
- All ports bound to `127.0.0.1` (security default — no public exposure unless reverse proxy added later).
- `${VAR:?required}` syntax fails fast if .env missing critical secrets.
- `depends_on: condition: service_healthy` so api waits for db+redis healthy, portal waits for api healthy.

## .env.example update

Add if missing (existing file already has most):

```
# Production-only — generate via: openssl rand -base64 48
JWT_ACCESS_SECRET=replace_me_minimum_32_chars_long_random_string_here
JWT_REFRESH_SECRET=replace_me_different_minimum_32_chars_long_random_value
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
API_PORT=3000
PORTAL_PORT=4200
```

## Decisions — recommendations

| #   | Câu hỏi                  | Recommend                                                                                                     | Alt                                                                     |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | Node base image          | **`node:20-alpine`** — ~120MB, Prisma v6 supports linux-musl                                                  | `node:20-slim` (~250MB), `node:20` full (~400MB)                        |
| 2   | Portal API access        | **nginx in portal proxies `/api/v1/*` → api:3000** — same-origin, no CORS, matches existing relative `apiUrl` | Direct browser call requires `enableCors` + absolute URL — extra config |
| 3   | Prisma migrate timing    | **Entrypoint script** (`migrate deploy && exec node main.js`) — simple, no init container                     | Init container — over-engineered for MVP                                |
| 4   | Healthcheck interval     | **30s** for api + portal (10s for db+redis) — standard, low overhead                                          | 10s — log noise, no benefit                                             |
| 5   | Multi-platform           | **amd64 only** — MVP target, faster builds                                                                    | amd64+arm64 — nice for M-series Mac, defer to CI/CD                     |
| 6   | Non-root user            | **`USER node` (UID 1000)** built into Node image; nginx:alpine handles itself                                 | Custom user — unnecessary                                               |
| 7   | Layer caching            | **`pnpm fetch` in deps stage** + BuildKit cache mount                                                         | Combine — re-downloads on every code change                             |
| 8   | Build args vs env        | **`ENV NODE_ENV=production`** in runtime stage — settable at runtime via compose env                          | Build-arg — bakes into image, less flexible                             |
| 9   | compose `version:` field | **Omit** — Compose v2 deprecated                                                                              | Keep `version: '3.9'` — works but warns                                 |
| 10  | Image tagging            | **`smart-attendance-api:latest` + `smart-attendance-portal:latest`** in compose `image:`                      | Versioned tags — deferred to CI                                         |

## Extra decisions

- **D-extra-1**: `tini` as PID 1 for api container — proper SIGTERM forwarding to Node + BullMQ workers. Avoids zombie processes when k8s/compose stops container.
- **D-extra-2**: `pnpm install --prod` inside `dist/apps/api/` (uses webpack output's `package.json` + `pnpm-lock.yaml`). Final node_modules ~80MB vs full ~600MB.
- **D-extra-3**: Prisma client copied separately (`node_modules/.prisma` + `@prisma`) because webpack externalizes Prisma but generated client lives outside dist — must ship explicitly.
- **D-extra-4**: nginx `proxy_buffering off` for `/api/v1/*` to support T-016 streaming CSV downloads.
- **D-extra-5**: `restart: unless-stopped` on all services — auto-recover after host reboot or transient crash.
- **D-extra-6**: `.dockerignore` whitelists `CLAUDE.md` (referenced by code? — actually not, but small file, safe to keep). Excludes `docker-compose*.yml` because Docker doesn't need it inside build context.

## Risk

| Risk                                                                                                                                   | Mitigation                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Prisma binary engine mismatch on Alpine                                                                                                | Prisma v6 ships `linux-musl-openssl-3.0.x` engine — ensure Alpine has `openssl` package (already in build + runtime)                                                                 |
| Webpack output `package.json` references workspace deps (e.g. `@smart-attendance/shared/utils` paths) — `pnpm install --prod` may fail | Verify `dist/apps/api/package.json` content; if uses workspace refs, fall back to copying full root `node_modules` (production deps only via `pnpm install --prod` at root + filter) |
| Build context huge → slow build                                                                                                        | Aggressive `.dockerignore` (excludes node_modules, dist, .nx, coverage, docs); estimated context ≤30MB                                                                               |
| Migration race when scaling api > 1                                                                                                    | MVP single-instance; document for future: use init container or migration job before scale-out                                                                                       |
| `.env` accidentally committed via build context                                                                                        | `.dockerignore` excludes `.env` + `.env.*` (whitelists `.env.example`)                                                                                                               |
| Healthcheck `wget` not in alpine by default                                                                                            | `node:20-alpine` includes BusyBox `wget` ; `nginx:alpine` also has it. Verified.                                                                                                     |
| nginx upstream `api:3000` resolves before api healthy                                                                                  | `depends_on: api: condition: service_healthy` blocks portal start until api passes healthcheck                                                                                       |
| Image size budgets (api < 300MB, portal < 50MB)                                                                                        | Multi-stage + `--prod` install + alpine — expect api ~180MB, portal ~30MB. Verify via `docker images` after build                                                                    |
| BuildKit cache mounts unsupported on old Docker                                                                                        | Require Docker 23+ (default since 2023). Fail-friendly: still builds, just slower                                                                                                    |
| pnpm `--frozen-lockfile` fails if lockfile out of sync                                                                                 | CI gate already enforces; manual ops should `pnpm install` before docker-compose build                                                                                               |
| Port 4200 collision local dev                                                                                                          | Compose binds `127.0.0.1:4200` — kill local `nx serve portal` before `compose up`                                                                                                    |

## Testing

- **Build**:
  - `docker compose build api` → succeeds, image tagged
  - `docker compose build portal` → succeeds
  - `docker images smart-attendance-api smart-attendance-portal` → verify size budgets
- **Run**:
  - Stop existing dev postgres+redis containers (already named `sa-postgres`, `sa-redis` — same names should be replaced cleanly)
  - `docker compose up -d` → wait until all 4 services healthy (`docker compose ps` shows `(healthy)`)
- **Smoke**:
  - `curl http://localhost:3000/api/v1/health` → 200
  - `curl http://localhost:4200/healthz` → 200 'ok'
  - `curl http://localhost:4200/` → returns index.html
  - `curl http://localhost:4200/api/v1/health` → 200 (proxy works)
  - Login via portal browser → flow works end-to-end
  - `docker compose logs api | grep "migrate deploy"` → confirms entrypoint ran migrations
- **Tear down + replay**:
  - `docker compose down` (volumes preserved)
  - `docker compose up -d` again → no migration re-run, no data loss
  - `docker compose down -v` → wipes volumes; next `up` re-runs all migrations

## Execution steps (sau confirm)

1. Tạo `.dockerignore` ở root
2. Tạo `docker/nginx.conf`
3. Tạo `docker/api-entrypoint.sh` + `chmod +x`
4. Tạo `apps/api/Dockerfile`
5. Tạo `apps/portal/Dockerfile`
6. Modify `docker-compose.yml` — add `api` + `portal` services
7. Update `.env.example` nếu thiếu JWT keys
8. Stop bất kỳ local `nx serve` nào trên port 3000/4200
9. `docker compose build api` (verify build succeeds)
10. `docker compose build portal` (verify build succeeds)
11. `docker images | grep smart-attendance` (verify size < budget)
12. `docker compose down` (clean state)
13. `docker compose up -d`
14. `docker compose ps` until all 4 services `(healthy)`
15. Smoke test (8 cases below)
16. `docker compose down` (KHÔNG `-v` — keep data for inspection)
17. **Không commit**

## Smoke test (8 cases)

```bash
# 1. All services healthy
docker compose ps
# Expect: postgres, redis, api, portal — all (healthy)

# 2. API health
curl -fs http://localhost:3000/api/v1/health
# Expect: 200 OK

# 3. Portal health
curl -fs http://localhost:4200/healthz
# Expect: 200 'ok'

# 4. Portal serves SPA
curl -s http://localhost:4200/ | grep -i '<app-root\|<title'
# Expect: index.html content

# 5. Portal proxy → API
curl -fs http://localhost:4200/api/v1/health
# Expect: same as case 2

# 6. Login via portal proxy
TOKEN=$(curl -s -X POST http://localhost:4200/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@demo.com","password":"Admin@123"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['access_token'])")
echo "TOKEN=${TOKEN:0:20}..."
# Expect: non-empty token

# 7. Migrations applied
docker compose exec postgres psql -U sa_app -d smart_attendance \
  -c "SELECT migration_name FROM _prisma_migrations ORDER BY started_at;"
# Expect: 2 rows (init + add_refresh_tokens)

# 8. Restart resilience
docker compose restart api
sleep 15
curl -fs http://localhost:3000/api/v1/health
# Expect: 200 — entrypoint re-runs migrate deploy (no-op when up-to-date)
```

## Acceptance mapping (T-018 from tasks.md)

- [ ] `docker compose up --build` → all services healthy ✅
- [ ] api image < 300MB ✅ target ~180MB
- [ ] portal image < 50MB ✅ target ~30MB
- [ ] Non-root user inside containers ✅
- [ ] 1-command boot ✅
- [ ] Healthchecks for all services ✅

## Review checklist

- [ ] Multi-stage Dockerfiles ✅
- [ ] Non-root user ✅
- [ ] No source code in runtime image ✅ (only dist + node_modules)
- [ ] pnpm version pinned (10.18.1) ✅
- [ ] Image tags `smart-attendance-{api,portal}` ✅
- [ ] Healthcheck for all 4 services ✅
- [ ] `.env` excluded; `.env.example` only ✅
- [ ] Port bindings 127.0.0.1 only ✅
- [ ] Mobile NOT dockerized ✅

Reply `OK hết` hoặc `# + extra#` cần đổi → exec.
