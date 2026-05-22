# syntax=docker/dockerfile:1.7
# =====================================================
# Dockerfile da API NestJS (Gestão 360)
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
# set -ex: aborta no primeiro erro + loga cada comando
# Usamos pnpm exec dentro do diretorio para garantir que prisma generate
# resolve o binario e o schema corretamente (alguns ambientes pnpm tem
# resolucao diferente com --filter)
RUN set -ex \
    && echo "=== [1/3] Build @g360/shared ===" \
    && pnpm --filter @g360/shared run build \
    && ls -la packages/shared/dist \
    && echo "=== [2/3] Prisma generate ===" \
    && cd apps/api \
    && pnpm exec prisma generate --schema=prisma/schema.prisma \
    && ls -la ../../node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/ | head -10 \
    && cd /app \
    && echo "=== [3/3] Nest build ===" \
    && pnpm --filter @g360/api run build \
    && ls -la apps/api/dist

# Nota: NAO rodamos `pnpm prune --prod` aqui porque o pnpm em workspaces
# remove o node_modules de packages/shared/, quebrando a resolucao de
# transitive deps (zod, etc.) usadas no dist do shared em runtime.
# A imagem fica ~50 MB maior, troca aceitavel pela robustez.

# ----------- Stage: runtime -----------
FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3333 \
    API_PREFIX=api

# Copia node_modules, shared/dist e api/dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/pnpm-workspace.yaml /app/package.json ./
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/packages/shared/node_modules ./packages/shared/node_modules
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
# Usa ./node_modules/.bin/prisma (symlink pnpm gera no workspace local).
CMD ["sh", "-c", "if [ \"$SKIP_MIGRATE\" != \"1\" ]; then ./node_modules/.bin/prisma migrate deploy; fi && node dist/src/main.js"]
