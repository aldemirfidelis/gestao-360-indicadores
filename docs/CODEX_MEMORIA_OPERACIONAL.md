# Memoria Operacional do Projeto

Atualizada em: 2026-11-02

Este arquivo deve ser lido antes de qualquer tarefa no repositorio
`gestao-360-indicadores`. Ele registra o estado operacional vigente. Quando
outros documentos divergirem deste arquivo, valide primeiro a configuracao real
do repositorio e do droplet antes de executar qualquer comando.

## Regras Inviolaveis

- Nunca realizar commit, push ou deploy automaticamente.
- Antes de publicar, mostrar ao usuario o resumo das alteracoes e aguardar um
  `OK` explicito.
- Preservar alteracoes locais ou remotas feitas pelo usuario, por outra IA ou por
  outro processo.
- Nunca commitar `.env`, backups, dumps ou credenciais.
- Nunca exibir credenciais completas em logs. Ao inspecionar URLs de banco,
  mascarar usuario e senha.
- O banco de producao e o **Postgres local no droplet** (servico `postgres` do
  `docker-compose.droplet.yml`, volume `g360_pgdata`), por decisao do usuario em
  2026-10-07. Nao trocar de provedor (gerenciado, Neon etc.) sem pedido
  explicito.
- Nunca apagar o volume `g360_pgdata`: nada de `docker compose down -v`,
  `docker volume rm` ou `docker volume prune -a` no servidor de producao (Vultr
  desde 2026-11-01). O mesmo vale para os volumes `zapfacil_*`.
- O Postgres de desenvolvimento via `docker-compose.yml` na maquina local foi
  autorizado pelo usuario em 2026-10-07 e nunca deve receber dados reais.
- Nao executar seeds em producao sem autorizacao especifica. Alguns seeds limpam
  e recriam dados.

## Producao na Vultr (desde 2026-11-01)

Decisao do usuario em 2026-11-01: sair da DigitalOcean para a Vultr, levando
Gestao 360 **e** ZapFacil. Virada autorizada pelo usuario e feita no mesmo dia.
**A producao agora e o servidor Vultr `45.32.5.196`.** Onde este arquivo fala
em "droplet" para operar a aplicacao (pre-flight, deploy, validacao,
diagnostico), vale o servidor Vultr: mesmo diretorio
`/opt/gestao-360-indicadores`, mesmo `docker-compose.droplet.yml`, mesmo
`make deploy`. O ZapFacil fica em `/opt/zapfacil` (`docker compose`, com
`COMPOSE_FILE` no `.env` incluindo `docker-compose.proxy.yml`, frontend na rede
`gestao-360-indicadores_g360` como `zapfacil-web`).

Servidor novo:

- IP `45.32.5.196`, regiao New Jersey, 4 vCPU, 8 GB de RAM, 160 GB SSD, swap
  de 8 GB (ja vem da Vultr), Ubuntu 26.10, kernel 7.3. Auto Backups da Vultr
  ligado.
- SSH: alias `g360-vultr` no `~/.ssh/config` da maquina Windows, mesma chave
  `~/.ssh/g360-droplet` do droplet. Login por senha desligado em
  `/etc/ssh/sshd_config.d/00-hardening.conf` (`PermitRootLogin
  prohibit-password`); a senha de root continua valendo so no console web da
  Vultr. A senha foi colada no chat em 2026-11-01: recomendar troca. Nunca
  grava-la em arquivo do repositorio.
- UFW ativo: 22/tcp, 80/tcp, 443/tcp e 443/udp. fail2ban ativo. Docker 29.7,
  Compose 2.40, buildx, make e git instalados.

Preparacao em 2026-11-01 (antes da virada, sem tocar a producao):

- Repositorio clonado em `/opt/gestao-360-indicadores`, `main` em `25258cb`
  (o mesmo commit da producao).
- `.env` copiado do droplet por pipe SSH, sem passar pelo disco local
  (SHA-256 identico, modo 600).
- Imagens `g360-api:latest` e `g360-web:latest` construidas com
  `APP_VERSION=0.1.0+25258cb1` (API 110 s, Web ~150 s).
- Ensaio da migracao: `pg_dump` do droplet restaurado no `g360-postgres` da
  Vultr (dump em `db-backups/migracao/ensaio.dump`); 538 tabelas, 153
  migrations e contagens identicas as da producao. Volumes `g360_storage`
  (1 arquivo, ~124 MB), `caddy_data` e `caddy_config` copiados com `tar`. So o
  Postgres esta rodando na Vultr; API, Web e Caddy **nao** foram iniciados
  (evita jobs agendados em duplicidade e emissao de certificado com o DNS
  ainda no droplet).

Virada em 2026-11-01 (22:08:51Z a 22:13:12Z, ~4,5 min fora do ar):

- Droplet: parados `g360-web`, `g360-api` e frontend/api/worker do ZapFacil.
  Dumps finais guardados nos dois servidores em
  `db-backups/pre-vultr-20261101/` (`g360-20261101T220851Z.dump`, SHA-256
  `c2de47ab...863b`; `zapfacil-20261101T220851Z.dump`, SHA-256
  `5c425e99...d36f`). Copia direta servidor a servidor com `ssh -A` (agente
  local temporario; nenhuma chave deixada no droplet).
- Vultr: os dois bancos restaurados com contagem exata de linhas identica em
  todas as tabelas (g360: 538 tabelas / 3474 linhas; ZapFacil: 47 / 860).
  Volumes `zapfacil_redisdata`, `zapfacil_storage` e `g360_storage`
  recopiados. Imagens do ZapFacil levadas com `docker save | docker load`
  (mesmos IDs). Tudo `healthy`, `migrate status` em dia (153), versao
  `0.1.0+25258cb1`, certificados validos ate 2027-01 (copiados do droplet).
- Backup diario ligado na Vultr (cron 03:00 UTC, `scripts/backup-db.sh`,
  testado). Sem backup agendado do ZapFacil (tambem nao havia no droplet).
- Droplet `165.22.176.248` virou **so repasse**: o `g360-caddy` de la usa
  `Caddyfile.vultr-proxy` (copia no disco em `Caddyfile`; original em
  `Caddyfile.antes-vultr`) e manda `gestao360.org`, `www`, `zapfacil.net` e
  `www.zapfacil.net` para `https://45.32.5.196` mantendo o Host. Bancos e
  Redis do droplet parados, volumes preservados como contingencia; cron de
  backup do droplet comentado. Nao destruir o droplet sem OK do usuario.
- Pegadinha confirmada: o Caddyfile entra no container por bind mount de
  arquivo. Se o arquivo for trocado por outro inode (`git pull`, editor que
  regrava), o container continua vendo a versao antiga e `caddy reload` carrega
  a velha. Depois de mudar o Caddyfile, recriar o container
  (`docker compose -f docker-compose.droplet.yml up -d --force-recreate caddy`)
  ou recarregar a partir de uma copia feita com `docker cp`.

DNS (2026-11-02):

