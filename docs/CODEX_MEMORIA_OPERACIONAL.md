# Memoria Operacional do Projeto

Atualizada em: 2026-07-01

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
- O banco de producao e DigitalOcean Managed PostgreSQL. Nao criar, subir ou
  restaurar um Postgres local sem pedido explicito do usuario.
- Nao executar seeds em producao sem autorizacao especifica. Alguns seeds limpam
  e recriam dados.

## Estado Geral

- Repositorio local atual:
  `D:\Projetos\gestao-indicadores-sqlite`
- Remote GitHub:
  `https://github.com/aldemirfidelis/gestao-360-indicadores.git`
- Branch publicada em producao: `main`
- Dominio de producao: `https://gestao360.org`
- Healthcheck publico da API: `https://gestao360.org/api/health`
- Droplet da aplicacao: `159.89.91.222`
- Diretorio no droplet: `/opt/gestao-360-indicadores`
- Compose de producao: `docker-compose.droplet.yml`
- Commit implantado e confirmado em 2026-07-01:
  `23a8a4a feat(lgpd): frontend do modulo de privacidade (/privacidade)`

Em 2026-07-01, os containers `g360-api`, `g360-web` e `g360-collabora`
estavam `healthy`; `g360-caddy` estava em execucao. O site e o healthcheck da
API respondiam HTTP 200.

## Estado Local e Trabalho Paralelo

No momento desta atualizacao:

- Branch local: `feat/ajustes-5w2h-pdca-painel`
- A branch apontava para o mesmo commit de `main` e `origin/main`.
- Havia trabalho paralelo nao commitado nos modulos de dashboard, banco,
  resultados mensais e analises visuais.

Nao assumir que a arvore local continua limpa ou que essas alteracoes pertencem
ao Codex. Sempre executar:

```powershell
git status -sb
git diff --stat
git diff --check
```

Antes de editar um arquivo ja modificado, inspecionar o diff e preservar o
trabalho existente.

## Arquitetura de Producao

O Compose de producao possui somente estes servicos:

```text
api
web
caddy
collabora
```

Containers esperados:

```text
g360-api
g360-web
g360-caddy
g360-collabora
```

Nao existe servico `postgres` em `docker-compose.droplet.yml`.

Volumes persistentes do Compose:

- `g360_storage`: arquivos binarios do GED.
- `caddy_data`: certificados e dados do Caddy.
- `caddy_config`: configuracao persistente do Caddy.

Nao existe mais o volume `g360_pgdata` na arquitetura atual.

Fluxo de trafego:

- Caddy recebe HTTP/HTTPS nas portas 80 e 443.
- `/api/*` e encaminhado para `api:3333`.
- As demais rotas sao encaminhadas para `web:3000`.
- `collabora.gestao360.org` e encaminhado para `collabora:9980`.
- Subdominios de tenant usam TLS on-demand, condicionado pela API.

## Banco de Dados de Producao

O banco de producao e um **DigitalOcean Managed PostgreSQL**, externo aos
containers da aplicacao. Ele nao roda localmente no droplet.

Configuracao vigente:

- Provedor: DigitalOcean Managed PostgreSQL.
- Endpoint: dominio `*.ondigitalocean.com`.
- Porta observada: `25060`.
- Banco observado: `defaultdb`.
- Schema Prisma: `public`.
- TLS obrigatorio: `sslmode=require`.
- Em 2026-07-01, o Prisma confirmou 77 migrations aplicadas e schema atualizado.

As duas variaveis abaixo devem apontar para o mesmo banco gerenciado:

```text
DATABASE_URL=postgresql://...@HOST_MANAGED:25060/defaultdb?sslmode=require&schema=public&connection_limit=20
DIRECT_URL=postgresql://...@HOST_MANAGED:25060/defaultdb?sslmode=require&schema=public
```

Regras:

- `DATABASE_URL` e usada pela aplicacao e pode conter `connection_limit`.
- `DIRECT_URL` e usada pelo Prisma para migrations e deve apontar diretamente
  para o mesmo Managed PostgreSQL.
- Nenhuma das duas pode apontar para `postgres:5432`.
- Nunca voltar para Neon, Postgres local ou outro provedor sem pedido explicito.
- Nao copiar a URL completa para issue, commit, comentario ou saida de terminal.

Verificacao segura no droplet, com credenciais mascaradas:

```bash
grep -E '^(DATABASE_URL|DIRECT_URL)=' .env \
  | sed -E 's#(postgres(ql)?://)[^@]+@#\1***@#'
```

Resultado esperado para ambas:

```text
***@...ondigitalocean.com:25060/defaultdb?...sslmode=require...
```

