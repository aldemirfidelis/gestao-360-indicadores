#!/usr/bin/env bash
# =====================================================
# Setup inicial da Droplet (Ubuntu 22.04/24.04)
# Roda como root (na primeira conexao via SSH)
#
# Uso:
#   curl -fsSL https://raw.githubusercontent.com/aldemirfidelis/gestao-360-indicadores/main/scripts/setup-droplet.sh | bash
#
# ... ou faca git clone primeiro e rode bash scripts/setup-droplet.sh
# =====================================================

set -e

REPO_URL="https://github.com/aldemirfidelis/gestao-360-indicadores.git"
APP_DIR="/opt/gestao-360-indicadores"

echo "=========================================="
echo "  Gestao 360 - Setup Droplet"
echo "=========================================="
echo ""

# Garante que esta rodando como root
if [ "$EUID" -ne 0 ]; then
  echo "Erro: rode este script como root (use 'sudo' ou conecte como root)"
  exit 1
fi

echo "[1/6] Atualizando sistema..."
apt-get update -qq
apt-get upgrade -y -qq

echo ""
echo "[2/6] Instalando dependencias basicas..."
apt-get install -y -qq \
  ca-certificates \
  curl \
  git \
  ufw \
  make \
  htop \
  wget

echo ""
echo "[3/6] Instalando Docker + Compose plugin..."
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sh > /dev/null
  systemctl enable --now docker
  echo "  Docker $(docker --version | awk '{print $3}' | tr -d ,) instalado"
else
  echo "  Docker ja instalado: $(docker --version)"
fi

echo ""
echo "[4/6] Configurando firewall UFW..."
ufw allow OpenSSH > /dev/null
ufw allow 80/tcp > /dev/null
ufw allow 443/tcp > /dev/null
echo "y" | ufw enable > /dev/null 2>&1 || true
echo "  Firewall ativo: SSH (22), HTTP (80), HTTPS (443)"

echo ""
echo "[5/6] Clonando repositorio em $APP_DIR..."
if [ -d "$APP_DIR/.git" ]; then
  echo "  Repo ja existe, fazendo pull..."
  cd "$APP_DIR"
  git pull
else
  git clone "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

echo ""
echo "[6/6] Preparando .env..."
if [ ! -f "$APP_DIR/.env" ]; then
  cp "$APP_DIR/.env.droplet.example" "$APP_DIR/.env"
  echo "  .env criado a partir do template"
  echo ""
  echo "  IMPORTANTE: edite o .env com seus secrets!"
  echo "    nano $APP_DIR/.env"
  echo ""
  echo "  Gere JWT secrets com:"
  echo "    openssl rand -base64 48"
else
  echo "  .env ja existe, mantido como esta"
fi

echo ""
echo "=========================================="
echo "  Setup concluido!"
echo "=========================================="
echo ""
echo "Proximos passos:"
echo ""
echo "  1. Edite o .env:"
echo "     nano $APP_DIR/.env"
echo ""
echo "  2. Faca o deploy:"
echo "     cd $APP_DIR && bash scripts/deploy.sh"
echo ""
echo "  3. Acompanhe os logs:"
echo "     cd $APP_DIR && docker compose -f docker-compose.droplet.yml logs -f"
echo ""
