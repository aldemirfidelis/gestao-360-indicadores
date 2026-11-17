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

## Revisão geral de português (2026-11-02, publicado)

Pedido do usuário a partir da recomendação sem acentos no Meu Dia: corrigir
português no projeto inteiro. Resumo e evidências: `docs/REVISAO_PORTUGUES.md`.

- Corrigidos textos da interface, API, mensagens, ajuda, relatórios, notificações,
  catálogos, site e fontes de dados fictícios, incluindo módulos suspensos.
- Concordância de quantidades com `formatQuantity` no shared: Meu Dia, equipe,
  atas, checklists e contagens administrativas; a frase do anexo está corrigida.
- Migration nova `20261102210000_portuguese_catalog_copy`: 571 substituições
  condicionadas à chave e ao texto padrão antigo, em oito catálogos. Preserva
  personalizações e concessões de acesso. Sem alteração estrutural do banco.
- Validação: API 127 arquivos / 903 testes, com reexecução aprovada dos sete
  arquivos ajustados (123 testes); web 15 / 112; shared quatro / 21; tsc completo
  da web; lint sem erros; builds de API/Web em cópia temporária na Vultr.
- A migration passou em 1.080 cenários num Postgres 17 descartável e foi repetida
  para confirmar idempotência. O container descartável foi encerrado; o Postgres
  de produção e as imagens em execução não foram alterados.
- Cópia de validação na Vultr: `/tmp/g360-portuguese-validation-20261102-b`,
  imagens `g360-api:portuguese-copy-review-20261102` e Web equivalente.
- Sem navegador nem tsc local da API, conforme a preferência anterior. Aliases,
  rotas, chaves, eSocial e arquivos fiscais ASCII preservados e conferidos.
- Publicado na Vultr com OK do usuário: commit `57a4755`, versão
  `0.1.0+57a47553`. Builds antecipados com o site no ar: API 73 s, web 135 s.
  `make deploy` em 28 s (21:23:43Z a 21:24:11Z), banco em dia (154 migrations).
- Backup antes: `db-backups/g360-20261102-211951.dump` (2,1 MB), validado com
  `pg_restore --list` (4.086 linhas); SHA-256
  `0995820d2f3a28edec44de9fa38ed087ae273e2ca887b426541f804b8e44a1fe`.
  Rollback: `g360-api:rollback-60c16c9-portuguese-20261102` e Web equivalente.
- Auditoria antes/depois: 384 campos padrão corrigidos nos oito catálogos;
  nenhum texto antigo previsto restante. IDs dos 552 registros e os 1.172
  vínculos de permissões com contagens e hashes idênticos aos anteriores.
- API/Web/Postgres saudáveis; health, home, login, demonstração, Meu Dia,
  configurações, identidade visual e Portal Admin com HTTP 200; sem token, o
  assistente responde 401. Versão pública conferida no login.
- A frase do anexo foi confirmada pela API pública da demonstração, com acentos
  e redação corrigidos. Singular/plural conferidos no shared e no JavaScript
  do Meu Dia servido publicamente (idêntico ao arquivo da imagem implantada).

## Visitantes do Site: regressão na consulta (2026-11-02, publicado)

- O usuário relatou erro 500 em `/platform-admin?section=siteVisitors`.
  Logs confirmaram `P2010` / Postgres `42703`: `column "área" does not exist`.
- Causa introduzida pela revisão de português (`57a4755`): o alias SQL `area`
  foi acentuado indevidamente no ORDER BY de `SiteAnalyticsService.overview`.
  Restaurado `area`; nenhuma alteração de schema, migration ou dados necessária.
- Acrescentado teste de regressão do resumo/áreas. Testes de analytics/contexto:
  dois arquivos, 20 testes aprovados.
- Auditoria de 115 arquivos da API alterados na revisão: comparados 81 trechos
  SQL (tagged templates, chamadas raw e literais SQL) com a versão anterior.
  Após a correção, nenhuma diferença SQL restante, normalizando somente CRLF.
- Resumo e lista executados com o serviço corrigido em processo isolado na Vultr,
  em transação `READ ONLY`: todas as consultas funcionaram no período da captura
  (04/10 a 03/11, 30 dias). Somente agregados de resultado foram exibidos.
  Arquivos de validação em `/tmp/g360-visitors-*`; app em execução não alterado.
- Publicado na Vultr em 2026-11-02 com OK do usuário: commit `6b796a8`, versão
  `0.1.0+6b796a88`. Builds antecipados aprovados com o site no ar (API 71 s,
  web 135 s); `make deploy` em 26 s (22:46:12Z a 22:46:38Z).
- Backup `db-backups/g360-20261102-224218.dump` (2,1 MB), validado com
  `pg_restore --list` (4.086 linhas); SHA-256
  `4802094702a7f0c22746fa3060741370c46360a1fe3e25ceed5bb8d8cb61b4a6`.
  Rollback: `g360-api:rollback-57a4755-visitors-20261102` e Web equivalente.
- Validação posterior com o módulo realmente implantado, em transação READ ONLY:
  resumo de 1, 7, 30 e 90 dias, lista e detalhe de visitas aprovados.
  Identificador `area` confirmado no JavaScript compilado da API.
- API/Web/Postgres saudáveis; banco em dia (154 migrations, nenhuma nova nesta
  correção). Health, home, login, demonstração e tela de visitantes com HTTP 200;
  versão pública no login conferida; API de analytics sem token retorna 401.
- Sem teste em navegador nem tsc local da API, conforme a preferência registrada.
  Builds Docker fizeram a checagem de compilação. Em revisões de português,
  preservar também identificadores dentro de SQL/tagged templates e validar as
  consultas afetadas no Postgres; mocks não detectam nomes de coluna inválidos.

## Projetos e curva S (2026-11-16, publicado)

- Pedido do usuário: localizar o módulo antigo e voltar a disponibilizá-lo.
  Diagnóstico e alterações: `docs/RESTAURACAO_PROJETOS.md`.
- O módulo não havia sido excluído: `6003cf1` preservou o portfólio em
  `/projects/cronograma`, fora do menu, enquanto `/projects` virou a Ata.
  Histórico confirmado pelo Git local e pelo conector GitHub.
