# Deploy manual na Droplet (Gestão 360)

Guia rápido para fazer deploy e operar a produção direto no console da droplet.

- **Servidor:** DigitalOcean Droplet `165.22.176.248`
- **Pasta do projeto:** `/opt/gestao-360-indicadores`
- **Compose de produção:** `docker-compose.droplet.yml`
- **Banco de dados:** **Postgres local** no próprio droplet (serviço `postgres` do compose, container `g360-postgres`, volume `g360_pgdata`). Desde 2026-10, depois que a DigitalOcean eliminou o droplet antigo e o banco gerenciado por falta de pagamento. O `DATABASE_URL`/`DIRECT_URL` vêm do `.env` da droplet e apontam para `postgres:5432`.

> Acesso SSH (da sua máquina): `ssh -i ~/.ssh/beeeyes_digitalocean root@165.22.176.248`

---

## 1. Deploy padrão (o caminho normal)

No console da droplet:

```bash
cd /opt/gestao-360-indicadores
make deploy
```

`make deploy` roda `scripts/deploy.sh`, que faz, em ordem:
1. `git pull --ff-only` (traz o código novo do GitHub, branch `main`)
2. Para o Collabora durante o build (libera memória na droplet)
3. Build das imagens Docker **API** e depois **Web** (sequencial, para não estourar a RAM)
4. `docker compose up -d --remove-orphans` (sobe os containers)
5. `prisma migrate deploy` (aplica migrations pendentes no banco gerenciado)

Ao final, mostra o status dos containers. **Site:** https://gestao360.org

> Antes de rodar, garanta que o código já está no `main` do GitHub (merge da sua branch de feature em `main` + push). O deploy sempre puxa o `main`.

---

## 2. Passo a passo manual (equivalente ao deploy.sh)

Se quiser controlar etapa por etapa:

```bash
cd /opt/gestao-360-indicadores

# 1) Atualizar o código
git pull --ff-only

# 2) (opcional) Liberar memória durante o build
docker compose -f docker-compose.droplet.yml stop collabora

# 3) Build (sequencial — a droplet tem pouca RAM)
docker compose -f docker-compose.droplet.yml build --pull api
docker compose -f docker-compose.droplet.yml build --pull web

# 4) Subir tudo
docker compose -f docker-compose.droplet.yml up -d --remove-orphans

# 5) Aplicar migrations no banco gerenciado
docker compose -f docker-compose.droplet.yml exec -T api ./node_modules/.bin/prisma migrate deploy

# 6) Conferir
docker compose -f docker-compose.droplet.yml ps
```

---

## 3. Comandos operacionais do dia a dia

```bash
cd /opt/gestao-360-indicadores

# Status dos containers
docker compose -f docker-compose.droplet.yml ps

# Logs (ao vivo)
docker compose -f docker-compose.droplet.yml logs -f --tail=100 api
docker compose -f docker-compose.droplet.yml logs -f --tail=100 web
docker compose -f docker-compose.droplet.yml logs -f --tail=100 caddy

# Reiniciar só um serviço
docker compose -f docker-compose.droplet.yml restart api
docker compose -f docker-compose.droplet.yml restart web

# Recriar a API lendo o .env de novo (ex.: depois de mudar o .env)
docker compose -f docker-compose.droplet.yml up -d --force-recreate api
```

Health check rápido (de qualquer lugar):
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://gestao360.org/api/health   # deve ser 200
```

---

## 4. Banco de dados (Postgres local)

As URLs de conexão ficam no `.env` da droplet (`DATABASE_URL` e `DIRECT_URL`) e apontam para `postgres:5432/g360`.
**Regra:** as duas apontam para o **mesmo** banco (a tela Configurações > Banco de Dados usa o `DIRECT_URL`) e a senha delas é a de `POSTGRES_PASSWORD`.

Ver as URLs (com senha mascarada):
```bash
grep -E '^(DATABASE_URL|DIRECT_URL)=' /opt/gestao-360-indicadores/.env | sed -E 's#(postgres(ql)?://)[^@]+@#\1***@#'
```

Conectar via `psql` para inspeção (dentro do próprio container, sem senha):
```bash
docker compose -f docker-compose.droplet.yml exec postgres \
  psql -U g360 -d g360 \
  -c 'SELECT (SELECT count(*) FROM "User") users, (SELECT count(*) FROM "Company") empresas, (SELECT count(*) FROM "Indicator") indicadores;'
```

> Backups: **não há backup automático**. Use `scripts/backup-db.sh` no cron (diário) com cópia off-site (Spaces/S3). Em 2026-10 os dados de produção se perderam justamente por não haver cópia fora do provedor.

Dump manual (para um arquivo na droplet):
```bash
./scripts/backup-db.sh          # gera db-backups/g360-AAAAMMDD-HHMMSS.dump
```

Restaurar um dump: ver o cabeçalho de `scripts/backup-db.sh`.

---

## 5. Trocar o `.env` com segurança

Sempre faça backup antes de editar:
```bash
cd /opt/gestao-360-indicadores
cp .env .env.bak.$(date +%Y%m%d-%H%M%S)
nano .env          # edite o que precisar
docker compose -f docker-compose.droplet.yml up -d --force-recreate api web
```

---

## 6. Rollback (voltar para a versão anterior)

```bash
cd /opt/gestao-360-indicadores
git log --oneline -5                 # descubra o commit anterior
git checkout <commit-anterior>       # ex.: git checkout 23a8a4a
docker compose -f docker-compose.droplet.yml build --pull api web
docker compose -f docker-compose.droplet.yml up -d --remove-orphans
# volte para o main depois de estabilizar: git checkout main
```
> Rollback de banco (migration) é mais delicado — prefira restaurar de backup do DigitalOcean se necessário.

---

## 7. Armadilhas conhecidas

- **Memória apertada:** a droplet tem ~4 GB de RAM + 4 GB de swap (desde 2026-10; antes ~2 GB). O `deploy.sh` para o Collabora durante o build de propósito. Se um build falhar por OOM, rode os builds um de cada vez (`build api`, depois `build web`).
- **`--remove-orphans`:** remove containers que não estão no compose. É seguro enquanto o serviço `postgres` estiver no `docker-compose.droplet.yml`. Se um dia o banco sair do compose, confira antes: o container seria removido (o volume `g360_pgdata` continua, mas nunca use `down -v`).
- **Prisma no container (pnpm):** o binário fica em `./node_modules/.bin/prisma` (dentro de `/app/apps/api`). Não use caminhos antigos tipo `../../node_modules/prisma/...`.
- **Socket.IO / WebSocket:** o Caddy já faz o upgrade automaticamente; não precisa configurar nada extra.
- **`.env`:** é ignorado pelo git — o `git pull` nunca sobrescreve. Guarde uma cópia segura fora da droplet.
