# syntax=docker/dockerfile:1.7

# ============================================================
# Stage 1: build — Angular production build
# ============================================================
FROM node:20-alpine AS build
RUN corepack enable && corepack prepare pnpm@10.18.1 --activate
WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* .npmrc* ./
COPY nx.json tsconfig.base.json ./
COPY prisma ./prisma

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY apps ./apps
COPY libs ./libs

# Angular @angular/build:application -> dist/apps/portal/browser/
RUN pnpm nx build portal --configuration=production --skip-nx-cache

# ============================================================
# Stage 2: runtime — nginx alpine serves static SPA + proxies /api/v1
# ============================================================
FROM nginx:1.27-alpine AS runtime
RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /workspace/dist/apps/portal/browser/ /usr/share/nginx/html/
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz || exit 1