- Dominios registrados na HostGator (registrador tecnico PublicDomainRegistry;
  `gestao360.org` expira 2027-05-27, `zapfacil.net` 2027-10-02). Em
  2026-11-02 o usuario criou as zonas no DNS da Vultr e trocou os nameservers
  na HostGator para `ns1.vultr.com`/`ns2.vultr.com`; os registros `.org` e
  `.net` ja delegam para a Vultr.
- Zonas na Vultr (TTL 300): `A @ -> 45.32.5.196`, `CNAME * -> <dominio>`
  (cobre `www`, `collabora` e subdominios de empresa) e um `MX 10 <dominio>`
  criado automaticamente pela Vultr (nao ha servidor de e-mail; pode ser
  apagado). Nao ha TXT/SPF/DKIM/DMARC.
- Certificado sob demanda de empresa emitido na Vultr em 2026-11-02
  (`demonstracao.gestao360.org`), confirmando que o Let's Encrypt ja ve o DNS
  novo. `teste.gestao360.org` nao e empresa (allow responde 404), entao nao
  recebe certificado: comportamento esperado.
- A zona antiga na DigitalOcean continua com `165.22.176.248`. Quem ainda
  consulta a DigitalOcean cai no droplet, que repassa para a Vultr. A
  configuracao de repasse nao grava log de acesso; para medir trafego residual
  usar `ss -Htn state established "( sport = :443 )"` no droplet.

Primeiro deploy na Vultr (2026-11-02, autorizado pelo usuario):

- Commits `23cac63` (correcoes da auditoria), `81f219f` (menu principal sem o
  grupo Gestao a Vista, secoes abertas por padrao e Gestao de Premio
  suspenso) e `b16441a` (docs). Push em `main`; imagens `0.1.0+b16441ae`.
- Imagens montadas antes com os containers no ar; `make deploy` levou 26 s
  (~20 s fora do ar). Rollback: `g360-api:rollback-25258cb-20261102` e
  `g360-web:rollback-25258cb-20261102`. Backup antes em `db-backups/`.
- Validado: health/home/login/demonstracao/portal 200, `/gestao-premio` 404,
  push do Apdata para o premio 404 ("Modulo aguardando reativacao"),
  `/eficacia` leva a `/actions?effectivenessStatus=PENDING`; na demonstracao,
  o menu mostra Meu Dia, Tarefas e os 10 itens antigos da Gestao a Vista como
  links diretos, sem erro de JS.
- Nesta maquina Windows o Git nao tem `user.name`/`user.email` globais: os
  commits usaram a autoria do usuario passada so no comando. O typecheck da
  API precisou de `--max-old-space-size=8192` aqui.

Pendente (com o usuario):

- Manter o droplet repassando ate a propagacao terminar (delegacao `.net`
  tem TTL de ate 2 dias): conferir a partir de 2026-11-04. Depois desligar o
  droplet, apagar as zonas na DigitalOcean e so destruir com OK explicito.
- Trocar a senha de root da Vultr (exposta no chat).
- Backup off-site ainda inexistente (Auto Backups da Vultr cobrem o servidor
  inteiro, mas nao substituem dump fora dele).

## Situacao na Retomada (2026-10-07)

O projeto ficou parado de 2026-08-05 (ultimo commit `f227308`) ate 2026-10-07.
Na retomada foi verificado, de fora do droplet:

- **Producao fora do ar.** `gestao360.org` nao resolve: o dominio esta
  registrado ate 2027-05-27, mas os nameservers foram trocados para
  `ns1/ns2/ns3.digitalocean.com` em 2026-08-12 e a zona nao existe no DNS da
  DigitalOcean (os servidores respondem `REFUSED`).
- **Droplet antigo eliminado.** A DigitalOcean removeu o droplet
  `159.89.91.222` por falta de pagamento (informado pelo usuario em
  2026-10-07). Esse IP pode ja pertencer a outro cliente: em 2026-10-07 ele
  respondia na porta 22 com outra chave de host. **Nunca** fazer SSH, deploy
  ou apontar DNS para ele.
- **Droplet novo criado.** `165.22.176.248`, com a chave publica `beeeyes`
  cadastrada. Em 2026-10-07 o droplet estava zerado: so Ubuntu e `sshd`,
  sem Docker e sem o projeto (detalhes em "SSH do Droplet").
- **Banco gerenciado tambem eliminado.** O usuario confirmou em 2026-10-07 que
  o Managed PostgreSQL foi destruido junto com o droplet. **Todos os dados de
  producao se perderam**; nao ha backup conhecido. A producao recomeca com
  banco vazio.
- **Decisao do usuario:** banco de novo dentro do droplet (Postgres 17 no
  compose). Se a base crescer, volta para um Postgres externo como antes.
- **Migrations corrigidas.** O historico nao construia o banco do zero; a
  migration `20260526115900_restore_dbpush_drift` resolveu isso. Testado em
  2026-10-07 num Postgres 17 descartavel no droplet: as 152 migrations aplicam
  e o banco resultante tem todas as tabelas e colunas do `schema.prisma`.
- **Producao reconstruida em 2026-10-07.** Deploy de `c7e1041` + correcoes de
  Caddy/Collabora (`edab72d`, `98a441c`), zona DNS recriada (A para `@`,
  `www`, `collabora` e `*`), certificado do apex emitido e backup diario
  (`backup-db.sh`, cron 03:00, so local por enquanto). Registros de e-mail (MX,
  SPF, DKIM, DMARC) ainda nao recriados, por decisao do usuario.
- **Acessos iniciais.** PLATFORM_OWNER `aldemir.fidelis@gmail.com` criado pelo
  bootstrap. Pela API do Portal Admin foram criados a empresa "Gestao 360"
  (plano CORPORATIVO) e o usuario `SUPER_ADMIN` `aldemir.fidelis@gmail.com`
  nela. As senhas iniciais ficam so em `/root/g360-acesso-inicial.txt` no
  droplet (modo 600); nunca copia-las para o repositorio ou para logs.
- **CI bloqueado.** Todos os runs do GitHub Actions desde julho falham em
  segundos com "account is locked due to a billing issue". Nenhum commit
  recente foi validado pelo CI.
- **Nao ha registro de deploy depois de 2026-07-01.** O ultimo deploy
  confirmado neste arquivo e `23a8a4a`; `main` tem cerca de 190 commits a mais
  e 151 migrations (eram 77).
- Todas as branches remotas ja estao contidas em `main`, exceto
  `fix/restaurar-postgres-local`, que e um revert abandonado.

## Estado Geral

- Repositorio local atual (Linux, desde 2026-10-07):
  `/run/media/aldemir-fidelis/DADOS/Projetos/gestao-360-indicadores`
- Repositorio local anterior (Windows, ate 2026-08):
  `D:\Projetos\gestao-indicadores-sqlite`
- Remote GitHub:
  `https://github.com/aldemirfidelis/gestao-360-indicadores.git`
- Branch publicada em producao: `main`
- Dominio de producao: `https://gestao360.org`
- Healthcheck publico da API: `https://gestao360.org/api/health`
- Droplet da aplicacao: `165.22.176.248` (novo, criado em 2026-10; o antigo
  `159.89.91.222` foi eliminado e nao e mais nosso)