- Menu principal **Projetos** restaurado, separado da Ata. Gantt, portfólio,
  orçamento, tarefas, marcos e indicador reutilizados. Curva S do projeto no
  detalhe, com planejado/realizado, diferença em p.p. e CSV. PMO e curva usam
  a mesma regra de planejamento; realizado mantém os pesos anteriores.
- Migração aditiva `20261116120000_project_progress_snapshots`: histórico
  diário em São Paulo, primeira medição na ativação para projetos existentes.
  Sem histórico anterior inventado. Mudanças de tarefas/marcos e conclusões
  pelo quadro de Tarefas gravam medição na mesma transação, com bloqueio do
  projeto para concorrência. Não executar seeds; backup antes da publicação.
- Corrigido atalho de projeto no Meu Dia. Controles respeitam leitura/demo;
  dependências ficam no mesmo projeto e não podem criar ciclos. Atualizações
  aceitam apenas campos editáveis, protegendo empresa e medições.
- Validação: shared 31 testes, serviços de API afetados 31, web 113; lint dos
  arquivos web alterados sem avisos/erros; Prisma gerado e validado. Builds
  Docker de API/Web aprovados em cópia isolada na Vultr. Sem navegador nem
  typecheck local da API, conforme preferência anterior e memória disponível.
- As 155 migrações aplicaram do zero num Postgres 17 descartável em tmpfs;
  `scripts/check-projects.cjs` validou medição inicial, avanço, marcos,
  isolamento, concorrência, dependências, quadro de Tarefas e rollback.
  Container descartável removido; nenhum volume de produção utilizado.
- Evidências em `/tmp/g360-projects-review.EbDKb5` na Vultr; imagens de revisão
  `g360-api:projects-review-20261116` e Web equivalente. Não são imagens
  publicadas. Durante o ensaio, produção permaneceu saudável, sem reinício ou
  mudança no banco.
- Publicado com autorização explícita do usuário: commit `b120801`, push em
  `main`, versão `0.1.0+b120801a`. Builds antecipados com o portal no ar;
  `make deploy` entre 12:37:54Z e 12:38:30Z (36 s), com as imagens em cache.
- Migração `20261116120000_project_progress_snapshots` aplicada e confirmada;
  155 migrations em dia. Projetos, tarefas e marcos preservados por contagem
  e hash. A base atual contém zero projetos ativos; zero medições iniciais
  era o resultado esperado. Não houve seed nem criação de projetos fictícios.
- Backup protegido antes da migração:
  `db-backups/pre-projects-20261116/g360-20261116-123752.dump` (5.437.636 bytes,
  modo 600), `pg_restore --list` validado (4.086 linhas). SHA-256:
  `78946eca25b0c6d6a7dd378ae573932f7d0f76a6cf525c13ad729b968b708deb`.
  Rollback: `g360-api:rollback-6b796a8-projects-20261116` e Web equivalente.
- Pós-deploy: API/Web/Postgres saudáveis; zero erros nos logs de inicialização.
  Health, home, login, demonstração, Ata e Projetos com HTTP 200; versão pública
  conferida. Pela sessão pública da demo, lista e portfólio de projetos e
  seleção dos 84 indicadores responderam 200. Sem projeto cadastrado para testar
  curva pela API de produção; curva validada com fixture isolada e confirmada
  no JavaScript servido pela imagem nova. Sem teste em navegador.
- Logs e scripts da publicação em `/tmp/g360-projects-release-20261116`.
  Alterações locais anteriores de demonstração corporativa preservadas e
  mantidas fora dos commits desta publicação.

## SIPOC, BPMN e RACI (2026-11-16, publicado)

- Pedido do usuário: implementar o prompt anexo de gestão integrada de processos
  e documentar toda a plataforma. Relatório e evidências:
  `docs/RELATORIO_IMPLEMENTACAO_SIPOC_BPMN_RACI.md`; documento principal:
  `docs/GESTAO360_DOCUMENTACAO_COMPLETA.md`. Índice atualizado em `docs/README.md`.
- Reutilizados Process/ProcessStep, organização, usuários, tarefas, indicadores,
  projetos, permissões e auditoria. Menu Processos reativado no código; ferramentas
  no detalhe `/processes/:id`, sem três cadastros/módulos independentes.
- SIPOC detalhado; bpmn-js 18.31.1 na web e bpmn-moddle 9.0.4 CommonJS na API;
  XML/SVG, atividades estáveis, propriedades, AS-IS/TO-BE e comparação. BPMN é
  documentação/modelagem: não executa workflows nem inventa métricas operacionais.
- RACI com pessoas/áreas/cargos existentes, R+A e múltiplos R; único A e ao menos
  um R por linha antes de decisões protegidas. Mudanças organizacionais sinalizam
  revisão, sem transferir responsabilidade nem conceder acesso automaticamente.
- Governança, revisão concorrente, snapshots e auditoria transacionais. Novas
  permissões de aprovar/publicar no catálogo aditivo existente. Respeitar overrides
  e licenças empresariais. Módulos corporativos suspensos continuam suspensos.
- Migration **aplicada em produção após backup**:
  `20261116140000_process_governance`, seis tabelas, quatro enums e CHECKs/FKs
  aditivos. Sem seed, conversão destrutiva ou alteração de dados reais.
- Vínculos tipados e navegação reversa em registros centrais, painel de governança,
  revisões no Meu Dia com permissão/disponibilidade do módulo e notificação ao
  proprietário. FK em uso retorna 409 com mensagem; referências mantidas por
  artefatos só são alteradas pela edição de origem.
- Validação: shared 38 testes, web 113, API afetada/selecionada 89; lint das telas
  alteradas, Prisma e builds Docker de API/Web aprovados. Toda a cadeia de 156
  migrations aplicou do zero: 545 tabelas incluindo `_prisma_migrations`.
- Serviços compilados testados em Postgres 17 descartável: persistência,
  referências, isolamento de empresa/área, estados/permissões, histórico, RACI,
  comparação, concorrência, rollback, checks, painel e Meu Dia. Scripts:
  `scripts/check-process-governance.cjs` e fixture em `tests/fixtures`.
