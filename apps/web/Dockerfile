# syntax=docker/dockerfile:1.7
# =====================================================
# Dockerfile do Frontend Next.js 14 (Gestão 360)
# - Multi-stage com output standalone
# - Compativel com pnpm workspaces
# =====================================================

ARG NODE_VERSION=20.17-alpine

FROM node:${NODE_VERSION} AS base
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    NODE_OPTIONS="--max-old-space-size=1536" \
    NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat \
    && corepack enable \
    && corepack prepare pnpm@9.7.0 --activate
WORKDIR /app

# ----------- Stage: install + build -----------
FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

# NEXT_PUBLIC_* precisa estar disponivel em build time
ARG NEXT_PUBLIC_API_URL=/api
ARG NEXT_PUBLIC_SITE_URL=https://gestao360.org
ARG NEXT_PUBLIC_WHATSAPP_NUMBER=5564981009108
ARG NEXT_PUBLIC_APP_NAME="Gestão 360"
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_WHATSAPP_NUMBER=$NEXT_PUBLIC_WHATSAPP_NUMBER

RUN pnpm --filter @g360/shared build \
    && pnpm --filter @g360/web build

# ----------- Stage: runtime -----------
FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

# Cria usuario nao-root
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Next standalone inclui o minimo necessario para rodar (server.js + node_modules tracados)
# Estrutura do standalone em monorepo: apps/web/server.js + apps/web/.next/static
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --chown=nextjs:nodejs scripts ./scripts

USER nextjs
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
