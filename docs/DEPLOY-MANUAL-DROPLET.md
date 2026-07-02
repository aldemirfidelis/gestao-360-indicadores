# Deploy manual na Droplet (Gestão 360)

Guia rápido para fazer deploy e operar a produção direto no console da droplet.

- **Servidor:** DigitalOcean Droplet `159.89.91.222`
- **Pasta do projeto:** `/opt/gestao-360-indicadores`
- **Compose de produção:** `docker-compose.droplet.yml`
- **Banco de dados:** **DigitalOcean Managed PostgreSQL** (EXTERNO). O `DATABASE_URL`/`DIRECT_URL` vêm do `.env` da droplet. **Não há mais Postgres local** (o container `g360-postgres` é apenas fallback histórico e pode ser removido).

> Acesso SSH (da sua máquina): `ssh -i ~/.ssh/beeeyes_digitalocean root@159.89.91.222`

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

## 4. Banco de dados (Managed PostgreSQL)

As URLs de conexão ficam no `.env` da droplet (`DATABASE_URL` e `DIRECT_URL`).
**Regra:** as duas devem apontar para o **mesmo** banco gerenciado (a tela Configurações > Banco de Dados usa o `DIRECT_URL`).

Ver as URLs (com senha mascarada):
```bash
grep -E '^(DATABASE_URL|DIRECT_URL)=' /opt/gestao-360-indicadores/.env | sed -E 's#doadmin:[^@]*@#doadmin:***@#'
```

Conectar via `psql` para inspeção (usa a imagem postgres já presente; troque `SENHA`):
```bash
docker run --rm -e PGPASSWORD='SENHA' -e PGSSLMODE=require postgres:17-alpine \
  psql -h g360-do-user-35000047-0.k.db.ondigitalocean.com -p 25060 -U doadmin -d defaultdb \
  -c 'SELECT (SELECT count(*) FROM "User") users, (SELECT count(*) FROM "Company") empresas, (SELECT count(*) FROM "Indicator") indicadores;'
```

> Backups: o Managed PostgreSQL do DigitalOcean já faz **backup automático diário** (+ PITR). Backups adicionais podem ser feitos com `pg_dump` para um arquivo local.

Dump manual do banco gerenciado (para um arquivo na droplet):
```bash
docker run --rm -e PGPASSWORD='SENHA' -e PGSSLMODE=require postgres:17-alpine \
  pg_dump -h g360-do-user-35000047-0.k.db.ondigitalocean.com -p 25060 -U doadmin -d defaultdb \
  --no-owner --no-privileges -Fc > /root/g360_managed_$(date +%Y%m%d_%H%M%S).dump
```

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

- **Memória apertada:** a droplet tem ~2 GB. O `deploy.sh` para o Collabora durante o build de propósito. Se um build falhar por OOM, rode os builds um de cada vez (`build api`, depois `build web`).
- **`--remove-orphans`:** remove containers que não estão no compose. Hoje é seguro (o Postgres é externo). No passado, quando havia Postgres local, isso derrubava o banco — não é mais o caso.
- **Prisma no container (pnpm):** o binário fica em `./node_modules/.bin/prisma` (dentro de `/app/apps/api`). Não use caminhos antigos tipo `../../node_modules/prisma/...`.
- **Socket.IO / WebSocket:** o Caddy já faz o upgrade automaticamente; não precisa configurar nada extra.
- **`.env`:** é ignorado pelo git — o `git pull` nunca sobrescreve. Guarde uma cópia segura fora da droplet.