- O novo prompt pediu testes de interface: Playwright 1.60.0/Chromium executado
  em rede Docker isolada, com login e dados sintéticos. Nove grupos passaram,
  incluindo criação/edição/recarga, importação inválida preservando desenho,
  XML/SVG, TO-BE/comparação, aprovação/publicação, histórico, navegação reversa,
  proteção de exclusão/409, leitura/403 e três ferramentas em 390 pixels.
- Evidências em `/tmp/g360-process-review.2kOIcl` na Vultr; imagens somente de
  revisão `g360-api:process-review-20261116` e Web equivalente. Postgres em tmpfs,
  sem volume do produto. Containers/rede de ensaio removidos após validação;
  artefatos preservados. Produção permaneceu saudável na versão já publicada.
- Documentação técnica, funcional, comercial e inventário de todos os módulos:
  61 diretórios, 1.747 operações HTTP decoradas, 201 páginas, 544 modelos Prisma.
  Inventário descreve fonte; não afirma teste integral de módulos suspensos.
- Alterações anteriores de interface preservadas: sequência sem números,
  minimapas React Flow removidos e linhas selecionadas do mapa estratégico com
  traçado animado. Alterações/scripts anteriores da demonstração preservados.
- Publicado após OK explícito do usuário: commit `eead7ac`, push em `main`, versão
  `0.1.0+eead7ac7`. Builds com o portal no ar; `make deploy` entre 14:58:04Z e
  14:58:47Z (43 s). Migration nova aplicada; 156 em dia, cinco CHECKs validados.
- Backup protegido: `db-backups/pre-processes-20261116/g360-20261116-145802.dump`,
  5.440.105 bytes, modo 600, `pg_restore --list` com 4.091 entradas. SHA-256:
  `fe311c27ddcc4f6418663a1c0e28a0fa487181d573ce70bdf2cff4b0daaedbff`.
- Contagens/hashes preservados em 25 tabelas de negócio. Base sem processos
  anteriores; as seis tabelas novas continuam vazias. Sem seed/exemplos fictícios.
- Perfil público da demonstração recebeu somente `processes:view` e
  `processes:export` (41 → 43 permissões), em transação auditada. Demais perfis e
  concessões individuais preservados por hash; edição da demo continua 403.
- Pós-deploy: API/Web/Postgres saudáveis, zero erros; versão pública conferida.
  HTTP 200 no portal e consultas de Processos/painel/vínculos/participantes pela
  demo. Fluxo de artefatos completo validado somente no ambiente descartável,
  pois não há processo real cadastrado. Menu Processos disponível para consulta.
- Rollback: `g360-api:rollback-b120801-processes-20261116` e Web equivalente.
  Logs/scripts em `/tmp/g360-process-release-20261116`. Alterações/scripts
  anteriores da demonstração preservados e mantidos fora destes commits.

## Projetos: gestão completa (2026-11-16, publicado)

Pedido do usuário: o módulo Projetos restaurado "não tinha nada de funcional";
aplicar todas as funcionalidades. Feito pelo Claude Code na máquina Windows,
com outra IA trabalhando em paralelo. Publicado junto com Processos + PMO no
commit `38bc965` (registro da publicação na seção "Processos com PMO integrado").

- Diagnóstico: só era possível criar projeto, incluir tarefa/marco e digitar o
  progresso. Não havia edição nem exclusão de projeto, tarefa ou marco pela
  tela, nem troca de status, custos, riscos, equipe ou status report.
- Migration nova e aditiva `20261116180000_project_management`: colunas novas em
  `Project` (código `PRJ-0001` único por empresa, prioridade, categoria,
  patrocinador, gerente, termo de abertura, lições aprendidas, datas reais),
  `ProjectTask` (descrição, fase, responsável usuário, conclusão) e
  `ProjectMilestone` (descrição, conclusão); tabelas `ProjectMember`,
  `ProjectCost`, `ProjectRisk` e `ProjectUpdate`; cinco enums; CHECKs de valor.
  Projetos existentes recebem código sequencial. **Backup antes de publicar.**
- API (`/projects`): edição validada, exclusão lógica, duplicação com
  deslocamento do cronograma, `GET /projects/options`, filtros de prioridade e
  gerente, CRUD de marcos, tarefas (com reordenação), equipe, custos, riscos e
  status report. Lista e portfólio trazem custo previsto/realizado, riscos e
  última saúde. Área continua derivada do indicador vinculado.
- Prazo que vence hoje não conta mais como vencido (fuso de São Paulo). Meu Dia
  encontra tarefas pelo usuário responsável e mantém a busca por nome nas
  tarefas antigas. Concluir pelo quadro de Tarefas grava a data de conclusão.
- Web: `/projects/[id]` em abas (Visão geral, Cronograma, Custos, Riscos,
  Equipe, Status report) com editar, duplicar, excluir e troca de status;
  `/projects/cronograma` com cartões, lista e quadro por status, filtros novos
  e estado vazio com atalho de criação. Componentes em
  `apps/web/components/projects/`. Gantt mostra marcos e atrasos.
- Validado localmente: `prisma validate`; as 157 migrations aplicaram do zero
  num Postgres 17 embutido (pacote `embedded-postgres`, fora do repositório) e
  `prisma migrate diff` não mostrou diferença em nenhuma tabela de projetos;
  `scripts/check-projects.cjs` (ampliado) passou nesse banco, lendo os serviços
  do código-fonte via `tsx`; suíte completa da API com 128 de 129 arquivos e
  958 testes aprovados; web `tsc --noEmit`, lint dos arquivos alterados e 113
  testes. `tsc` da API só nos arquivos alterados (tsconfig temporário), não no
  projeto inteiro. **Sem teste em navegador e sem build Docker.**
- Falha anterior a este trabalho: `prize.module.registration.spec.ts` não
  carregava (`Cannot find module './modules/processes/processes.module'`), porque
  desde `eead7ac` o `require` dinâmico de `parked-product-modules.ts` roda dentro
  do vitest. Corrigida na rodada seguinte (Processos + PMO) só no teste, com mock.
