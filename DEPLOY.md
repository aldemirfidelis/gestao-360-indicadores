# Deploy em DigitalOcean App Platform + Neon Postgres

> ⚠️ **OBSOLETO.** Este guia (App Platform + Neon) **não é mais o setup de produção**.
> A produção roda numa **Droplet** com **Postgres local** — veja `DEPLOY-DROPLET.md`,
> `docker-compose.droplet.yml` e `scripts/deploy.sh` (`make deploy`). Mantido só por referência.

Este guia leva a aplicacao de zero a producao em ~20 min, **sem servidor para gerenciar**:

- **Banco**: Neon (Postgres serverless, free tier generoso)
- **App (API + Web)**: DigitalOcean App Platform (Dockerfile builds)
- **DNS opcional**: dominio customizado em ~5 min

---

## Sumario

1. [Pre-requisitos](#1-pre-requisitos)
2. [Provisionar Neon Postgres](#2-provisionar-neon-postgres)
3. [Subir codigo para o GitHub](#3-subir-codigo-para-o-github)
4. [Criar o app na DigitalOcean](#4-criar-o-app-na-digitalocean)
5. [Configurar secrets](#5-configurar-secrets)
6. [Primeiro deploy e seed inicial](#6-primeiro-deploy-e-seed-inicial)
7. [Dominio customizado (opcional)](#7-dominio-customizado-opcional)
8. [Manutencao](#8-manutencao)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Pre-requisitos

- Conta no [GitHub](https://github.com) (repo privado ou publico)
- Conta no [Neon](https://neon.tech) (free tier)
- Conta na [DigitalOcean](https://m.do.co/c/) com forma de pagamento (App Platform comeca em ~$5/mes por servico)
- (Opcional) `doctl` CLI: `brew install doctl` ou `winget install DigitalOcean.Doctl`
- Local: Node 20+, pnpm 9+

> **Custo estimado**: 2 servicos `basic-xxs` = ~$10/mes. Neon e gratis ate 0.5 GB de storage. Total: **~$10/mes** para um app corporativo de gestao.

---

## 2. Provisionar Neon Postgres

1. Va em <https://console.neon.tech/app/projects> e clique em **New Project**
2. **Nome**: `g360-prod` - **Region**: a mais proxima dos seus usuarios (ex.: `aws-us-east-2`)
3. Apos criado, abra **Connection Details**
4. Selecione o role `neondb_owner` (ou crie um role dedicado `g360_app`)
5. Copie as **duas** strings de conexao:
   - **Pooled connection** (com `-pooler` no host) -> sera o `DATABASE_URL`
   - **Direct connection** (sem `-pooler`) -> sera o `DIRECT_URL`
6. Garanta os parametros corretos:

   ```
   # DATABASE_URL (runtime, via pooler)
   postgresql://USER:PASS@ep-xxxxx-pooler.us-east-2.aws.neon.tech/g360?sslmode=require&pgbouncer=true&connect_timeout=15

   # DIRECT_URL (so prisma migrate; SEM pooler)
   postgresql://USER:PASS@ep-xxxxx.us-east-2.aws.neon.tech/g360?sslmode=require
   ```

7. (Opcional, recomendado) Habilite **IP allowlist** restringindo a faixa de IPs da DigitalOcean — ou deixe aberto se for proof-of-concept.

> **Por que duas URLs?** O Prisma precisa de uma conexao direta para migrations (transacoes longas que pgbouncer no modo transaction nao suporta). Para queries normais, o pooler economiza conexoes.

---

## 3. Subir codigo para o GitHub

```bash
# Dentro de d:\Projetos\gestao-indicadores-sqlite
git init
git add .
git commit -m "feat: app inicial pronto para deploy"
git branch -M main
git remote add origin git@github.com:SEU_USER/gestao-indicadores.git
git push -u origin main
```

**IMPORTANTE**: verifique que `.gitignore` esta excluindo `.env*` (exceto `.example`). Nunca commitar credenciais.

---

## 4. Criar o app na DigitalOcean

### Opcao A — Via painel web (mais facil para a 1a vez)

1. Va em <https://cloud.digitalocean.com/apps> e clique em **Create App**
2. **Source**: GitHub -> autorize a DigitalOcean a ler seu repo -> selecione `SEU_USER/gestao-indicadores`
3. **Branch**: `main` - **Source Directory**: `/`
4. Quando perguntar como detectar os componentes, escolha **Edit Plan** -> **Add Component** e crie DOIS servicos:
   - **api**: tipo Dockerfile, caminho `apps/api/Dockerfile`, porta interna `3333`, rota HTTP `/api` com "preserve path prefix" marcado
   - **web**: tipo Dockerfile, caminho `apps/web/Dockerfile`, porta interna `3000`, rota HTTP `/`
5. Em **Environment Variables** de cada servico, adicione as variaveis (ver secao 5)
6. **Tamanho**: `basic-xxs` para ambos (pode escalar depois)
7. **Region**: a mesma do Neon
8. **App name**: `gestao-360`
9. Clique em **Create Resources**

### Opcao B — Via `doctl` (mais reprodutivel)

```bash
# 1. Edite .do/app.yaml e troque "REPO_OWNER/REPO_NAME" pelo seu repo
# 2. Aplique:
doctl auth init
doctl apps create --spec .do/app.yaml

# Pegue o APP_ID:
doctl apps list

# Defina os secrets (alternativa ao painel):
doctl apps config set <APP_ID> \
  DATABASE_URL='postgresql://...-pooler.../g360?sslmode=require&pgbouncer=true' \
  DIRECT_URL='postgresql://.../g360?sslmode=require' \
  JWT_ACCESS_SECRET='...' \
  JWT_REFRESH_SECRET='...'

# Atualizacoes futuras do spec:
doctl apps update <APP_ID> --spec .do/app.yaml
```

---

## 5. Configurar secrets

No painel da DigitalOcean, em **Settings -> App-Level Environment Variables** (ou por servico), adicione:

| Variavel | Valor | Escopo | Tipo |
| --- | --- | --- | --- |
| `DATABASE_URL` | URL pooler do Neon (com `?sslmode=require&pgbouncer=true`) | API: Run + Build | **Secret** |
| `DIRECT_URL` | URL direta do Neon | API: Run + Build | **Secret** |
| `JWT_ACCESS_SECRET` | `openssl rand -base64 48` | API: Run | **Secret** |
| `JWT_REFRESH_SECRET` | `openssl rand -base64 48` (diferente) | API: Run | **Secret** |
| `JWT_ACCESS_TTL` | `15m` | API: Run | Texto |
| `JWT_REFRESH_TTL` | `7d` | API: Run | Texto |
| `API_CORS_ORIGIN` | `${APP_URL}` | API: Run | Texto |
| `NEXT_PUBLIC_API_URL` | `/api` | Web: **Build** | Texto |
| `NEXT_PUBLIC_APP_NAME` | `Gestão 360` | Web: **Build** | Texto |

> **Atencao**: `NEXT_PUBLIC_*` precisa estar em **BUILD_TIME** porque o Next.js os embuti no bundle. Se mudar depois, e necessario fazer rebuild.

Gerar secrets fortes:

```bash
# Mac/Linux
openssl rand -base64 48

# Windows PowerShell
[Convert]::ToBase64String((1..36 | ForEach-Object { Get-Random -Maximum 256 }))
```

---

## 6. Primeiro deploy e seed inicial

### Deploy automatico

Apos clicar em **Create Resources** (ou rodar `doctl apps create`), a DO comeca a construir. Acompanhe em **Activity**. Cada deploy:

1. Faz `docker build` usando o Dockerfile do servico
2. Sobe o container e roda o `CMD` (que para a API faz `prisma migrate deploy` antes do `node dist/main.js`)
3. Roteia trafego para a nova versao

A primeira build leva 5-10 min. Builds subsequentes ~2-3 min com cache.

### Seed inicial (popular dados demo)

Opcao 1 — **temporariamente** habilite o job no `.do/app.yaml`:

```yaml
jobs:
  - name: seed
    kind: POST_DEPLOY
    dockerfile_path: apps/api/Dockerfile
    run_command: cd apps/api && pnpm prisma:seed
    envs:
      - key: DATABASE_URL
        type: SECRET
      - key: DIRECT_URL
        type: SECRET
```

Apos rodar uma vez (verifique nos logs do job), **comente novamente** para nao re-rodar e duplicar dados.

Opcao 2 — Rodar localmente apontando para o Neon:

```bash
# Copie suas URLs do Neon para .env
DATABASE_URL=... DIRECT_URL=... pnpm --filter @g360/api prisma:seed
```

### Testar

- Acesse `https://<seu-app>.ondigitalocean.app/login`
- Login: `admin@demo.com` / `admin123`
- Health da API: `https://<seu-app>.ondigitalocean.app/api/health`

---

## 7. Dominio customizado (opcional)

1. Em **Settings -> Domains** do app, clique em **Add Domain**
2. Digite seu dominio (ex.: `gestao.suaempresa.com.br`)
3. A DO mostra os registros DNS a configurar (CNAME ou A)
4. Crie os registros no seu provedor DNS (Registro.br, Cloudflare, etc.)
5. Aguarde propagacao (5-30 min). Certificado SSL automatico via Let's Encrypt.
6. Atualize `API_CORS_ORIGIN` para `https://gestao.suaempresa.com.br` (ou deixe `${APP_URL}` que tambem funciona)

---

## 8. Manutencao

### Atualizacoes

`deploy_on_push: true` no `app.yaml` faz com que todo `git push origin main` dispare um novo deploy. Para deploy manual:

```bash
doctl apps create-deployment <APP_ID>
```

### Migrations do banco

Toda nova migration commitada e aplicada automaticamente no boot da API (`prisma migrate deploy`). Para evitar isso (ex.: aplicar em janela controlada):

1. Defina `SKIP_MIGRATE=1` no env do servico
2. Rode manualmente:

```bash
# Localmente, apontando para producao:
DATABASE_URL=... DIRECT_URL=... pnpm --filter @g360/api deploy:migrate
```

### Logs

```bash
# Tail dos logs do servico
doctl apps logs <APP_ID> api --follow
doctl apps logs <APP_ID> web --follow
```

Ou no painel: **Activity -> Logs**.

### Escalar

- **Vertical** (mais CPU/RAM): mude `instance_size_slug` no `.do/app.yaml`. Opcoes: `basic-xxs`, `basic-xs`, `basic-s`, `professional-xs` ...
- **Horizontal** (mais replicas): aumente `instance_count`. Prisma `migrate deploy` usa advisory lock — varias replicas competindo por migrate sao seguras.

### Backup do banco

Neon faz **point-in-time recovery** automatico (7 dias no free, 30 dias no pago). Para backup manual:

```bash
pg_dump "postgresql://...directurl..." -F c -f backup-$(date +%Y%m%d).dump
```

---

## 9. Troubleshooting

### Build da API falha em "prisma generate"
Verifique se `binaryTargets` no `schema.prisma` inclui `linux-musl-openssl-3.0.x`. Ja esta configurado.

### "Can't reach database server" no boot
- Confirme que `DATABASE_URL` esta com `?sslmode=require`
- Verifique que o IP allowlist do Neon (se ativo) inclui a DO
- Teste a URL localmente: `psql "$DATABASE_URL"`

### Web mostra "Failed to fetch" em todo lugar
- Inspecione o bundle: deve haver `/api` no source. Se aparecer `http://localhost:3333`, o `NEXT_PUBLIC_API_URL` nao foi setado em **build time**. Refaca o deploy apos corrigir.
- Verifique CORS na API: olhe os response headers, deve ter `Access-Control-Allow-Origin: <APP_URL>`.

### Migration travou
Conecte direto via `psql` usando `DIRECT_URL` e rode `SELECT * FROM _prisma_migrations ORDER BY started_at DESC LIMIT 5;` Se houver um registro com `finished_at NULL`, marque como aplicada manualmente ou rode `prisma migrate resolve --applied <nome>`.

### Cold start lento na primeira request
Neon pode "hibernar" no free tier. Primeira query do dia leva 2-5s. Considere upgrade ou use o endpoint de health (`/api/health`) como warmup numa cron externa (UptimeRobot).

### Build muito lento
- Habilite cache layers Docker: ja configurado via `--mount=type=cache` no Dockerfile
- Reduza imagens de instancia para economia (basic-xxs ja e o minimo)

### Mudei NEXT_PUBLIC_* e nada muda
Variaveis `NEXT_PUBLIC_*` sao **inlined** no build. Force rebuild: **Settings -> Force rebuild and deploy**.

---

## Apendice — checklist final

- [ ] `.env*` no `.gitignore`
- [ ] Secrets fortes em JWT_*_SECRET (min 32 chars, base64)
- [ ] Neon `IP allowlist` configurado para producao
- [ ] `DATABASE_URL` aponta para o POOLER, `DIRECT_URL` para o direto
- [ ] `NEXT_PUBLIC_API_URL=/api` em BUILD_TIME
- [ ] Backup periodico do Neon (PITR esta on por padrao)
- [ ] Healthcheck `/api/health` respondendo 200
- [ ] Login funciona com seed inicial; senha admin trocada