- Diretorio no droplet: `/opt/gestao-360-indicadores`
- Compose de producao: `docker-compose.droplet.yml`
- Commit implantado e confirmado em 2026-07-01, no droplet antigo:
  `23a8a4a feat(lgpd): frontend do modulo de privacidade (/privacidade)`.
  O droplet novo ainda nao recebeu deploy.

Em 2026-07-01, os containers `g360-api`, `g360-web` e `g360-collabora`
estavam `healthy`; `g360-caddy` estava em execucao. O site e o healthcheck da
API respondiam HTTP 200. Em 2026-10-07 isso nao vale mais; ver a secao
"Situacao na Retomada".

## Estado Local e Trabalho Paralelo

No momento desta atualizacao (2026-10-07):

- Clone novo em Linux, branch `main` sincronizada com `origin/main` em
  `f227308`, sem alteracoes rastreadas.
- O trabalho paralelo nao commitado citado em 2026-07-01 (branch
  `feat/ajustes-5w2h-pdca-painel`) ficou na maquina Windows; o que foi
  publicado ja esta em `main`.

Nao assumir que a arvore local continua limpa ou que essas alteracoes pertencem
ao Codex. Sempre executar:

```bash
git status -sb
git diff --stat
git diff --check
```

Antes de editar um arquivo ja modificado, inspecionar o diff e preservar o
trabalho existente.

## Arquitetura de Producao

O Compose de producao possui estes servicos (desde 2026-10, `postgres` voltou):

```text
postgres
api
web
caddy
collabora
```

Containers esperados:

```text
g360-postgres
g360-api
g360-web
g360-caddy
g360-collabora
```

A API so sobe depois do `postgres` ficar `healthy` (`depends_on`).

Volumes persistentes do Compose:

- `g360_pgdata`: dados do Postgres de producao. **Nunca apagar.**
- `g360_storage`: arquivos binarios do GED.
- `caddy_data`: certificados e dados do Caddy.
- `caddy_config`: configuracao persistente do Caddy.

Fluxo de trafego:

- Caddy recebe HTTP/HTTPS nas portas 80 e 443.
- `/api/*` e encaminhado para `api:3333`.
- As demais rotas sao encaminhadas para `web:3000`.
- `collabora.gestao360.org` e encaminhado para `collabora:9980`.
- Subdominios de tenant usam TLS on-demand, condicionado pela API.

## Banco de Dados de Producao

Historico: Neon -> Postgres local no droplet -> DigitalOcean Managed
PostgreSQL (2026-06-30) -> **Postgres local no droplet de novo (2026-10)**,
depois que o droplet e o banco gerenciado foram eliminados por falta de
pagamento e os dados se perderam.

Configuracao vigente:

- Servico `postgres` do `docker-compose.droplet.yml`, imagem
  `postgres:17-alpine`, container `g360-postgres`, volume `g360_pgdata`.
- Acessivel so pela rede interna do compose (`expose`, sem `ports`). Nunca
  publicar a porta 5432 na internet.
- Usuario e banco: `g360`/`g360` (`POSTGRES_USER`/`POSTGRES_DB`); senha em
  `POSTGRES_PASSWORD` no `.env` do droplet.
- Sem SSL (rede interna). Schema Prisma: `public`.

As duas variaveis abaixo apontam para o mesmo banco local:

```text
DATABASE_URL=postgresql://g360:...@postgres:5432/g360?schema=public&connection_limit=20
DIRECT_URL=postgresql://g360:...@postgres:5432/g360?schema=public
```

Regras:

- `DATABASE_URL` e usada pela aplicacao e pode conter `connection_limit`.
- `DIRECT_URL` e usada pelo Prisma para migrations e pela tela Configuracoes >
  Banco de Dados; deve ser igual a `DATABASE_URL` sem o `connection_limit`.
- A senha nas URLs tem de ser a mesma de `POSTGRES_PASSWORD`. Use senha em hex
  para nao precisar escapar caracteres na URL.
- Para voltar a um banco externo no futuro: migrar os dados com
  `pg_dump`/`pg_restore`, trocar as duas URLs e remover o servico `postgres`
  e o `depends_on` da API.
- Nao copiar a URL completa para issue, commit, comentario ou saida de terminal.

Verificacao segura no droplet, com credenciais mascaradas:

```bash
grep -E '^(DATABASE_URL|DIRECT_URL)=' .env \
  | sed -E 's#(postgres(ql)?://)[^@]+@#\1***@#'
```

Resultado esperado para ambas:

```text
***@postgres:5432/g360?schema=public...
```

Dados iniciais num banco vazio: nenhum seed e necessario. No boot, a API cria
o PLATFORM_OWNER (`PLATFORM_ADMIN_BOOTSTRAP_*`), as permissoes e papeis do
Portal Admin Global e o catalogo de modulos do portal. Modulos e planos da
plataforma sincronizam pelo Portal Admin ("sync foundation"), as empresas sao
criadas por la e o catalogo de permissoes de cada empresa e criado sob
demanda. **Nao rodar `seed.ts` em producao** (ele cria dados demo).

Validacao do Prisma:

```bash
docker compose -f docker-compose.droplet.yml exec -T api \
  ./node_modules/.bin/prisma migrate status
```

### Backups do banco

Com o banco no droplet, **perder o droplet significa perder o banco**, como
aconteceu em 2026-10. Backup so no disco do proprio droplet nao basta.

- `scripts/backup-db.sh` (compativel de novo) gera um `pg_dump` custom-format
  em `./db-backups`, mantem os 14 mais recentes e, com `OFFSITE_BACKUP=1` e as
  variaveis `S3_*`/`AWS_*` no `.env`, copia para DigitalOcean Spaces/S3
  (precisa de `awscli` no droplet).
- Cron sugerido (`crontab -e` como root):
  `0 3 * * * cd /opt/gestao-360-indicadores && bash scripts/backup-db.sh >> /var/log/g360-backup.log 2>&1`
  (o script não tem bit de execução: sempre chamar com `bash`)
- Restauracao: ver o cabecalho de `scripts/backup-db.sh`.
- Antes de afirmar que existe backup utilizavel, conferir o cron, o log e o
  arquivo no destino off-site.
- `scripts/migrate-neon-to-droplet.sh` continua obsoleto (a Neon nao e mais
  usada).

## Build e Validacao Local

O projeto usa pnpm 9.7.0. A maquina atual e Linux (Ubuntu 26.04, Node 24,
11 GB de RAM, disco ext4).

### Ambiente local

- `.env` na raiz, gerado de `.env.example` com segredos JWT aleatorios, e links
  simbolicos `apps/api/.env` e `apps/web/.env.local` apontando para ele. A API
  (`ConfigModule` sem `envFilePath`) e o Prisma leem o `.env` de `apps/api`; o
  Next le de `apps/web`. Os tres sao ignorados pelo Git.
- Banco local: `pnpm db:up` (Postgres 16 + Redis 7 do `docker-compose.yml`),
  depois `pnpm --filter @g360/api prisma:deploy` (migrations) e
  `pnpm db:seed`. Desde 2026-10-07 as migrations constroem o banco do zero;
  preferir `migrate deploy` a `db push`, porque so as migrations criam o
  trigger do ponto, os indices parciais e os `CHECK`s escritos em SQL.
