# syntax=docker/dockerfile:1.7

# ============================================================
# Stage 1: build — full deps + Prisma generate + Nx build
# ============================================================
FROM node:20-alpine AS build
RUN apk add --no-cache openssl libc6-compat
RUN corepack enable && corepack prepare pnpm@10.18.1 --activate
WORKDIR /workspace

# Lockfile + manifests first for layer cache
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* .npmrc* ./
COPY nx.json tsconfig.base.json ./
COPY prisma ./prisma

# Install full deps (devDeps needed for nx build)
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Copy the rest of the workspace (source)
COPY apps ./apps
COPY libs ./libs

# Generate Prisma client into root node_modules
RUN pnpm prisma generate

# Build API (webpack outputs dist/apps/api/{main.js,package.json,pnpm-lock.yaml,assets/})
RUN pnpm nx build api --configuration=production --skip-nx-cache

# ============================================================
# Stage 2: prod-deps — install runtime deps inside dist
# ============================================================
FROM node:20-alpine AS prod-deps
RUN apk add --no-cache openssl libc6-compat
RUN corepack enable && corepack prepare pnpm@10.18.1 --activate
WORKDIR /app

# Copy webpack output (has its own package.json + pnpm-lock.yaml with only runtime deps)
COPY --from=build /workspace/dist/apps/api/ ./
# Copy Prisma schema next to package.json so prisma generate has a default location
COPY --from=build /workspace/prisma ./prisma

# Limit Prisma binary engines to the Alpine target only (skip darwin/windows/debian).
# Without this, @prisma/client pulls every engine binary (~70MB extra).
ENV PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x

# Install ONLY production deps (skip optional + scripts to keep node_modules lean).
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --prod --frozen-lockfile --ignore-scripts \
                 --node-linker=hoisted --shamefully-hoist=false

# Generate Prisma client explicitly (postinstall scripts were skipped above).
RUN pnpm exec prisma generate --schema=./prisma/schema.prisma

# Drop docs, tests, source maps, TypeScript .d.ts files from runtime tree to shrink image.
# typescript is a peer-dep dragged in by Prisma/class-validator but not needed at runtime.
# Prisma client ships WASM query compilers for every supported DB — keep only postgresql.
RUN find node_modules \( \
      -name '*.md' -o -name '*.markdown' -o -name 'CHANGELOG*' -o -name 'README*' \
      -o -name 'LICENSE*' -o -name '*.ts' -o -name '*.d.ts' \
      -o -name '*.map' -o -name '.github' -o -name '__tests__' -o -name 'test' -o -name 'tests' \
      -o -name '.eslintrc*' -o -name '.prettierrc*' -o -name 'tsconfig*.json' \
    \) -prune -exec rm -rf {} + 2>/dev/null || true \
    && rm -rf node_modules/typescript node_modules/.cache 2>/dev/null || true \
    && find node_modules/@prisma/client/runtime \
         \( -name 'query_compiler_bg.cockroachdb*' \
         -o -name 'query_compiler_bg.mysql*' \
         -o -name 'query_compiler_bg.sqlite*' \
         -o -name 'query_compiler_bg.sqlserver*' \
         -o -name 'edge*' \) -delete 2>/dev/null || true \
    && rm -rf node_modules/date-fns/fp 2>/dev/null || true \
    && find node_modules/date-fns/locale -mindepth 1 -maxdepth 1 \
         -not -name 'en-US*' -not -name '_lib' \
         -exec rm -rf {} + 2>/dev/null || true

# ============================================================
# Stage 3: runtime — minimal alpine + tini + non-root
# ============================================================
FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl libc6-compat tini
WORKDIR /app
ENV NODE_ENV=production \
    API_PORT=3000

# Copy fully-prepared /app from prod-deps stage in ONE layer with correct ownership.
# Using --chown here avoids a duplicate-layer bloat (a follow-up `chown -R` would
# rewrite every file's metadata into a new layer ~equal to the source layer's size).
COPY --from=prod-deps --chown=node:node /app ./
COPY --chown=node:node docker/api-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

USER node
EXPOSE 3000

# Zero-dep healthcheck via Node's built-in http module
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/api/v1/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/entrypoint.sh"]
CMD ["node", "main.js"]