- O `prisma generate` foi executado nesta máquina: o client local já inclui os
  modelos novos. A demonstração pública continua sem projetos cadastrados.


## Pacto Soluções e cenários da UGE (2026-11-16, carga concluída)

- Pedido original recuperado do histórico da sessão de 16/11/2026 às 15:22Z,
  retomado pelo usuário nesta conversa. Autorização para criar a empresa e o
  primeiro administrador, popular os cenários dos anexos, analisar melhorias e
  elaborar procedimento de uso. Fontes originais continuam em Downloads:
  `teste - analista de processo.docx`, `presentation.pptx` e
  `Proposta_Estrutura_UGE_PACTO (1).pdf`.
- Empresa criada no Postgres da Vultr em transação única, ID
  `2e2371bf-fdcb-461a-8864-db37a670cbb0`, slug `pacto-solucoes`.
  Acesso confirmado em `https://pacto-solucoes.gestao360.org/login`, com TLS.
  Primeiro usuário `admin@pactosolucoes.com.br`, papel `COMPANY_ADMIN` e perfil
  `ADMIN`. Plano administrativo Corporativo e 26 módulos atuais configurados.
  Endereço `Rua C-200, 246 - Jardim América`, Goiânia/GO, segmento de software
  para gestão fitness, site e perfil institucional foram extraídos das imagens
  do cabeçalho/rodapé do DOCX e incorporados ao cadastro com auditoria. CNPJ e
  telefone não informados ficaram sem preencher.
- Todos os dados operacionais são simulados e identificados dessa forma.
  Estrutura, nomes de participantes, datas, metas não informadas, custos e casos
  são premissas propostas para aplicar o estudo. A UGE coordena método e
  acompanhamento; os gestores das áreas executam e validam suas entregas.
- Carga inicial: 12 usuários, 24 nós, 11 cargos, quatro perspectivas e oito
  objetivos BSC; um ciclo OKR, quatro objetivos, 12 KRs e 12 check-ins.
  Vinte KPIs com 60 metas/resultados de agosto a outubro de 2026. Cento e
  cinquenta casos sintéticos (50 por mês) permitem conciliar mediana, P90,
  retrabalho, SLA, reabertura e volume. Vinte e quatro casos atuais e seis
  acompanhamentos de carteira completam as 180 tarefas do quadro.
- Seis projetos: A–E e piloto de 90 dias, com 24 tarefas, 24 marcos e seis
  medições iniciais de 16/11. Projeto A conserva compromisso de 19/10, reunião
  D0 em 09/11 e previsão condicional de 23–25/11. Calendário do exemplo considera
  segunda a sexta e requer validação corporativa. Prioridades recalculadas pelos
  pesos: E 4,45; A 4,05; B 3,50; C 3,20; D 2,65, conforme a apresentação.
- Seis processos com 24 artefatos SIPOC/BPMN AS-IS/BPMN TO-BE/RACI, 54 atividades,
  27 linhas RACI, 105 atribuições e 93 vínculos com os registros operacionais.
  AS-IS e modelos de treinamento publicados por fluxo auditado. TO-BE e RACI
  do processo transversal e da recuperação de A estão em revisão no cenário.
- Dezenove desvios/tratativas/planos com 76 tarefas, 76 sessões de análise,
  114 hipóteses Ishikawa, 95 respostas dos 5 Porquês, 19 5W2H, 76 etapas PDCA e
  19 evidências textuais sintéticas. Três reuniões mensais fechadas com 60
  snapshots, decisões, follow-ups, aprendizados e padronizações; 28 reuniões
  técnicas e de governança. A Ata integrada e as curvas foram conferidas.
- A primeira tentativa foi revertida integralmente porque faltavam seis chaves
  do catálogo de Processos em produção. A carga corrigida provisionou de forma
  aditiva `processes:create/update/delete/approve/publish/manage` antes de gerar
  os perfis da empresa. Esses seis registros novos de catálogo e os novos
  registros da Pacto foram excluídos da comparação dos registros preexistentes.
  Contagens e hashes dos registros anteriores nas 545 tabelas ficaram idênticos,
  incluindo perfis e concessões anteriores.
- Backup protegido antes da carga efetiva:
  `db-backups/pre-pacto-20261116/g360-20261116-162956.dump`, 5.474.349 bytes,
  modo 600, `pg_restore --list` validado. SHA-256
  `fec9e5473f67b9996f8c9f2e04c7cbe398bd99ec3f073dcf432f151967160ac8`.
  Credencial inicial está somente em `ACESSO_PACTO.txt` no mesmo diretório
  protegido e na entrega local ignorada pelo Git. Nunca mostrar seu conteúdo
  em logs nem versionar o arquivo.
- Entrega local em `output/pacto-solucoes/`, excluída pelo `.git/info/exclude`:
  procedimento PDF de oito páginas, relatório de melhorias PDF de cinco páginas,
  fontes Markdown e arquivo privado de acesso. Layout renderizado e conferido.
  O procedimento completo também está na wiki do quadro da Pacto.
- Ensaio em Postgres 17 descartável, tmpfs e rede Docker própria, com esquema
  sem dados reais. Verificações de fórmulas, datas, prioridades, dependências,
  RACI, persistência e isolamento aprovadas. Playwright/Chromium confirmou login,
  consultas, 13 menus, seis curvas, três fechamentos, atas, análises, SIPOC/BPMN/
  RACI e BPMN a 390 pixels; 12 grupos, zero erros JavaScript.
- Após a carga, 63 verificações pela API pública da empresa aprovadas, incluindo
  acesso do administrador, entidades e artefatos, wiki e tentativa de leitura
  de indicador de outra empresa com 404. API/Web/Postgres saudáveis. Ensaio
  encerrado com remoção dos três containers próprios e da rede isolada.
- Referência de validação: imagens publicadas `0.1.0+eead7ac7`, código remoto
  `f2d589e`. O trabalho paralelo local de ampliação do PMO foi preservado.
  Scripts, fontes extraídas e evidências locais em `.git/pacto-uge/`; cópia
  executada e relatório em `db-backups/pre-pacto-20261116/`; ensaio arquivado em
  `/tmp/g360-pacto-20261116`.
