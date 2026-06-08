#!/usr/bin/env bash
# =====================================================
# Migracao de dados: Neon (AWS) -> Postgres LOCAL da droplet
# Roda UMA vez, na droplet, em /opt/gestao-360-indicadores
#
# O que faz:
#   1. Sobe APENAS o servico `postgres` (banco local) e espera ficar healthy.
#   2. Faz pg_dump da Neon (origem) para um arquivo local (formato custom).
#   3. Restaura o dump no Postgres local (pg_restore).
#   4. Verifica e mostra um resumo.
#
# Pre-requisitos no .env (mesma pasta):
#   POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB  (banco local de destino)
#   NEON_SOURCE_URL  -> URL DIRECT da Neon (sem -pooler), com ?sslmode=require
#                       (ou passe como 1o argumento do script)
#
# IMPORTANTE: a versao do pg_dump precisa ser >= a versao do servidor Neon.
# Descubra a versao da Neon e ajuste PG_IMAGE se necessario:
#   psql "$NEON_SOURCE_URL" -c "show server_version;"
#   PG_IMAGE=postgres:17-alpine ./scripts/migrate-neon-to-droplet.sh
# =====================================================
set -euo pipefail

COMPOSE_FILE="docker-compose.droplet.yml"
# Neon do projeto roda PostgreSQL 17.x -> pg_dump precisa ser >= 17.
PG_IMAGE="${PG_IMAGE:-postgres:17-alpine}"
BACKUP_DIR="${BACKUP_DIR:-./db-backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"

cd "$(dirname "$0")/.."

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "Erro: $COMPOSE_FILE nao encontrado. Rode da raiz do projeto na droplet." >&2
  exit 1
fi
if [ ! -f ".env" ]; then
  echo "Erro: .env nao encontrado." >&2
  exit 1
fi

# Le variaveis do .env de forma SEGURA. NAO usamos 'source/. ./.env' porque o
# .env pode conter valores com espacos (ex.: PLATFORM_ADMIN_BOOTSTRAP_NAME=Platform
# Owner), que o bash interpretaria como comando e quebraria com 'set -e'.
read_env() { [ -f .env ] && sed -nE "s/^$1=//p" .env | head -1 | sed -E 's/^"//; s/"$//'; }

NEON_SOURCE_URL="${1:-$(read_env NEON_SOURCE_URL)}"
POSTGRES_USER="$(read_env POSTGRES_USER)"; POSTGRES_USER="${POSTGRES_USER:-g360}"
POSTGRES_DB="$(read_env POSTGRES_DB)"; POSTGRES_DB="${POSTGRES_DB:-g360}"

if [ -z "$NEON_SOURCE_URL" ]; then
  echo "Erro: defina NEON_SOURCE_URL no .env (URL DIRECT da Neon, sem -pooler) ou passe como argumento." >&2
  echo "Ex.: ./scripts/migrate-neon-to-droplet.sh 'postgresql://user:pass@ep-xxxx.us-east-2.aws.neon.tech/db?sslmode=require'" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
DUMP_FILE="$BACKUP_DIR/neon-$STAMP.dump"

echo "=========================================="
echo "  Migracao Neon -> Postgres local"
echo "  Imagem do client: $PG_IMAGE"
echo "  Destino: banco local '$POSTGRES_DB' (usuario '$POSTGRES_USER')"
echo "=========================================="

echo ""
echo "[1/4] Subindo o Postgres local e aguardando ficar saudavel..."
docker compose -f "$COMPOSE_FILE" up -d postgres
for i in $(seq 1 60); do
  if docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" -h 127.0.0.1 >/dev/null 2>&1; then
    echo "  Postgres pronto."
    break
  fi
  if [ "$i" = "60" ]; then echo "Erro: Postgres nao ficou pronto a tempo." >&2; exit 1; fi
  sleep 2
done

echo ""
echo "[2/4] pg_dump da Neon (pode levar varios minutos conforme o volume)..."
# Container efemero apenas para o dump; usa a internet (rede default) para a Neon.
docker run --rm -v "$(pwd)/$BACKUP_DIR:/dump" "$PG_IMAGE" \
  pg_dump "$NEON_SOURCE_URL" --no-owner --no-privileges --format=custom \
  -f "/dump/$(basename "$DUMP_FILE")"
echo "  Dump salvo em $DUMP_FILE ($(du -h "$DUMP_FILE" | cut -f1))."

echo ""
echo "[3/4] Restaurando no Postgres local (pg_restore --clean --if-exists)..."
echo "      Isso SUBSTITUI o conteudo atual do banco local '$POSTGRES_DB'."
printf "      Confirma? [s/N] "
read -r CONFIRM
if [ "$CONFIRM" != "s" ] && [ "$CONFIRM" != "S" ]; then
  echo "Abortado pelo usuario. O dump foi preservado em $DUMP_FILE."
  exit 0
fi
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  --no-owner --no-privileges --clean --if-exists < "$DUMP_FILE" || {
    echo "Aviso: pg_restore reportou erros (comum: DROP de objeto inexistente em banco vazio)." >&2
    echo "Verifique o resumo abaixo antes de seguir." >&2
  }

echo ""
echo "[4/4] Verificacao:"
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At \
  -c "select 'tabelas no schema public: ' || count(*) from information_schema.tables where table_schema='public';" \
  -c "select 'migrations aplicadas: ' || count(*) from _prisma_migrations;" 2>/dev/null || \
  echo "  (Nao foi possivel ler _prisma_migrations — rode 'prisma migrate deploy' no deploy seguinte.)"

echo ""
echo "=========================================="
echo "  Dump+restore concluidos."
echo "=========================================="
echo "Proximos passos:"
echo "  1. Confirme que o .env ja aponta DATABASE_URL/DIRECT_URL para o banco LOCAL"
echo "     (host 'postgres'), e nao mais para a Neon."
echo "  2. Rode: ./scripts/deploy.sh   (recria api/web com o .env novo + migrate deploy)"
echo "  3. Configure o backup automatico: ./scripts/backup-db.sh (e um cron diario)."
echo ""
