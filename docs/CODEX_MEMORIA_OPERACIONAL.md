# Memoria Operacional do Projeto

Atualizada em: 2026-10-07

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
  `docker volume rm` ou `docker volume prune -a` no droplet.
- O Postgres de desenvolvimento via `docker-compose.yml` na maquina local foi
  autorizado pelo usuario em 2026-10-07 e nunca deve receber dados reais.
- Nao executar seeds em producao sem autorizacao especifica. Alguns seeds limpam
  e recriam dados.

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
  `0 3 * * * cd /opt/gestao-360-indicadores && ./scripts/backup-db.sh >> /var/log/g360-backup.log 2>&1`
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