- O relatório de melhorias cobre execução de casos, regras de medição,
  priorização/capacidade, baseline/previsão e implantação de capacidades
  suspensas. Também documenta uma limitação verificada: `passwordResetRequired`
  é gravado, mas o login atual não exige a troca. O arquivo de acesso orienta a
  troca manual no Perfil. As propostas devem ser reconciliadas com a entrega
  paralela de PMO antes de novo desenvolvimento.

## Processos com PMO integrado (2026-11-16, publicado)

Pedido do usuário: verificar o módulo Processos ("nada de funcional") e aplicar
portfólio, Gantt, curva S, tarefas, marcos e painel PMO. Perguntado o escopo, o
usuário escolheu "Processos + PMO" e recusou dados fictícios na demonstração.
Feito pelo Claude Code na máquina Windows, com a outra IA trabalhando em paralelo
(carga da Pacto). Publicado com OK explícito do usuário, junto com a rodada de
Projetos acima.

- Diagnóstico: o back-end de Processos funcionava (`check-process-governance.cjs`,
  seis grupos, aprovado em Postgres embutido). Falhas na tela: "Dados do processo
  e etapas" usava `?id=` e a lista só lia `focus`; etapa excluída sem confirmação;
  lista sem estado de erro; visão geral sem SIPOC, etapas e indicador. Na
  demonstração pública não há processos nem projetos, por isso as telas parecem
  vazias.
- Projeto de melhoria = projeto do módulo Projetos ligado ao processo pelo vínculo
  tipado já existente (`ProcessIntegration`, `PROJECT:<id>`). Sem migration nova e
  sem cadastro paralelo; desvincular preserva o projeto.
- API: `GET /projects` e `/projects/portfolio` aceitam `processId`; novo
  `GET /projects/portfolio/execution` (curva S do portfólio e agenda de marcos e
  tarefas, com os filtros da lista); `POST /processes/:id/projects` cria o projeto
  já vinculado (exige editar o processo e a área dele, `projects:create` e módulo
  Projetos ativo; se o vínculo falhar, o projeto é excluído logicamente);
  `GET /processes/governance/pmo` consolida por processo. Arquivos novos
  `process-pmo.service.ts`/`.controller.ts`; `ProcessesModule` importa
  `ProjectsModule`. Rotas com dois segmentos para não colidir com `GET /processes/:id`.
- `buildPortfolioCurve` no shared: média simples dos projetos com cronograma
  (cancelados fora); cada projeto conta zero enquanto nada estava planejado e,
  depois, só a partir da primeira medição; o realizado do portfólio só aparece nos
  dias em que todos têm valor.
- Web: aba "Melhoria (PMO)" no detalhe do processo (`?tab=pmo`) com indicadores,
  portfólio, Gantt, curva S, agenda com conclusão direta, criar e vincular
  projeto; painel PMO e resumo por card em `/processes`; correções acima. O
  portfólio de Projetos ganhou curva S consolidada e agenda. Gantt de portfólio
  compartilhado em `components/projects/portfolio-gantt.tsx`.
- `prize.module.registration.spec.ts` corrigido com `vi.mock` de
  `parked-product-modules` (só o teste; a API não mudou).
- Validação: shared 42 testes; API 969 testes (130 de 131 arquivos; o restante é
  o spec do prize, aprovado depois da correção) e registro do módulo; web `tsc`,
  lint e 113 testes. Em Postgres 17 embutido com as 157 migrations:
  `check-process-pmo.cjs` (novo, seis grupos), `check-process-governance.cjs` e
  `check-projects.cjs` aprovados. `tsc` da API só nos arquivos alterados. **Sem
  navegador e sem build Docker**; a injeção de dependências foi conferida por
  leitura e pelo teste de registro, não subindo a API.
- Publicado em 2026-11-16: commit `38bc965` (as duas rodadas), push em `main`,
  versão `0.1.0+38bc9652`. Antes do push, build de revisão do commit numa cópia
  isolada na Vultr (`g360-api:pmo-review-20261116` e Web equivalente; API 105 s,
  web 151 s), que fez o typecheck completo da API e aqueceu o cache. `make deploy`
  entre 17:28:08Z e 17:28:37Z (29 s).
- A outra IA estava ensaiando no servidor uma mudança de indicadores da Pacto
  (container `g360-pacto-metrics-postgres`, rede isolada). O usuário autorizou
  publicar mesmo assim; nenhum container ou arquivo dela foi tocado.
- Backup protegido: `db-backups/pre-pmo-20261116/g360-20261116-172805.dump`,
  5.806.424 bytes, modo 600, `pg_restore --list` com 4.161 linhas. SHA-256
  `55ccc22aed51875de1229a3b82506386eaea93d2aa2faf50a3da6288ce9101e9`.
  Rollback: `g360-api:rollback-eead7ac-pmo-20261116` e Web equivalente.
- Migration `20261116180000_project_management` aplicada: 157 em dia, tabelas
  545 → 549. Contagens e hashes das colunas preexistentes idênticos em Project,
  ProjectTask, ProjectMilestone, ProjectProgressSnapshot, Process,
  ProcessIntegration, User e Company. Os seis projetos (todos da Pacto) receberam
  código, sem duplicidade, com prioridade Média; tabelas novas vazias.
- Pós-deploy: API/Web/Postgres saudáveis, zero erros de nível ≥ 50 no boot da
  API e as três rotas novas mapeadas. Pela internet, 28 checagens aprovadas:
  health, páginas, versão `0.1.0+38bc9652` no login, 401 sem token nas rotas
  novas, leituras 200 e escritas 403 pela sessão pública da demonstração (que
  continua sem processos e projetos).
- Conferência SOMENTE LEITURA (transação `READ ONLY` dentro do container da API)
  com os dados simulados da Pacto: PMO com seis processos, todos com projetos;
  seis projetos ativos, avanço médio de 12%, um crítico; curva S com os seis;
  agenda com 22 marcos em aberto (um vencido) e sete tarefas com prazo próximo;
  detalhe com código PRJ, tarefas, marcos e curva. Script rodado por `node -`
  a partir de `/app/apps/api` (em `/tmp` do container ele não acha as dependências).
