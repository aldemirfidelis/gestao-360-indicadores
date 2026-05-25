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

echo "[1/4] Atualizando codigo (git pull)..."
git pull --ff-only

echo ""
echo "[2/4] Build das imagens Docker (sequencial para poupar memoria)..."
docker compose -f "$COMPOSE_FILE" build --pull api
docker compose -f "$COMPOSE_FILE" build --pull web

echo ""
echo "[3/4] Subindo containers (zero downtime quando possivel)..."
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

echo ""
echo "[4/4] Status:"
docker compose -f "$COMPOSE_FILE" ps

echo ""
echo "Limpeza de imagens antigas..."
docker image prune -f > /dev/null

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
