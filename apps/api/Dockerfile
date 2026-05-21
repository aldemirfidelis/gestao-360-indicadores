# syntax=docker/dockerfile:1.7
# =====================================================
# Dockerfile da API NestJS (Gestao 360 Indicadores)
# - Multi-stage com node:20-alpine
# - Compativel com pnpm workspaces e Prisma (Neon)
# - Roda migrate deploy + start no entrypoint
# =====================================================

ARG NODE_VERSION=20.17-alpine

FROM node:${NODE_VERSION} AS base
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    NODE_OPTIONS="--enable-source-maps"
# openssl: necessario para Prisma + Neon (SSL obrigatorio)
# libc6-compat: compatibilidade glibc para alguns binarios nativos
RUN apk add --no-cache libc6-compat openssl ca-certificates \
    && corepack enable \
    && corepack prepare pnpm@9.7.0 --activate
WORKDIR /app

# ----------- Stage: install + build -----------
FROM base AS build
# Copia manifests primeiro para aproveitar cache de install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# Install completo (precisa de devDeps para nest build / prisma generate / tsc)
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# Copia codigo
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Build em ordem: shared -> prisma -> api
RUN pnpm --filter @g360/shared build \
    && pnpm --filter @g360/api prisma generate \
    && pnpm --filter @g360/api build

# Remove devDeps para reduzir imagem final
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm prune --prod --no-optional

# ----------- Stage: runtime -----------
FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3333 \
    API_PREFIX=api

# Copia node_modules pruned, shared/dist e api/dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/pnpm-workspace.yaml /app/package.json ./
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma

WORKDIR /app/apps/api

# DigitalOcean injeta PORT automaticamente; default 3333
EXPOSE 3333

# Roda migrate deploy idempotente + start.
# Para pular migrations (ex.: pre-deploy job ja rodou), defina SKIP_MIGRATE=1.
CMD ["sh", "-c", "if [ \"$SKIP_MIGRATE\" != \"1\" ]; then node ../../node_modules/prisma/build/index.js migrate deploy; fi && node dist/main.js"]