- Evidências e scripts em `/tmp/g360-pmo-release-20261116` na Vultr. Sem teste em
  navegador. Alterações locais da demonstração corporativa e a seção da Pacto
  (outra IA) preservadas e mantidas fora dos commits.

## Pacto Soluções: revisão para seis indicadores (2026-11-16, concluída)

- Pedido explícito do usuário: excluir todos os indicadores criados para a Pacto,
  cadastrar os seis indicadores informados e adaptar os dados e vínculos anteriores.
  Executado no banco de produção, somente na empresa
  `2e2371bf-fdcb-461a-8864-db37a670cbb0`, sem commit, push, deploy ou migration.
- Os vinte indicadores iniciais foram fisicamente excluídos; seus sessenta pares
  de metas/resultados foram substituídos por dezoito pares, em seis novos UUIDs.
  Permanecem exclusivamente: Produtividade, Lead Time, Taxa de retrabalho,
  Cumprimento de SLA, Taxa de conformidade e Satisfação do cliente.
- Resultados simulados de agosto/setembro/outubro de 2026, reconciliados com os
  cinquenta casos concluídos de cada mês: Produtividade 50/50/50 (meta 50);
  Lead Time 7,72/6,44/5,44 dias úteis (meta até 6); retrabalho 20/16/12% (até 12%);
  SLA 72/80/88% (ao menos 90%); conformidade 68/84/94% (ao menos 95%);
  satisfação 7,2/7,8/8,4 na escala de zero a dez (ao menos 8,5).
  Lead Time considera abertura até conclusão, incluindo espera e execução, com
  média mensal em dias úteis. Retrabalho conta cada caso uma vez. Avaliações de
  conformidade e satisfação foram acrescentadas e identificadas como simuladas.
- Projetos A–E e piloto, seis processos, BSC, doze KRs, dezenove desvios/planos,
  reuniões e suas referências foram adaptados. A unicidade de tratativa por
  indicador/período exigiu consolidar dezenove tratativas em cinco, preservando
  todos os dezenove planos e desvios e religando suas reuniões técnicas.
  Execução das ações preservada; eficácia deve ser revista na nova base de medição.
- Três reuniões mensais recompostas sem bloqueios, com 78 snapshots próprios e
  compartilhados e apenas seis indicadores distintos por fechamento. Integrações
  tipadas atualizadas, com deduplicação. SIPOCs atualizados por serviço auditado;
  versões imutáveis anteriores dos artefatos preservadas integralmente.
  Existem 25 artefatos atuais: os 24 iniciais e um registro preexistente à revisão.
- Transação ensaiada com reversão deliberada e verificação da restauração dos
  vinte indicadores anteriores. Aplicação efetiva atômica e idempotente pelo
  marcador `pacto.indicators.six.v2`. Contagens e hashes dos registros externos à
  Pacto comparados nas 549 tabelas, sem qualquer alteração externa pela revisão.
- Backup protegido anterior à substituição:
  `db-backups/pre-pacto-six-indicators-20261116/g360-20261116-193955.dump`,
  5.828.381 bytes, modo 600, `pg_restore --list` validado. SHA-256
  `460bbd2d75f3169b00978321d74e183a9d076fd7ecec5c339fcc53a8169a2e97`.
- Validação final: 77 verificações na API pública aprovadas, incluindo os seis
  indicadores, 404 para os vinte IDs excluídos, planos/análises, projetos/curvas,
  processos/artefatos/PMO, reuniões/ata, BSC/OKR, tarefas e isolamento entre empresas.
  Playwright na fixture isolada da versão atual confirmou os seis indicadores e
  a aba PMO com projetos, sem erros JavaScript. Imagem publicada verificada:
  `0.1.0+38bc9652`. API, Web e Postgres de produção permaneceram saudáveis.
- Ensaio em Postgres 17 descartável, dados sintéticos e tmpfs; os três containers
  próprios `g360-pacto-metrics-{web,api,postgres}` e a rede
  `g360-pacto-metrics-review` foram removidos. Nenhum volume de produção foi tocado.
- Procedimento v1.1 (oito páginas) e relatório de melhorias (cinco páginas)
  revisados, renderizados e conferidos visualmente, entregues em
  `output/pacto-solucoes/` com fontes Markdown. Procedimento também atualizado na
  wiki. PDFs e fontes arquivados no diretório protegido desta revisão; credencial
  anterior preservada, sem alteração de acesso.
- Manifesto de produção atual: `.git/pacto-uge/manifest-production.json`, cópia do
  `revision.json` protegido. O manifesto local v1 foi preservado como
  `manifest-production-v1.json`; o arquivo original no backup da carga inicial é
  histórico e não descreve os indicadores atuais. Scripts/fontes da revisão em
  `.git/pacto-uge/`, evidências em `validation/metrics-six/`; ensaio remoto em
  `/tmp/g360-pacto-indicators-20261116`. Não reexecutar a carga inicial sobre a Pacto.

## Cabeçalhos e cards de resumo (2026-11-16, publicados)

- Pedido do usuário: aplicar o card moderno da Central de Trabalho aos cabeçalhos
  equivalentes e colocar os cards informativos dentro dele, com o mesmo acabamento.
  Implementado em 28 arquivos da web. `PageHeader` compartilhado agora tem bordas
  arredondadas, gradiente discreto, brilho decorativo, ações e área de resumo;
  mantém breadcrumbs e oferece conteúdo adicional e modo compacto. `MetricCard`
  ganhou ícones em blocos coloridos, números destacados, bordas suaves e descrições
  sem corte. Valores monetários longos usam tamanho de fonte adaptado.
