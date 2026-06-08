#!/usr/bin/env bash
# =====================================================
# Backup do Postgres LOCAL da droplet (substitui o backup gerenciado da Neon)
# Gera um dump custom-format rotacionado. Pensado para rodar via cron.
#
# Cron diario as 03:00 (crontab -e):
#   0 3 * * * cd /opt/gestao-360-indicadores && ./scripts/backup-db.sh >> /var/log/g360-backup.log 2>&1
#
# Restaurar um backup:
#   docker compose -f docker-compose.droplet.yml exec -T postgres \
#     pg_restore -U g360 -d g360 --clean --if-exists --no-owner --no-privileges < db-backups/g360-XXXX.dump
#
# Variaveis (opcionais):
#   BACKUP_DIR (default ./db-backups)   KEEP (default 14 backups mantidos)
#
# Copia OFF-SITE (recomendado — backup no mesmo disco nao protege contra perda
# do droplet). Habilite no .env com a aws-cli instalada na droplet:
#   OFFSITE_BACKUP=1
#   S3_ENDPOINT=https://nyc3.digitaloceanspaces.com   (endpoint do seu Space)
#   S3_BUCKET=meu-space/g360                            (nome do Space + prefixo)
#   AWS_ACCESS_KEY_ID=...      AWS_SECRET_ACCESS_KEY=...  (chaves do Spaces)
# Instalar aws-cli: apt-get install -y awscli   (ou: pip install awscli)
# Retencao remota: configure uma Lifecycle Rule no proprio Space.
# =====================================================
set -euo pipefail

COMPOSE_FILE="docker-compose.droplet.yml"
BACKUP_DIR="${BACKUP_DIR:-./db-backups}"
KEEP="${KEEP:-14}"

cd "$(dirname "$0")/.."
[ -f ".env" ] && { set -a; . ./.env; set +a; }
POSTGRES_USER="${POSTGRES_USER:-g360}"
POSTGRES_DB="${POSTGRES_DB:-g360}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/g360-$STAMP.dump"

if ! docker compose -f "$COMPOSE_FILE" exec -T postgres \
      pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges -Fc > "$OUT"; then
  echo "[$(date -Is)] FALHA no backup (pg_dump). Removendo arquivo parcial." >&2
  rm -f "$OUT"
  exit 1
fi

# Rotaciona: mantem apenas os $KEEP backups mais recentes.
ls -1t "$BACKUP_DIR"/g360-*.dump 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f

echo "[$(date -Is)] Backup OK: $OUT ($(du -h "$OUT" | cut -f1)). Mantidos os $KEEP mais recentes."

# --- Copia off-site (opcional): DigitalOcean Spaces / S3 ---
if [ "${OFFSITE_BACKUP:-0}" = "1" ]; then
  if command -v aws >/dev/null 2>&1 && [ -n "${S3_BUCKET:-}" ] && [ -n "${S3_ENDPOINT:-}" ]; then
    if aws s3 cp "$OUT" "s3://$S3_BUCKET/$(basename "$OUT")" --endpoint-url "$S3_ENDPOINT" --only-show-errors; then
      echo "[$(date -Is)] Off-site OK: s3://$S3_BUCKET/$(basename "$OUT")"
    else
      echo "[$(date -Is)] AVISO: falha no envio off-site (backup local preservado)." >&2
    fi
  else
    echo "[$(date -Is)] AVISO: OFFSITE_BACKUP=1 mas falta aws-cli ou S3_BUCKET/S3_ENDPOINT. Pulei o off-site." >&2
  fi
fi