- Diferenca antiga e conhecida entre migrations e `schema.prisma`: FKs extras
  nas tabelas `Security*`, alguns indices que o schema nao declara, nomes de
  indice truncados e `DROP DEFAULT` em `updatedAt`. O banco antigo de producao
  tinha o mesmo. Por isso `prisma migrate dev` propoe uma migration que apaga
  essas FKs: revisar o SQL gerado antes de aceitar.
- Docker instalado em 2026-10-07 (`docker.io` + `docker-compose-v2`) e
  usuario no grupo `docker`. Enquanto a sessao grafica for anterior a entrada
  no grupo, liberar o socket com `sudo setfacl -m u:$USER:rw /var/run/docker.sock`
  (este Ubuntu nao tem `sg`/`newgrp`).
- Subir o sistema local: `NODE_OPTIONS=--max-old-space-size=4096 pnpm dev`
  (site em http://localhost:3000, API em http://localhost:3333/api). Logins do
  seed: `admin@demo.com`/`123456` (SUPER_ADMIN), `demo@demo.com`/`123456`,
  Portal Admin `platform@demo.com`/`admin123`.
- Fluxo combinado com o usuario: alterar e testar localmente primeiro, depois
  commit, push e deploy (sempre com OK explicito).

### Gate de qualidade (o mesmo do `.github/workflows/ci.yml`)

Enquanto o GitHub Actions estiver bloqueado, rodar localmente antes de publicar:

```bash
pnpm shared:build
pnpm --filter @g360/api exec prisma generate
pnpm --filter @g360/api exec prisma validate
NODE_OPTIONS=--max-old-space-size=4096 pnpm --filter @g360/api exec tsc --noEmit --pretty false
pnpm --filter @g360/web exec tsc --noEmit
pnpm --filter @g360/api test
NODE_OPTIONS=--max-old-space-size=4096 pnpm build
```

- O typecheck da API estoura o heap padrao do Node (~2 GB) nesta maquina; usar
  `--max-old-space-size=4096`.
- Resultado em 2026-10-07 sobre `f227308`: tudo passou. Schema valido, typecheck
  de API e Web sem erros, 118 arquivos e 830 testes da API, build completo com
  204 paginas e saida `standalone` gerada. O unico aviso do build vem da
  biblioteca `@vladmandic/face-api` ("Critical dependency") e e inofensivo.
- O erro `EPERM` de symlink no passo `standalone`, que acontecia na maquina
  Windows antiga, nao ocorre no Linux.

Antes de propor publicacao:

```bash
git status -sb
git diff --check
git diff --stat
```

## Commit e Push

Publicacao normal usa `main`. Como pode existir trabalho em feature branch:

1. Confirmar quais arquivos pertencem a tarefa.
2. Confirmar a branch de destino.
3. Executar as validacoes proporcionais a mudanca.
4. Mostrar o diff resumido ao usuario.
5. Aguardar `OK` explicito.
6. Somente depois fazer commit e push.

Comandos de confirmacao apos push:

```bash
git push origin main
git ls-remote origin main
```

Atencao ao `scripts/release.ps1`:

- O script faz push da branch local atual.
- O droplet permanece em `main` e executa `git pull --ff-only`.
- Se o script for iniciado de uma feature branch, ele apenas avisa sobre a
  divergencia. Isso nao garante que as mudancas da feature cheguaram a `main`.
- Antes de usa-lo, confirmar que o commit a implantar esta em `origin/main`.
- E PowerShell e foi feito para a maquina Windows. Na maquina Linux atual
  `pwsh` nao esta instalado; fazer push manualmente e rodar `make deploy` no
  droplet via SSH.

## Pre-flight Obrigatorio do Deploy

No local:

```bash
git status -sb
git log -1 --oneline
git ls-remote origin main
```

No droplet:

```bash
cd /opt/gestao-360-indicadores
git status -sb
git log -1 --oneline
docker compose -f docker-compose.droplet.yml config --services
grep -E '^(DATABASE_URL|DIRECT_URL)=' .env \
  | sed -E 's#(postgres(ql)?://)[^@]+@#\1***@#'
```

Confirmar:

- Droplet em `main`.
- Nenhuma alteracao rastreada inesperada.
- Commit desejado presente em `origin/main`.
- Servicos `postgres`, `api`, `web`, `caddy` e `collabora`.
- `DATABASE_URL` e `DIRECT_URL` apontando para `postgres:5432/g360`.
- `POSTGRES_PASSWORD` definido no `.env` e igual a senha das duas URLs.
- Backup recente em `db-backups/` (e no destino off-site, se configurado)
  antes de qualquer deploy com migration nova.

## Deploy no Droplet

O deploy padrao e:

```bash
cd /opt/gestao-360-indicadores
make deploy
```

Equivalente:

```bash
bash scripts/deploy.sh
```

Fluxo atual do script:

1. `git pull --ff-only`.
2. Calcula a versao exibida usando SemVer e hash do commit.
3. Para temporariamente o Collabora para liberar memoria durante o build.
4. Constroi primeiro a imagem da API e depois a imagem Web.
5. Executa `docker compose up -d --remove-orphans`.
6. Executa `prisma migrate deploy` dentro da API.
7. Opcionalmente envia IndexNow.
8. Mostra o status e remove imagens Docker antigas nao utilizadas.

A imagem da API tambem executa `prisma migrate deploy` no boot, salvo quando
`SKIP_MIGRATE=1`. Assim, uma configuracao incorreta de `DIRECT_URL` impede a API
de iniciar e faz o healthcheck falhar.

O Web depende da API saudavel. Se a API ficar `unhealthy`, o Web pode permanecer
em estado `Created` e o Compose reportar:

```text
dependency failed to start: container g360-api is unhealthy
```

## Validacao Pos-deploy

```bash
cd /opt/gestao-360-indicadores
docker compose -f docker-compose.droplet.yml ps
docker compose -f docker-compose.droplet.yml logs --tail=100 api
docker compose -f docker-compose.droplet.yml logs --tail=100 web
docker compose -f docker-compose.droplet.yml exec -T api \
  ./node_modules/.bin/prisma migrate status
curl -fsS https://gestao360.org/api/health
curl -sS -o /dev/null -w '%{http_code}\n' https://gestao360.org/
```

Resultado esperado:

- Postgres: `healthy`.
- API: `healthy`.
- Web: `healthy`.
- Collabora: `healthy`.
- Caddy: em execucao.
- Prisma: `Database schema is up to date`.
- Site e healthcheck: HTTP 200.

## Diagnostico de Falha

Comandos iniciais:

```bash
docker compose -f docker-compose.droplet.yml ps -a
docker inspect g360-api --format '{{json .State.Health}}'
docker logs --tail=200 g360-postgres
docker logs --tail=200 g360-api
docker logs --tail=200 g360-web
```

Se aparecer Prisma `P1001` (banco inacessivel):

1. Ler o host mostrado no erro; o esperado e `postgres:5432`.
2. Conferir se `g360-postgres` esta `healthy` e ver os logs dele.
3. Conferir `DATABASE_URL` e `DIRECT_URL` de forma mascarada.
4. Se o erro for de autenticacao (`P1000`), a senha das URLs nao bate com
   `POSTGRES_PASSWORD`. Atencao: o Postgres so le `POSTGRES_PASSWORD` na
   criacao do volume; trocar a variavel depois nao muda a senha do banco
   (use `ALTER USER g360 PASSWORD ...` dentro do container).
5. Recriar a API e aguardar o healthcheck.
6. Subir o Web caso ele tenha ficado em `Created`.
7. Confirmar migrations e endpoints publicos.

Se `www.gestao360.org` ou `collabora.gestao360.org` derem erro de TLS
(`tlsv1 alert internal error`) enquanto o apex funciona:

- Com o bloco curinga `*.gestao360.org` em TLS on-demand, o Caddy 2.10+ trata
  esses hosts como cobertos pelo curinga e nao emite certificado proprio para
  eles: emite sob demanda, so se `GET /api/public/tenant/allow?domain=...`
  responder 2xx.
- Em `main` o endpoint so libera tenants, por isso em 2026-10-07 `www` e
  `collabora` estavam sem certificado. A correcao (`isPlatformSiteHost` em
  `apps/api/src/common/tenant-host.ts`, liberando apex, `www` e `collabora`)
  foi preparada e testada localmente, mas o usuario adiou a publicacao.
  Depois de publicada, se um site novo da plataforma for criado no Caddyfile,
  inclua o subdominio la.
- Teste de dentro do Caddy:
  `docker exec g360-caddy wget -qS -O- "http://api:3333/api/public/tenant/allow?domain=www.gestao360.org"`
- Nao fixar arquivos de certificado no Caddyfile (`tls /data/caddy/...crt`):
  foi o contorno de 2026-06 e derrubou o Caddy no droplet novo, onde os
  arquivos nao existiam.

## Incidente de 2026-07-01 (historico, arquitetura com banco gerenciado)

Sintoma:

```text
Container g360-api Error
dependency failed to start: container g360-api is unhealthy
```

Causa:

- O commit `b7a21bd` removeu corretamente o Postgres local do Compose apos a
  migracao para DigitalOcean Managed PostgreSQL.
- `DATABASE_URL` ja apontava para o banco gerenciado.
- `DIRECT_URL` permaneceu apontando para `postgres:5432`.
- O boot da API executou `prisma migrate deploy`, usou `DIRECT_URL`, recebeu
  `P1001` e reiniciou continuamente.

Correcao aplicada:

- `DIRECT_URL` foi alinhada ao mesmo Managed PostgreSQL de `DATABASE_URL`.
- Foi criado no droplet o backup:
  `.env.before-direct-url-fix-20260701T163724Z`.
- A migration LGPD pendente foi aplicada.
- As 77 migrations ficaram atualizadas.
- API e Web voltaram a `healthy`.
- Site e `/api/health` voltaram a HTTP 200.

O backup do `.env` ficava no droplet antigo, que foi eliminado em 2026-10.

## SSH do Droplet

Configuracao:

- Host: `165.22.176.248` (droplet novo desde 2026-10; o antigo
  `159.89.91.222` foi eliminado)
- Usuario: `root`
- Chave na maquina Linux: `~/.ssh/gestao360_droplet` (ed25519, sem senha,
  comentario `aldemir-linux-gestao360`), com alias `g360-droplet` no
  `~/.ssh/config`
- Chave na maquina Windows antiga: `~/.ssh/beeeyes_digitalocean` (tambem
  autorizada no droplet novo)
- Diretorio remoto: `/opt/gestao-360-indicadores`

Exemplo:

```bash
ssh g360-droplet
# equivalente: ssh -i ~/.ssh/gestao360_droplet root@165.22.176.248
```

Se o SSH der timeout, validar VPN, firewall, chave e regras de acesso antes de
atribuir a falha ao deploy.

Em 2026-10-07 a chave privada `beeeyes` nao existia na maquina Linux. Foi
gerada a chave `gestao360_droplet` e a parte publica foi adicionada ao
`/root/.ssh/authorized_keys` pelo console web da DigitalOcean. O acesso foi
confirmado no mesmo dia.

Estado do droplet novo em 2026-10-07: Ubuntu 26.04.1, 2 vCPU, 3,8 GB de RAM,
**sem swap**, 77 GB de disco, IP privado de VPC `10.10.0.5`, regiao NYC1. Sem
Docker, sem `make`, sem o projeto em `/opt` e com UFW inativo; so `sshd` em
escuta. Com 4 GB e sem swap, o build das imagens tende a faltar memoria:
criar swap antes do primeiro deploy.

## Artefatos Obsoletos Conhecidos

Com a volta do Postgres local em 2026-10, a arquitetura voltou a ser parecida
com a de antes de 2026-06-30. Os arquivos abaixo misturam epocas (Neon, banco
local antigo, banco gerenciado) e devem ser lidos com cuidado:

- `DEPLOY-DROPLET.md`: passo a passo antigo de droplet novo.
- `docs/BANCO_LOCAL_DROPLET.md`: motivacao e operacao do Postgres local
  (continua util), mas a parte de migracao Neon -> droplet nao se aplica.
- `docs/CHECKLIST_PRODUCAO.md`, `docs/README.md`, `docs/SECURITY-AUDIT.md`.
- `scripts/migrate-neon-to-droplet.sh`: obsoleto.
- Comentario do `datasource` em `apps/api/prisma/schema.prisma` (fala em Neon).

Atualizados em 2026-10-07 e confiaveis: `README.md`, `.env.droplet.example`,
`docker-compose.droplet.yml` e `scripts/backup-db.sh` (sem mudanca, voltou a
ser compativel).

## Alteracoes Funcionais Recentes em `main`

- Modulo LGPD/Privacidade com RoPA, suboperadores e incidentes de dados.
- Pagina publica do Encarregado/DPO e materiais de politicas LGPD.
- Otimizacoes de desempenho no Web e nos hot paths da API.
- Fluxos de QR Code, PWA, rondas e ocorrencias com fila offline.
- Portal Administrativo Global com gestao de usuarios por empresa.
- Ajustes de Seguranca Patrimonial, operacao de portaria e importacao de pessoas.

Entre 2026-07-02 e 2026-08-05 (sem deploy confirmado):

- RH: Servico Pessoal, ponto com reconhecimento facial e totem, folha com
  margem consignavel e rescisao, fluxo salarial cargo -> faixa -> vaga.
- Recrutamento: portal do candidato com login Google/LinkedIn, pagina de
  carreiras por empresa, IA lendo curriculo, analytics do funil, vagas internas.
- Treinamento e Desenvolvimento (fases 1 a 3) integrado ao GED.
- Formularios: secoes, cabecalho com auto-preenchimento, foto pela camera, nota
  por pergunta e media lancada direto no indicador vinculado.
- Reuniao Mensal: modo telao, ata, acoes de saida da reuniao viram acoes da
  area. Ultimo trabalho antes da pausa.
- Central administrativa da empresa, controle de modulos e identidade visual
  (cor da marca) por empresa.
- E-mail por API HTTPS (Resend/Brevo) para contornar bloqueio de SMTP.

Esses itens sao contexto funcional. Antes de alterar um modulo, conferir o
historico recente e os diffs locais, pois pode haver trabalho ainda nao
publicado.


## Retomada após travamento — foco BSC / demo (2026-10-07)

- Implementação, commit, push, deploy e seed fictício em produção concluídos
  com autorização explícita do usuário em 2026-10-07 (BRT).
  Detalhes, escopo e evidências: `docs/FOCO_BSC_DEMO.md`.
- Menu de negócio focado em Meu Dia, Tarefas, Gestão à Vista e Gestão de Prêmio.
  Módulos restantes preservados em fonte e suspensos pelo registro central
  `packages/shared/src/product-scope.json`. Infraestrutura administrativa fica.
- Home com acesso público à demo; conta reservada somente leitura, sem senha
  pública nem refresh compartilhado, restrita à Empresa Demonstração fictícia.
- Seed dedicado `apps/api/prisma/seed-focused-demo.ts` executado no Postgres de
  desenvolvimento e no Postgres local do droplet confirmado, com backup prévio.
  Não usar seed geral para publicar a demo nem repetir em outro alvo sem revisão.
- Builds executados sequencialmente (API heap 4096 MB, Web heap 3584 MB / um
  worker), evitando watchers concorrentes. Cópia temporária de build Web não
  modifica fontes, protegendo contra novo travamento durante compilação.
- Após queda, conferir primeiro listeners 3000/3333 e memória; não iniciar
  outro `pnpm dev` se os servidores compilados já estiverem rodando.
- Web compilado local pode iniciar com
  `HOSTNAME=127.0.0.1 PORT=3000 node apps/web/.next/standalone/apps/web/server.js`.
  API focada: após build e `node scripts/package-focused-api.cjs`, executar
  `node dist-active/src/main.js` dentro de `apps/api` (usa o .env local).
- Validação: API 871 testes da suíte completa + 1 teste novo separado; Web 75;
  Chromium 9 E2E; builds e Prisma validate aprovados. Reexecução do seed compilado
  preservou integralmente as 406 tabelas com companyId fora da demo.
- Alterações anteriores de CI/migrations, tenant-host e controller público foram
  preservadas. Revisar o diff e obter OK explícito antes de qualquer publicação.

### Publicação confirmada desta retomada

- Imagens API/Web em produção: `0.1.0+b7ab4ecd`; Caddyfile adicional `423aa83`
  aplicado separadamente. Commits enviados para `origin/main`.
- API/Web/Postgres saudáveis, Caddy ativo, Collabora suspenso. 152 migrations
  aplicadas; nenhuma alteração de schema ou exclusão de dados.
- Backup protegido no droplet:
  `/opt/gestao-360-indicadores/db-backups/pre-focus-20261007/g360-20261008-002632.dump`.
  Validado com pg_restore, sem exportar dados reais para desenvolvimento.
  Tags de recuperação: `g360-api:rollback-c8fbd5a-20261007` e Web equivalente.
- Empresa Demo: `36090c9d-47a9-4afa-8327-963affe6def3`, slug `demonstracao`.
  Conta `visitante@demonstracao.local`, perfil `DEMO_PUBLIC`, somente consulta.
  32 indicadores, 384 resultados, BSC, ações, projetos, reuniões, tarefas e
  3 competências / 9 espelhos fictícios de prêmio confirmados.
- Auditoria do seed: 406 tabelas com companyId fora da demo e Company preservadas
  por contagem/hash. Acesso público acrescenta auditoria global de login normal.
  E2E de produção: 22 rotas, 4 escritas bloqueadas, 11 rotas suspensas 404,
  zero erros JS/GET; mobile sem overflow. Home/health 200 e www HTTPS 301.
- Empacotamento Web deve preservar symlinks relativos (`verbatimSymlinks`),
  validar portabilidade e imports na imagem isolada; testes adicionais (3) passaram.
  Não basta smoke dentro do monorepo, onde node_modules externos podem mascarar
  falta de dependência. O primeiro deploy foi recuperado antes desta correção.
- Ao atualizar deploy.sh, puxar o Git antes de iniciar o script. O deploy novo
  aguarda containers saudáveis e recupera imagens pelos IDs anteriores.
- Ao alterar Caddyfile, validar e garantir que o bind mount não conserva o inode
  antigo. Nesta publicação foi recriado apenas Caddy; certificados/volumes mantidos.

## Visitantes do site e da demonstração (2026-10-31)

Pedido do usuário: o mesmo sistema de visitantes do ZapFácil (commit `2555618`
daquele repositório), adaptado à landing e à demonstração. Commit `25258cb`,
push e deploy autorizados pelo usuário e feitos em 2026-10-31.

- **Em produção desde 2026-10-31 (BRT 11:49–11:58)**: imagens `0.1.0+25258cb1`,
  com cerca de 8 min de indisponibilidade (o `deploy.sh` para web e API durante o
  build). Versão anterior: `0.1.0+f8ba02df`, preservada nas tags
  `g360-api:rollback-f8ba02d-20261031` e `g360-web:rollback-f8ba02d-20261031`.
- Backup antes do deploy, protegido da rotação:
  `db-backups/pre-site-visits-20261031/g360-20261031-144841.dump` (2,0 MB,
  `pg_restore --list` com 4074 linhas, permissão 600). SHA-256:
  `0eca572d23a7790ac78f5b2abc22ced1bcd54bab4ff7376b46d679c149d31726`.
- Validado depois do deploy: containers saudáveis, `migrate status` em dia
  (153), tabelas e índices novos criados, permissão ligada ao papel
  `SUPER_ADMIN` pelo bootstrap; health, home, demonstração e portal com 200 e
  `www` com 301; coleta responde 400 a corpo inválido e 204 a lote válido (a
  visita de teste, marcada como robô, foi apagada em seguida); painel responde
  401 sem token; o container da API alcança `download.db-ip.com` e grava no
  volume de storage.

- Portal Admin Global › **Visitantes do Site** (`platform.site_analytics.view`,
  só Platform Owner e Super Admin). Detalhes de produto no `README.md`.
- Migration nova e aditiva `20261031120000_site_visits`: tabelas `SiteVisit` e
  `SiteEvent` e coluna `PublicContactMessage.siteVisitId`. Backup antes do deploy,
  como em toda migration nova.
- A API baixa todo mês a base DB-IP Lite
  (`https://download.db-ip.com/free/dbip-city-lite-AAAA-MM.mmdb.gz`, ~60 MB) para
  `storage/geoip` no volume `g360_storage` (~130 MB em disco). Precisa de saída
  HTTPS no container; sem ela as visitas ficam "Localizando…". Leitor `.mmdb`
  próprio (`mmdb-reader.ts`), sem dependência nova no lockfile.
- Coleta em `POST /api/public/site-events`: fora do `AuditInterceptor` e do log de
  requisições do pino. Rotinas in-process (localização a cada 5 min, retenção de
  12 meses), desligadas com `MAINTENANCE_JOBS_ENABLED=false`.
- No primeiro boot, o bootstrap liga a permissão nova ao papel `SUPER_ADMIN` já
  existente; o `PLATFORM_OWNER` tem acesso pelo curinga `platform.*`.
- Para testar a contagem: navegador com sessão do Portal Admin (ou logado no
  sistema) não é contado; usar janela anônima ou outro navegador.
- Datas passadas a SQL bruto do Prisma vão como `timestamptz` e o Postgres as
  converte pelo fuso da sessão; com o banco fora de UTC o período e os
  `LEAST`/`GREATEST` deslocavam horas. O serviço converte toda data para UTC
  (`utc()` em `site-analytics.service.ts`). A produção roda em UTC, mas o código
  não depende mais disso.
- Validação em 2026-10-31, numa máquina Windows (`E:\Projetos\gestao-360-indicadores`)
  que não tinha Node, pnpm nem Docker: Node 24.22.2 portátil instalado em
  `%LOCALAPPDATA%\Programs\node-v24.22.2-win-x64` e pnpm 9.7.0 via corepack.
  Gate aprovado: `prisma validate`, `tsc` de API e web, API 126 arquivos / 898
  testes, web 12 / 90, shared 3 / 17, `nest build` e empacotamento focado da API
  (332 arquivos). As 153 migrations aplicaram do zero num Postgres 17 embutido
  (pacote npm `embedded-postgres`, UTF-8), o `prisma migrate diff` não mostrou
  diferença nas tabelas novas e o serviço rodou contra esse banco (coleta,
  painel, lista, detalhe, localização e retenção), com a sessão em
  `America/Sao_Paulo`. E2E não rodados.
- Build web no Windows: `scripts/build-focused-web.cjs` falha com `EPERM` ao
  copiar os links do `node_modules` (sem Modo de Desenvolvedor). A validação usou
  uma cópia temporária com junction no `node_modules`, que gerou as 107 páginas.
  O `outputFileTracingRoot` feito com `new URL().pathname` vira `/E:/...` no
  Windows e a saída standalone escapa para `apps/Projetos/...`, que precisa ser
  apagado depois. Nada disso acontece no Linux nem no Docker.

## Auditoria de produção (2026-10-31)

Feita com Chromium contra `https://gestao360.org`, sem login de empresa nem do
Portal Admin (as senhas ficam só no droplet).

- Site público: as 32 páginas do sitemap e o login abrem sem erro de JS, com
  title, description, canonical e um h1, sem estouro a 390 px. Robots, sitemap,
  llms, manifest e ícones respondem 200; HSTS e demais cabeçalhos presentes;
  certificados válidos até 2027-01.
- Integração: nenhuma chamada do código ativo a rota inexistente (909 chamadas
  do web cruzadas com as 857 rotas registradas pela API). As 3 chamadas a
  módulos suspensos são protegidas por `isProductModuleActive`.
- Demonstração: 32 telas e 7 detalhes sem erro de JS; escrita bloqueada (403),
  sem leitura de outra empresa e sem acesso ao Portal Admin.
- Corrigido no código (ainda não publicado): links de dois artigos para
  soluções suspensas (404); `/eficacia` redirecionava para `/aprovacoes-cargo`
  (suspensa) e agora leva a `/actions?effectivenessStatus=PENDING`;
  `/projects/cronograma` reescrevia a URL para `/projects` e ficava inacessível;
  `/insights` saiu das rotas da demo (as leituras dela davam 403); Portal Admin
  sem login disparava consultas 401 antes de ir ao login.
- Pendências de operação: **sem backup off-site** (só os 14 dumps no próprio
  droplet); **nenhum envio de e-mail configurado** (sem chave de API, SMTP ou
  caixa no banco: contato não avisa ninguém, recuperação de senha e convites
  não saem); DNS sem MX, SPF, DKIM e DMARC; páginas ativas sem item de menu
  (`/reports`, `/insights`, `/dashboard`, `/periods`, `/treatments`,
  `/plataforma`); perfil Totem é levado a `/totem`, que está suspensa.

## Mapa Estratégico: canvas mais fácil de manipular (2026-11-02, publicado)

Pedido do usuário: os cards do canvas do BSC eram difíceis de arrastar. Mantido
o `reactflow` 11 já instalado; a mudança é de modelo e de interação, não de
biblioteca.

- Geometria em `apps/web/lib/strategy-map-layout.ts` (funções puras, com
  testes): perspectivas são faixas fixas empilhadas que crescem com o conteúdo;
  o card guarda posição relativa à faixa (no banco continua absoluta e a
  perspectiva grava origem e tamanho da faixa). Mapas antigos são convertidos
  na leitura, sem gravar nada até a primeira edição.
- Tela: "Editar mapa" só para quem tem `strategy:objectives:update` ou
  `strategy:manage` e não é demonstração; arrastar para outra faixa troca a
  perspectiva; salvamento automático em fila com atualização imediata do cache
  (o card não volta mais para a posição antiga); "Organizar" por faixa; mini
  mapa e controles de zoom; ligação pelos pontos ou por "Ligar a…"; trocar a
  perspectiva pelo painel lateral zera a posição e o card cai na primeira vaga
  livre da faixa nova.
- API: `PATCH /strategy/maps/:id/layout` aceita `lanes` além de `nodes` e
  valida que as perspectivas de destino são do mapa. Sem migration.
- Validado nesta máquina Windows: `tsc` de web e API, lint, web 13 arquivos /
  100 testes, testes do serviço de estratégia. Não testado no navegador antes
  da publicação.
- Publicado em 2026-11-02 com OK do usuário: commit `01f67a4`, imagens
  `0.1.0+01f67a44`. Imagens montadas antes com o site no ar (API 66 s, web
  138 s); `make deploy` levou 25 s (14:37:01Z a 14:37:26Z), sem migration
  pendente (153). Backup antes: `db-backups/g360-20261102-143643.dump`.
  Rollback: `g360-api:rollback-b16441a-20261102` e
  `g360-web:rollback-b16441a-20261102`.
- Validado depois: containers saudáveis, `migrate status` em dia, health,
  home, login, demonstração e `/strategy` com 200, PATCH de layout sem token
  401, chunk novo da tela e mensagem nova da API dentro dos containers.
- `scripts/backup-db.sh` não tem bit de execução no Git (100644): rodar com
  `bash scripts/backup-db.sh`, como o cron da Vultr já faz. `./scripts/...`
  dá "Permission denied".
- O notebook travou durante esse trabalho com ~1 GB de memória livre. Antes de
  typecheck, build ou `pnpm dev`, conferir a memória livre e não deixar
  processos Node antigos rodando.

## Modernização das telas de manipulação (2026-11-02)

Pedido do usuário: levar para o resto do projeto o que foi feito no Mapa
Estratégico. Verificados os 12 módulos ativos; tinham o mesmo tipo de problema
(arraste difícil, salvamento manual ou concorrente) estas telas:

- **Tarefas (Kanban)** e **roteiro da Reunião Mensal**: trocado o arraste
  nativo do HTML5 (não funciona no toque, sem indicação de onde cai) por
  `@dnd-kit` (`core` 6.3.1, `sortable` 10.0.0, `utilities` 3.2.2, versões
  fixas). Mouse, toque (tocar e segurar no Kanban; alça no roteiro) e teclado
  (espaço pega/solta, setas movem, Enter abre). Lógica pura de ordem em
  `apps/web/lib/board-order.ts` (com testes); lista reordenável reutilizável em
  `components/ui/sortable-list.tsx`. No Kanban, vários arrastes seguidos sem
  bloqueio; a lista só recarrega quando termina o último movimento pendente.
- **Fluxograma de OKRs**: layout em árvore (`lib/okr-tree-layout.ts`, com
  testes; filhos sob o pai, sem linhas cruzadas, ciclos tratados), cards fixos
  (antes pareciam arrastáveis e não se moviam), recolher/expandir ramos,
  destaque da linhagem do objetivo clicado, zoom e mini mapa.
- **Ishikawa** (Plano de Ação e Reuniões): causas empilhadas na espinha da
  categoria (sem sobreposição; o desenho cresce), arraste do card inteiro para
  reordenar ou trocar de categoria, espinhas desenhadas a partir das posições
  reais dos cards, salvamento automático em fila com status e "Tentar de
  novo", id definitivo gerado no navegador (a seleção não pula mais). Ordem e
  categoria definem `orderIndex`; `positionX/Y` continuam gravados no formato
  antigo.
- **Salvamento das análises**: o Plano de Ação passou a avisar falhas (antes
  falhava calado) e os salvamentos automáticos do Ishikawa não mostram mais
  "Análise salva" a cada arraste. Na API, `saveAnalysis` grava a sessão e as
  linhas da ferramenta numa transação (o upsert trava a sessão), evitando
  causas duplicadas em salvamentos seguidos. Sem migration.
- Fora do escopo (sem problema de manipulação ou módulo suspenso): Gantt
  (só leitura), estrutura do banco (admin), organograma, automações,
  segurança de alimentos e demais módulos suspensos. No 5W2H sobrou código
  morto do arraste antigo (os blocos já são uma grade).
- Validado na máquina Windows: `tsc` e lint da web, web 15 arquivos / 111
  testes, testes do serviço de ações. Por pedido do usuário, **sem teste em
  navegador nem `tsc` local da API** (pesam o notebook): o usuário testa depois
  do deploy e o `nest build` da imagem, montada antes do deploy, checa os tipos.
- Publicado em 2026-11-02 a pedido do usuário: commit `3dcaf24`, imagens
  `0.1.0+3dcaf243` (montadas antes com o site no ar: API 103 s, web 148 s);
  `make deploy` em 26 s (15:47:06Z a 15:47:32Z), sem migration pendente (153).
  Backup antes: `db-backups/g360-20261102-154235.dump`. Rollback:
  `g360-api:rollback-01f67a4-20261102` e `g360-web:rollback-01f67a4-20261102`.
- Validado depois: containers saudáveis, `migrate status` em dia, health, home,
  login, demonstração, `/tarefas` e `/okrs` com 200, POST de análise sem token
  401; código novo confirmado nos chunks da web (Kanban, roteiro, fluxograma,
  Ishikawa) e a transação no `actions.service.js` da API. Pendente: o teste
  em navegador pelo usuário.
- Pegadinha de script: em regex JS com a flag `m`, `^` também casa logo depois
  de `\r`. Remover linha com `^(\s*)...\r?\n` num arquivo CRLF deixou um `\r`
  solto; o Git passou a ver o arquivo como não-texto e o diff mostrava o
  arquivo inteiro. Conferir `git ls-files --eol` depois de editar por script.

## PDCA redesenhado e Pareto removido (2026-11-02)

Pedido do usuário depois de testar em produção:

- **PDCA** (`components/platform/pdca-visual-analysis.tsx`): ciclo no sentido
  horário da roda de Deming (Plan no alto à direita, Do embaixo à direita,
  Check embaixo à esquerda, Act no alto à esquerda; antes estava invertido),
  anel em SVG com setas, sem o painel fixo "Etapa selecionada" (a edição abre
  num `Sheet` lateral só ao clicar, com navegação entre etapas e checklist
  embutido), salvamento automático em fila com status (componente
  compartilhado `auto-save-status.tsx`, também usado no Ishikawa). Ids de
  etapa gerados no navegador: "Transformar em tarefa do plano" não falha mais
  até recarregar.
- **Pareto**: fora da sequência de análise (agora Ishikawa → 5 Porquês → 5W2H
  → PDCA), componente `pareto-visual-analysis.tsx` apagado, semeadura no
  Ishikawa removida e item tirado do catálogo padrão "Métodos de análise de
  causa" (só vale para empresas novas; as existentes mantêm a linha no banco,
  desativável em Parâmetros). Enums do banco/shared e o rótulo de exibição
  continuam, para ações antigas salvas com Pareto (abrem no Ishikawa).