- Resumos agrupados no cabeçalho das páginas que usam os cards compartilhados,
  inclusive Árvore, Indicadores, Mapa Estratégico, Plano de Ação, Processos, Ata,
  Relatórios e Usuários, além das páginas correspondentes dos módulos suspensos.
  Tarefas reutiliza o mesmo cabeçalho e incorpora seus oito resumos; preserva
  preferências, filtros, busca, visualizações e criação. Meu Dia, Reunião Mensal,
  Painel Executivo e Projetos receberam a adaptação dos seus layouts próprios.
  Governança de Processos e PMO também têm superfícies e resumos modernizados.
  Grade de resumo em duas colunas no celular; filtros de OKRs ajustados para não
  ultrapassar a largura disponível. Nenhuma alteração de API, schema ou dados.
- Validação: `tsc --noEmit` aprovado; 113 testes existentes da web aprovados;
  lint dos 28 arquivos sem erros, com os mesmos 11 avisos presentes no HEAD.
  Build Docker focado da web aprovado, incluindo tipos e runtime standalone.
  Ensaio do artefato compilado em Chromium: 16 rotas a 1600, 900 e 390 pixels,
  resumos dentro do cabeçalho, sem transbordamento do cabeçalho e zero erros JS.
  Personalizar, Filtros, Lista e Nova tarefa conferidos; novos cards também
  inspecionados no tema escuro. Somente respostas sintéticas foram usadas no ensaio.
- Evidências e prévias em `output/layout-cabecalhos/compiled/`, ignoradas no Git;
  scripts e pacote em `.git/layout-review/`. Build isolado na Vultr em
  `/tmp/g360-header-review-20261116`, imagem `g360-web:headers-review-20261116`.
  Container temporário, túnel SSH e servidor local de revisão encerrados; imagem
  e relatórios preservados. API, Web e Postgres de produção seguem saudáveis.
- Publicação autorizada pelo usuário e concluída com os ajustes da rodada abaixo.
  Alterações anteriores da memória, da carga Pacto e da demonstração corporativa
  foram preservadas. O registro da publicação está ao fim deste documento.

## Reunião Mensal, Curva S e Governança (2026-11-16, publicados)

- Continuação do layout anterior: o usuário pediu o nome do indicador acima dos
  gráficos em Reunião Mensal > Conduzir, o Realizado na Curva S e uma seta para
  recolher/expandir Governança de processos no Painel Executivo.
- `IndicatorDetailView` agora identifica o indicador no cabeçalho do próprio
  gráfico, inclusive no modo embutido da apresentação, em Barras e Curva S.
  Esse título também acompanha a exportação da visão de decisão.
- Consulta de diagnóstico exclusivamente READ ONLY na Pacto confirmou uma única
  medição de progresso em cada um dos seis projetos, todas em 16/11/2026. O
  realizado individual só tinha um ponto, portanto ainda não havia segmento
  histórico para desenhar. `ProjectCurve` destaca a última medição com ponto e
  rótulo, reserva espaço nos eixos para valores em 0%/100% e informa quando há
  somente a primeira medição. Duas datas com valores desenham a linha normalmente;
  lacunas e períodos futuros continuam sem valores estimados. A mesma correção
  atende o portfólio e os projetos individuais. Nenhum histórico foi preenchido.
- `ProcessDashboard` tem botão com seta, `aria-expanded`, `aria-controls` e
  acionamento pelo teclado. Começa recolhido no Painel Executivo; em Processos
  mantém o padrão expandido. Conteúdo e link para Processos permanecem acessíveis.
- Validação: tipos da web aprovados; 113 testes da web e 14 de progresso/Curva S
  aprovados; lint dos 30 arquivos acumulados sem erros, com os mesmos 11 avisos
  do HEAD. Novo build Docker da web aprovado, incluindo tipos e standalone.
  Chromium no artefato compilado: seis cenários aprovados, zero erros JS e zero
  respostas de fixture ausentes. Conferidos abrir/recolher por mouse e teclado,
  título após clicar no indicador em Conduzir e alternar Barras/Curva S, primeira
  medição, Realizado 0%, linha com duas medições e portfólio, em desktop e celular.
- Fontes e scripts em `.git/layout-review/`; evidências e prévias em
  `output/layout-cabecalhos/fixes/compiled/`, ignoradas no Git. Novo artefato
  `g360-web:headers-fixes-review-20261116`, no ambiente isolado
  `/tmp/g360-header-review-20261116`, com `build-fixes.log` e
  `browser-fixes-report.json`. Container, túnel e servidor local de revisão
  encerrados; produção saudável, sem troca das imagens publicadas.
- O usuário autorizou commit, push, deploy e migrations necessárias. O conjunto
  foi publicado junto com o novo layout, conforme o registro abaixo.

## Publicação dos cabeçalhos e correções visuais (2026-11-16, concluída)

- Autorização explícita recebida nesta conversa. Commit `05b3da5`, enviado a
  `origin/main`, com os 30 arquivos da web. API, shared, schema e migrations não
  tiveram alterações. O trabalho paralelo da demonstração corporativa permanece
  fora dos commits desta publicação; a documentação própria da Pacto foi preservada.
- Preflight confirmou branch `main`, servidor sem alterações rastreadas e URLs
  `DATABASE_URL`/`DIRECT_URL` no Postgres local, com credenciais conferidas sem
  exibição. As 157 migrations estavam aplicadas. `make deploy` executou novamente
  `prisma migrate deploy`: nenhuma migration pendente e nenhuma alteração de schema.
- Imagens finais preparadas com o portal no ar. Publicação por `make deploy` de
  20:55:18Z a 20:55:50Z (32 segundos). Versão servida `0.1.0+05b3da5f`.
  API, Web e Postgres saudáveis; inicialização da API sem eventos de nível >= 50.
- Backup anterior protegido:
  `db-backups/pre-headers-20261116/g360-20261116-205034.dump`, 5.879.744 bytes,
  modo 600, `pg_restore --list` validado. SHA-256
  `9d7f7c71278bc3884b593135df4c205654b984a03c84332d116a0abc0367f5f1`.
  Imagens para retorno: `g360-api:rollback-38bc965-headers-20261116` e Web equivalente.
