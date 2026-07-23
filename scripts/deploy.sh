#!/usr/bin/env bash
# =====================================================
# Deploy / Atualizacao da aplicacao na Droplet
# Roda em /opt/gestao-360-indicadores
# =====================================================

set -e

COMPOSE_FILE="docker-compose.droplet.yml"

echo "=========================================="
echo "  Gestao 360 - Deploy"
echo "=========================================="
echo ""

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "Erro: $COMPOSE_FILE nao encontrado. Rode este script da raiz do projeto."
  exit 1
fi

if [ ! -f ".env" ]; then
  echo "Erro: .env nao encontrado. Copie .env.droplet.example para .env e configure."
  exit 1
fi

echo "[1/5] Atualizando codigo (git pull)..."
git pull --ff-only
echo "Commit em deploy: $(git rev-parse --short HEAD) - $(git log -1 --pretty=%s)"

# Versão exibida no login: SemVer do pacote + commit exato implantado.
# O host da droplet não precisa ter Node instalado; o build Node roda no Docker.
PACKAGE_VERSION="$(sed -n 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' apps/web/package.json | head -n 1)"
if [ -z "$PACKAGE_VERSION" ]; then
  echo "Erro: nao foi possivel ler a versao de apps/web/package.json."
  exit 1
fi
export APP_VERSION="${PACKAGE_VERSION}+$(git rev-parse --short=8 HEAD)"
echo "Versao da aplicacao: ${APP_VERSION}"

echo ""
echo "[1.5/5] Liberando memoria: parando app (web+api) e Collabora durante o build..."
# Droplet de 1.9GB RAM: manter web+api rodando durante o 'next build' estoura a
# memoria (OOM -> "connection reset by peer" e deploy morto no meio). Paramos os
# containers da aplicacao durante o build e subimos tudo de novo no passo [3].
# Isso troca "zero downtime" (que nao cabe na RAM) por uma janela de ~1-2min de
# indisponibilidade, porem com build confiavel. Collabora volta no 'up'.
docker compose -f "$COMPOSE_FILE" stop web api collabora 2>/dev/null || true

# Rede de seguranca: a partir daqui o portal esta fora do ar (containers parados
# acima). Se o build falhar, o 'set -e' abortaria o script e o portal ficaria
# fora ate alguem intervir manualmente. O trap sobe de volta a versao anterior
# (as imagens antigas seguem no disco com a tag :latest) antes de abortar.
restore_on_failure() {
  echo ""
  echo "!! FALHA no build/deploy - restaurando os containers da versao anterior..."
  docker compose -f "$COMPOSE_FILE" up -d || true
  echo "!! Containers restaurados na versao anterior. Deploy abortado."
}
trap restore_on_failure ERR

echo "[2/5] Build das imagens Docker (sequencial para poupar memoria)..."
docker compose -f "$COMPOSE_FILE" build --pull api
docker compose -f "$COMPOSE_FILE" build --pull web

echo ""
echo "[3/5] Subindo containers (zero downtime quando possivel)..."
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

# Containers no ar: a partir daqui uma falha nao exige restaurar nada.
trap - ERR

echo ""
echo "[4/5] Aplicando migrations do banco..."
# WORKDIR do container = /app/apps/api. Em workspaces pnpm o pacote 'prisma'
# vive em node_modules/.pnpm/... e e exposto via symlink em ./node_modules/.bin/prisma
# (mesmo binario usado pelo CMD do Dockerfile). O caminho antigo
# ../../node_modules/prisma/build/index.js NAO existe no layout pnpm.
docker compose -f "$COMPOSE_FILE" exec -T api ./node_modules/.bin/prisma migrate deploy

echo ""
echo "[4.5/5] IndexNow (opcional)..."
if [ "${INDEXNOW_ENABLED:-0}" = "1" ]; then
  docker compose -f "$COMPOSE_FILE" exec -T web node /app/scripts/indexnow-submit.mjs || true
else
  echo "IndexNow desativado (defina INDEXNOW_ENABLED=1 e INDEXNOW_KEY para ativar)."
fi

echo ""
echo "[5/5] Status:"
docker compose -f "$COMPOSE_FILE" ps

echo ""
echo "Tamanho das imagens (acompanhe: se voltar a crescer, algo desnecessario"
echo "entrou na imagem - ver comentarios em apps/api/Dockerfile):"
docker images --format '  {{.Repository}}:{{.Tag}}\t{{.Size}}' \
  | grep -E '^  g360-(api|web):latest' || true

echo ""
echo "Limpeza de imagens antigas..."
docker image prune -f > /dev/null

# O cache de build do BuildKit cresce sem limite: medido em 2026-07-23 estava
# em 20,8 GB (16,3 GB recuperaveis) com o disco em 72%. Sem teto, um dia o
# deploy falha por disco cheio. 10 GB preserva o cache util (base + install)
# e descarta o excedente antigo.
echo "Limitando o cache de build a 10GB..."
docker builder prune -f --max-used-space 10GB > /dev/null 2>&1 \
  || echo "  (aviso: esta versao do Docker nao suporta --max-used-space; cache nao limitado)"

echo ""
echo "=========================================="
echo "  Deploy concluido!"
echo "=========================================="
echo ""
echo "Acesse: http://$(curl -s ifconfig.me 2>/dev/null || echo 'SEU_IP')"
echo ""
echo "Acompanhar logs:"
echo "  docker compose -f $COMPOSE_FILE logs -f"
echo ""
echo "Logs so da API:"
echo "  docker compose -f $COMPOSE_FILE logs -f api"
echo ""