- Publicado em 2026-11-02 com OK do usuário: commit `006e213`, imagens
  `0.1.0+006e2137` (montadas antes: API 74 s, web 134 s); `make deploy` em
  27 s (16:13:46Z a 16:14:13Z), sem migration pendente (153). Backup antes:
  `db-backups/g360-20261102-160953.dump`. Rollback:
  `g360-api:rollback-3dcaf24-20261102` e `g360-web:rollback-3dcaf24-20261102`.
  Validado: containers saudáveis, `migrate status` em dia, health/home/login/
  demonstração/`/actions` 200, PDCA novo nos chunks da web. Sem teste em
  navegador (o usuário testa).

## Logo e cores com acesso direto (2026-11-02, publicado)

Pedido do usuario: voltar a encontrar as opcoes de logo da empresa e cores do
portal em Configuracoes. A tela e a API de identidade visual continuam no codigo.

- Atalho em destaque no inicio de `/settings`: **Logo e cores do portal**, com
  botao **Personalizar portal**.
- Nova pagina `/settings/identidade-visual` reutiliza `BrandingSection`: envio e
  remocao de logo, cor do portal, cor das letras, contraste automatico, previa e
  salvamento para toda a empresa. A pagina abre sem carregar o bootstrap admin.
- Consulta exige `settings:view` ou `settings:manage`; alteracoes continuam com
  `settings:manage` na interface e na API. Demonstracao permanece bloqueada.
- Sem mudanca de API, banco ou migration. A identidade visual existente e
  preservada; somente o acesso a tela foi reorganizado.
- Validado: web 15 arquivos / 112 testes, `tsc --noEmit` da web e lint dos arquivos
  alterados. Build completo da web aprovado na Vultr; sem teste em navegador.
- Publicado na Vultr em 2026-11-02 com OK do usuario: commit `60c16c9`, versao
  `0.1.0+60c16c94`. Build antecipado com o site no ar (API em cache, web 134 s);
  `make deploy` em 30 s (20:30:21Z a 20:30:51Z). Banco em dia, 153 migrations.
- Backup antes: `db-backups/g360-20261102-202742.dump` (2,1 MB, validado com
  `pg_restore --list`, 4086 linhas). Rollback preservado nas tags
  `g360-api:rollback-006e213-branding-20261102` e Web equivalente.
- Validado depois: API/Web/Postgres saudaveis; health, home, login, demonstracao,
  `/settings`, `/settings/identidade-visual` e Portal Admin com HTTP 200; leitura
  e gravacao da identidade visual sem token com 401; versao publica no login e
  nova rota, titulo e atalho confirmados nos arquivos compilados da imagem.
