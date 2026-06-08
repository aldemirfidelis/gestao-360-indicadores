# Banco Postgres local na Droplet (migração a partir da Neon)

## Por quê

A API roda na Droplet (DigitalOcean) e o banco fica no **Neon (AWS sa-east-1, São
Paulo)**. Cada query do Prisma atravessa a internet pública entre os provedores.

Medição real contra o Neon do projeto (`ep-soft-dew-...sa-east-1`):

| Métrica | Valor medido |
|---|---|
| `SELECT 1` morno (p50) | **~97 ms por ida-e-volta** |
| 1ª query após ociosidade (cold start do autosuspend) | **~1.058 ms** |
| Tamanho do banco | 35 MB |
| Tabelas / linhas | 238 / ~8.800 |

Como cada página faz vários grupos sequenciais de queries (e o `jwt.strategy` faz
1 lookup por request), ~10 idas-e-voltas viram **~1 s só de espera de rede** — e a
primeira requisição após ociosidade trava **>1 s** pelo cold start serverless.

Movendo o Postgres para a **própria droplet** (mesmo host da API), o RTT cai para
**<1 ms** e o cold start desaparece. O código já está bem batcheado (`Promise.all`)
e o schema tem ~655 índices, então o ganho aparece direto no carregamento. Com 35
MB, a migração leva segundos.

> O motor continua Postgres — não há troca de banco. Só muda a **localização**.

## Pré-requisitos

- Droplet com RAM suficiente para somar o Postgres (recomendado ≥ 2 GB; com
  Collabora ativo, ≥ 4 GB).
- `docker-compose.droplet.yml` já com o serviço `postgres` (este commit).
- Acesso à URL **DIRECT** da Neon (sem `-pooler`) para o dump.

## Passo a passo (cutover)

Tudo roda na droplet, em `/opt/gestao-360-indicadores`.

1. **Atualize o código** (traz o novo compose e os scripts):
   ```bash
   git pull --ff-only
   ```

2. **Edite o `.env`** com base no `.env.droplet.example`:
   - Defina `POSTGRES_USER`, `POSTGRES_PASSWORD` (senha forte), `POSTGRES_DB`.
   - Aponte `DATABASE_URL` e `DIRECT_URL` para o banco **local** (host `postgres`):
     ```
     DATABASE_URL=postgresql://g360:SENHA@postgres:5432/g360?schema=public&connection_limit=20
     DIRECT_URL=postgresql://g360:SENHA@postgres:5432/g360?schema=public
     ```
   - Informe a origem da Neon para o dump (use a URL **DIRECT**, sem `-pooler`;
     pode comentar depois):
     ```
     NEON_SOURCE_URL=postgresql://USER:PASS@ep-xxxx.sa-east-1.aws.neon.tech/db?sslmode=require
     ```

3. **(Recomendado) Pare a aplicação** para um dump consistente (evita escrita
   durante a cópia). Janela curta:
   ```bash
   docker compose -f docker-compose.droplet.yml stop api web
   ```

4. **Versão do Postgres:** o Neon deste projeto roda **17.10**, então tanto o
   serviço `postgres` do compose quanto o `migrate-neon-to-droplet.sh` já usam
   `postgres:17-alpine` (o `pg_dump` precisa ser ≥ a versão do servidor). Só
   precisa ajustar se a versão da Neon mudar:
   ```bash
   docker run --rm postgres:17-alpine psql "$NEON_SOURCE_URL" -c "show server_version;"
   ```
   > Se ajustar para 17, troque também a `image` do serviço `postgres` no compose
   > para `postgres:17-alpine` (a versão do servidor local deve ser ≥ a do dump).

5. **Migre os dados** (sobe o Postgres local, faz o dump da Neon e restaura):
   ```bash
   bash scripts/migrate-neon-to-droplet.sh
   ```
   Ele mostra ao final a contagem de tabelas e de migrations aplicadas.

6. **Suba tudo já apontando para o banco local** (recria api/web com o `.env`
   novo e roda `prisma migrate deploy`):
   ```bash
   bash scripts/deploy.sh
   ```

7. **Valide**: acesse a aplicação, faça login, abra algumas telas. Meça de novo o
   RTT (deve ficar < 3 ms):
   ```bash
   docker exec g360-api node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();(async()=>{const t=[];for(let i=0;i<21;i++){const s=process.hrtime.bigint();await p.\$queryRawUnsafe('SELECT 1');t.push(Number(process.hrtime.bigint()-s)/1e6)}t.shift();t.sort((a,b)=>a-b);console.log('warm min:',t[0].toFixed(2),'p50:',t[9].toFixed(2),'ms');await p.\$disconnect()})()"
   ```

8. **Backup automático** (substitui o gerenciado da Neon) — agende no cron:
   ```bash
   crontab -e
   # 0 3 * * * cd /opt/gestao-360-indicadores && ./scripts/backup-db.sh >> /var/log/g360-backup.log 2>&1
   ```
   Teste uma vez na mão: `bash scripts/backup-db.sh`.

## Rollback (voltar para a Neon)

Como a Neon não foi apagada, basta reverter o `.env` (URLs da Neon de volta) e
recriar os containers:
```bash
docker compose -f docker-compose.droplet.yml up -d --force-recreate api web
```
Os dados gravados no banco local **após** o cutover não estarão na Neon — por isso
faça o rollback cedo, se for o caso.

## Restaurar um backup local

```bash
docker compose -f docker-compose.droplet.yml exec -T postgres \
  pg_restore -U g360 -d g360 --clean --if-exists --no-owner --no-privileges \
  < db-backups/g360-AAAAMMDD-HHMMSS.dump
```

## Backup off-site (Spaces/S3) — recomendado

Backup no mesmo disco **não protege contra perda do droplet**. O `backup-db.sh` já
envia o dump para um DigitalOcean Space / S3 quando habilitado no `.env`:

```bash
# Pré-requisito na droplet:
apt-get install -y awscli            # ou: pip install awscli

# No .env:
OFFSITE_BACKUP=1
S3_ENDPOINT=https://nyc3.digitaloceanspaces.com   # endpoint do seu Space
S3_BUCKET=meu-space/g360                            # nome do Space + prefixo
AWS_ACCESS_KEY_ID=CHAVE_DO_SPACES
AWS_SECRET_ACCESS_KEY=SEGREDO_DO_SPACES
```

Retenção remota: configure uma **Lifecycle Rule** no próprio Space (ex.: expirar
após 30 dias). Teste: `bash scripts/backup-db.sh` e confira o objeto no Space.

## Operação / observações

- O Postgres fica **só na rede interna** do compose (`expose`, sem `ports`): não
  é acessível pela internet. Acesso externo apenas via `docker compose exec`.
- O volume `g360_pgdata` persiste os dados entre deploys/rebuilds.
- `db-backups/` e `*.dump` estão no `.gitignore` (contêm dados reais).
- Se faltar RAM, suba o droplet ou limite o Postgres com `command` no serviço
  (ex.: `-c shared_buffers=256MB -c max_connections=50`).