Validacao do Prisma:

```bash
docker compose -f docker-compose.droplet.yml exec -T api \
  ./node_modules/.bin/prisma migrate status
```

### Backups do banco

O banco e gerenciado fora do Compose. Nao assumir que scripts antigos de backup
local protegem o banco atual. Confirmar politica, retencao e restauracao no
DigitalOcean Managed Databases antes de afirmar que existe um backup utilizavel.

Os scripts `scripts/backup-db.sh` e
`scripts/migrate-neon-to-droplet.sh` foram escritos para o Postgres local antigo
e nao sao compativeis com a arquitetura atual.

## Build e Validacao Local

Comandos usuais:

```bash
pnpm --filter @g360/api build
pnpm --filter @g360/web lint
pnpm --filter @g360/web build
```

O projeto usa pnpm 9.7.0.

Observacao no Windows:

- O build web pode compilar, validar tipos e gerar paginas com sucesso, mas
  falhar no final ao copiar arquivos `standalone` por erro `EPERM` de symlink.
- Esse erro pode ser uma limitacao local do Windows. O build oficial de producao
  ocorre em Docker/Linux no droplet.
- Erros anteriores ao passo de copia `standalone` continuam sendo erros reais e
  devem ser corrigidos.

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

## Pre-flight Obrigatorio do Deploy

No local:

```powershell
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
- Servicos `api`, `web`, `caddy` e `collabora`.
- Ausencia do servico `postgres`.
- `DATABASE_URL` e `DIRECT_URL` no Managed PostgreSQL.
- `sslmode=require` nas duas URLs.

Em 2026-07-01 existiam no droplet os itens nao rastreados `;` e `backups/`.
Eles preexistiam ao conserto do deploy e devem ser preservados ate o usuario
autorizar sua remocao.

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
docker logs --tail=200 g360-api
docker logs --tail=200 g360-web
```

Se aparecer Prisma `P1001`:

1. Ler o host mostrado no erro.
2. Se for `postgres:5432`, a configuracao esta obsoleta.
3. Conferir `DATABASE_URL` e `DIRECT_URL` de forma mascarada.
4. Nao criar um Postgres local vazio.
5. Corrigir a variavel divergente para o Managed PostgreSQL.
6. Recriar a API e aguardar o healthcheck.
7. Subir o Web caso ele tenha ficado em `Created`.
8. Confirmar migrations e endpoints publicos.

## Incidente de 2026-07-01

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

O backup do `.env` contem segredos, e ignorado pelo Git e nao deve ser exibido,
copiado para o repositorio ou removido sem autorizacao.

## SSH do Droplet

Configuracao:

- Host: `159.89.91.222`
- Usuario: `root`
- Chave: `~/.ssh/beeeyes_digitalocean`
- Diretorio remoto: `/opt/gestao-360-indicadores`

Exemplo:

```bash
ssh -i ~/.ssh/beeeyes_digitalocean root@159.89.91.222
```

Em 2026-07-01 o acesso SSH pela porta 22 estava funcionando. Se voltar a dar
timeout, validar VPN, firewall, chave e regras de acesso antes de atribuir a
falha ao deploy.

## Artefatos Obsoletos Conhecidos

Os arquivos abaixo ainda podem mencionar Postgres local, `postgres:5432`,
`g360_pgdata` ou migracao Neon -> droplet. Essas instrucoes nao representam a
producao atual:

- `.env.droplet.example`
- `DEPLOY-DROPLET.md`
- `docs/BANCO_LOCAL_DROPLET.md`
- `docs/CHECKLIST_PRODUCAO.md`
- `docs/README.md`
- `docs/SECURITY-AUDIT.md`
- `scripts/backup-db.sh`
- `scripts/migrate-neon-to-droplet.sh`

Nao usar esses trechos para sobrescrever o `.env` de producao. A fonte efetiva e
o Managed PostgreSQL ja configurado no droplet.

## Alteracoes Funcionais Recentes em `main`

- Modulo LGPD/Privacidade com RoPA, suboperadores e incidentes de dados.
- Pagina publica do Encarregado/DPO e materiais de politicas LGPD.
- Otimizacoes de desempenho no Web e nos hot paths da API.
- Fluxos de QR Code, PWA, rondas e ocorrencias com fila offline.
- Portal Administrativo Global com gestao de usuarios por empresa.
- Ajustes de Seguranca Patrimonial, operacao de portaria e importacao de pessoas.

Esses itens sao contexto funcional. Antes de alterar um modulo, conferir o
historico recente e os diffs locais, pois pode haver trabalho ainda nao
publicado.