- Pós-publicação: nove verificações HTTP públicas aprovadas, incluindo versão no
  login, saúde e 401 sem sessão nas rotas de projetos/PMO. Na API real da Pacto,
  77 verificações aprovadas: seis indicadores, resultados, projetos, processos,
  artefatos, planos, reuniões, BSC/OKR, tarefas e isolamento entre empresas.
  Mantidos os seis indicadores, 19 planos e cinco tratativas consolidadas.
- Chromium nos assets efetivamente publicados, com respostas de API sintéticas:
  seis cenários aprovados, zero erros JS. Conferidos o nome acima do gráfico em
  Conduzir (Barras e Curva S), seta de Governança por mouse e teclado, Realizado
  em primeira medição e em 0%, linha com duas datas e Curva S do portfólio, em
  desktop e celular. Evidências locais em
  `output/layout-cabecalhos/fixes/production-05b3da5/`.
- Logs, relatórios de API/HTTP/navegador e IDs de imagens arquivados em
  `db-backups/pre-headers-20261116/`. No Docker 29, o prebuild e o deploy da Web
  tiveram o mesmo manifest/config, mas IDs de manifest list distintos devido à
  nova atestação. Conferir a imagem em execução contra a tag final e a versão
  servida, em vez de exigir igualdade com o ID da exportação de prebuild.
- O commit posterior de documentação não exige outro build: a versão publicada
  continua vinculada ao commit de código `05b3da5`, mesmo com HEAD mais recente
  contendo somente o registro operacional.


## Documentos / GED (2026-11-16, concluído localmente; não publicado)

- Continuação do trabalho da Ultra IA descrito no anexo Texto colado.txt. Pedido:
  reativar como Documentos no menu, sem ligação com Treinamento, editor sem
  licença paga e arquivos no Postgres normal. Implementação anterior preservada
  e concluída, sem commit, push, deploy ou alteração no banco de produção.
- Editor visual Tiptap 3.32.2 (MIT), PDF real com pdf-lib 1.17.1 e QR Code com
  qrcode 1.5.4. Editor visual é o padrão; Word/Collabora/WOPI/WebDAV permanecem
  opcionais. Sem conversor de Word, PDF de DOCX usa texto extraído com aviso.
  PDF pronto é conteúdo principal distinto de anexos comuns. Não há OCR de PDF.
- Fluxo com revisores/aprovadores designados, sequência/paralelo, segregação
  do elaborador, conteúdo congelado e confirmação de senha. Assinatura eletrônica
  interna (HMAC/auditoria), sem certificado ICP-Brasil. Publicação, agendamento,
  revisões, leitura obrigatória, busca, solicitações, relações, impacto,
  documentos externos, temporalidade e integração com Meu Dia entregues.
- Correções adicionais da retomada: bloqueio transacional por documento e leitura
  atualizada das etapas; aprovações simultâneas concluem o fluxo e duplo clique
  não duplica assinaturas. Conteúdo/formatos/envio/publicação recusam estado
  alterado durante a operação. Assinatura da publicação só é gravada junto
  da publicação confirmada. Índice de busca não sobrescreve edição mais recente.
- Fila do editor aguarda todas as gravações antes de mudar de aba/formato; falha
  preserva a edição e mantém a aba aberta. Editor remonta por documento. No
  celular, confirmação de leitura fica acima da navegação inferior. Descarte
  remove bytes, texto/JSON, índice e checkpoints após o prazo, mantendo auditoria.
- Storage padrão DATABASE em document_blobs (BYTEA), com metadados em
  document_files. Chaves legadas em disco continuam sendo lidas; proteção
  de caminho corrigida para exigir descendente do diretório de storage.
  Na futura publicação, conferir explicitamente DOCUMENT_STORAGE_PROVIDER=DATABASE
  no .env; valor LOCAL já existente continua prevalecendo. Preservar o volume
  antigo e seu backup enquanto houver referências a arquivos locais.
- Nova migration aditiva 20261116200000_documents_modernization, ainda pendente
  em produção: formatos/JSON/busca, blobs, assinaturas, prazos e solicitações.
  Ensaio aplicou todas as 158 migrations do zero em Postgres 17.5 descartável,
  localhost:54329/g360_documents_review, apenas dados sintéticos. Nenhum seed
  geral nem dado real foi usado. Diff global apresentou divergências históricas
  fora do GED (FKs de Segurança e índices/nomes legados); SQL não foi aplicado.
- Validação: API completa 134 arquivos/1.018 testes; focal GED/Meu Dia 82 testes,
  assinaturas revalidadas após o último ajuste; Web 116 e shared 51 aprovados.
  Prisma validate, compilação da API e empacotamento focado (366 arquivos)
  aprovados. Lint de 54 arquivos API/Web sem erros/avisos. Build Web focado
  gerou 94 páginas, verificou tipos e rodou via next start. No Windows, a cópia
  de ensaio usa junction e não gera standalone; Linux/Docker será conferido
  no pré-deploy autorizado. Fontes da Web comparadas byte a byte com a cópia
  compilada (26 arquivos alterados).
- Integração real com Postgres: 14 cenários aprovados, incluindo aprovação
  concorrente, clique duplicado, snapshot antigo, falha de PDF, isolamento,
  publicação/bytes no banco, busca, leituras e descarte. Chromium no bundle:
  nove cenários aprovados com quatro perfis, em desktop/celular, sem erros JS.
  Empresa sintética recebeu somente liberação explícita de Documentos; os
  bloqueios de plano/empresa reais permanecem respeitados.
- Guia docs/GED_DOCUMENTOS.md reescrito. Ensaio portátil em
  scripts/check-documents.cjs usa dependências/compilados da API e recusa banco
  fora de localhost/g360_documents_review ou sem DOCUMENTS_REVIEW_ISOLATED=1.
  Evidências/scripts temporários em test-results/documents-resume/ (ignorado).
- Preservados os arquivos e o trecho anterior da demonstração corporativa.
  HEAD continua 99f9dbd; produção permanece no código 05b3da5, sem reexecutar
  cargas da Pacto. Apresentar o resumo e receber OK específico para publicar
  esta nova evolução antes de commit/push/deploy/migration, conforme regra
  operacional e o fluxo local informado no anexo.
- Serviços temporários Web/API/Postgres encerrados e portas de ensaio conferidas.
