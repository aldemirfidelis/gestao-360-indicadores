# Gestao 360 Indicadores

Plataforma SaaS corporativa para gestao estrategica de indicadores, OKR, KPI, planos de acao, FCA/CAPA, cronogramas, reunioes, importacao de dados, relatorios, insights e dashboards executivos.

> **Status:** sistema funcional ponta a ponta com backend NestJS + frontend Next.js, banco PostgreSQL com ~535 models Prisma, rastreabilidade pela Arvore Organizacional e Mapa Estrategico, dashboards, modulos de RH/folha/recrutamento/treinamento, regras de negocio implementadas e dados demo realistas.

> **Nota operacional (2026-10-07):** producao roda em Droplet DigitalOcean (`165.22.176.248`) com **Postgres local no proprio droplet** (container `postgres` do compose). Em 2026-10 a DigitalOcean eliminou, por falta de pagamento, o droplet antigo e o banco gerenciado, e **todos os dados de producao se perderam**; a producao foi reconstruida com banco novo. O CI do GitHub tambem estava bloqueado por cobranca. O estado operacional vigente fica em **[docs/CODEX_MEMORIA_OPERACIONAL.md](./docs/CODEX_MEMORIA_OPERACIONAL.md)**; leia-o antes de qualquer deploy. O nome antigo `gestao-indicadores-sqlite` e historico.

---

## Indice

1. [Arquitetura](#arquitetura)
2. [Setup rapido](#setup-rapido)
3. [Modulos](#modulos)
4. [Telas](#telas)
5. [API](#api)
6. [Regras de negocio](#regras-de-negocio)
7. [Convencoes](#convencoes)

---

## Arquitetura

```
gestao-360-indicadores/
├── apps/
│   ├── api/          # NestJS + Prisma + PostgreSQL + Redis (BullMQ pronto)
│   └── web/          # Next.js 15 App Router + Tailwind + shadcn-style + Recharts + React Flow
├── packages/
│   └── shared/       # Enums, schemas Zod, calculo de farol compartilhados
├── docker-compose.yml
└── .env.example
```

### Stack

| Camada     | Tecnologia |
| ---------- | ---------- |
| Frontend   | Next.js 15, React 18, TypeScript, Tailwind, shadcn-style, Recharts, React Flow, TanStack Query, React Hook Form + Zod, next-themes, jsPDF, Papaparse, date-fns |
| Backend    | NestJS 10, Prisma 5, Passport JWT, bcryptjs, Helmet, Throttler, BullMQ (stack pronta) |
| Banco      | Postgres 17 local no droplet em producao; Postgres 16 via `docker-compose.yml` em desenvolvimento |
| Cache/Fila | Redis 7 |
| Devops     | Docker Compose, pnpm workspaces |

---

## Setup rapido

**Pre-requisitos:** Node.js 20+, pnpm 9.7.0 e Docker com Compose v2. No Ubuntu:
`sudo apt install docker.io docker-compose-v2` e `sudo usermod -aG docker $USER`
(depois saia e entre de novo na sessao).

```bash
pnpm install
cp .env.example .env                        # troque JWT_ACCESS_SECRET/JWT_REFRESH_SECRET por valores aleatorios
ln -s ../../.env apps/api/.env              # API e Prisma leem o .env de apps/api
ln -s ../../.env apps/web/.env.local        # Next le o .env de apps/web
pnpm shared:build                           # Build do package compartilhado (necessario antes do dev)
pnpm db:up                                  # Sobe Postgres 16 + Redis 7
pnpm --filter @g360/api prisma:deploy       # Aplica as migrations (ver nota abaixo)
pnpm db:seed                                # Popula dados demo
pnpm dev                                    # API e Web em paralelo (ja inclui shared:build)
```

> **Migrations:** desde 2026-10-07 o historico constroi o banco do zero (a migration `20260526115900_restore_dbpush_drift` recriou tabelas que tinham entrado so por `db push`). Prefira `prisma migrate deploy` (`prisma:deploy`) para montar o banco: ele cria tambem o trigger, os indices parciais e os `CHECK`s escritos em SQL, que `db push` nao cria. Existe uma diferenca antiga e conhecida entre as migrations e o `schema.prisma` (FKs extras na Seguranca Patrimonial, alguns indices e nomes truncados); por isso `prisma migrate dev` (usado por `pnpm db:migrate` e `pnpm setup`) propoe uma migration que apaga essas FKs — revise antes de aceitar.

No Windows (PowerShell), use `Copy-Item .env.example .env` e copie o arquivo para `apps/api/.env` e `apps/web/.env.local` em vez de criar links.

## Documentacao

A fonte de verdade viva para onboarding, stack, producao, gate e documentos essenciais fica em **[docs/README.md](./docs/README.md)**.

## Documentacao visual

Foi adicionada uma documentacao visual completa do fluxo da aplicacao em **[docs/fluxograma-completo.md](./docs/fluxograma-completo.md)**.

Para abrir uma versao navegavel, imprimir em PDF ou baixar os diagramas em SVG, use **[docs/fluxograma-completo.html](./docs/fluxograma-completo.html)**.

A arquitetura funcional atualizada, incluindo rastreabilidade pela Arvore Organizacional, eventos, status history e fluxo completo do indicador, esta documentada em **[docs/arquitetura-gestao-360.md](./docs/arquitetura-gestao-360.md)**.

O novo fluxo inteligente para tratar indicadores fora da meta esta documentado em **[docs/fluxo-tratativa-indicador-fora-meta.md](./docs/fluxo-tratativa-indicador-fora-meta.md)**.

A central administrativa de Configuracoes, com Usuarios, Auditoria, Parametros, Seguranca e Sistema, esta documentada em **[docs/configuracoes-administracao.md](./docs/configuracoes-administracao.md)**.

O Mapa Estrategico editavel, com perspectivas, objetivos, indicadores, permissoes, auditoria, versionamento e integracao com a Arvore Organizacional, esta documentado em **[docs/mapa-estrategico-integrado.md](./docs/mapa-estrategico-integrado.md)**.

A nova navegacao lateral em accordion, com grupos por Visualizacoes, Lancamentos, Gestao, Relatorios e Configuracoes separadas por engrenagem, esta documentada em **[docs/navegacao-menu-accordion.md](./docs/navegacao-menu-accordion.md)**.

O modulo corporativo de Cargos e Salarios, que substitui Organograma no menu e adiciona catalogo, estrutura, tabelas salariais, enquadramento, movimentacoes, permissoes e auditoria, esta documentado em **[MODULO_CARGOS_E_SALARIOS.md](./MODULO_CARGOS_E_SALARIOS.md)**.

O modulo avancado de Plano de Acao, com origem ponta a ponta, ferramentas de analise, IA assistente, evidencias, eficacia e vinculo com Arvore Organizacional/Mapa Estrategico, esta documentado em **[docs/plano-acao-avancado.md](./docs/plano-acao-avancado.md)**.

## Deploy em producao

Setup vigente de producao: **Droplet DigitalOcean (`165.22.176.248`, criado em 2026-10 apos a DigitalOcean eliminar o antigo `159.89.91.222` e o banco gerenciado por falta de pagamento) rodando Postgres, API, Web, Caddy e Collabora**.
O banco e o servico `postgres` do `docker-compose.droplet.yml`, acessivel so pela rede interna; `DATABASE_URL` e `DIRECT_URL` apontam para `postgres:5432`.
Se a base crescer, a ideia e voltar para um Postgres externo/gerenciado (como foi de 2026-06-30 a 2026-10).
Backup diario com `scripts/backup-db.sh` e copia off-site sao obrigatorios: foi a falta disso que fez os dados se perderem em 2026-10.

O procedimento completo de pre-flight, deploy, validacao e diagnostico esta em
**[docs/CODEX_MEMORIA_OPERACIONAL.md](./docs/CODEX_MEMORIA_OPERACIONAL.md)**. Em resumo, no droplet:

```bash
cd /opt/gestao-360-indicadores
make deploy        # git pull --ff-only + build das imagens + up + prisma migrate deploy
make ps            # postgres, api, web e collabora devem ficar healthy
```

### Opcao A (vigente) — Droplet DigitalOcean
VM Linux gerenciada por voce, Caddy fazendo proxy reverso com SSL automatico. Para um droplet novo: swap de 4 GB, `apt install docker.io docker-compose-v2 docker-buildx make git ufw`, UFW liberando 22/80/443, `git clone` em `/opt/gestao-360-indicadores` e `.env` a partir do `.env.droplet.example`. O `scripts/setup-droplet.sh` faz quase tudo isso, mas instala o Docker por `get.docker.com` e nao cria swap. O **[DEPLOY-DROPLET.md](./DEPLOY-DROPLET.md)** traz o passo a passo antigo.

### Opcao B — DigitalOcean App Platform (~$10/mes)
Guia mantido apenas como referencia historica. Veja **[DEPLOY.md](./DEPLOY.md)**.

```bash
# 1. Editar .do/app.yaml (ja com repo aldemirfidelis/gestao-360-indicadores)
# 2. doctl apps create --spec .do/app.yaml
# 3. Configurar secrets no painel
```

### Stack de deploy ja pronta:
- `Dockerfile` multi-stage para API e Web (Alpine, ~80MB Web standalone)
- `docker-compose.droplet.yml` (Postgres + API + Web + Caddy + Collabora) e `.do/app.yaml` (legado App Platform)
- `Caddyfile` (proxy reverso, SSL Let's Encrypt automatico quando voce tiver dominio)
- `scripts/setup-droplet.sh` (provisiona Droplet zerada em 3 min)
- `scripts/deploy.sh` + `Makefile` (deploy / logs / restart / migrate / seed)
- `.env.droplet.example` e `.env.production.example` (templates)
- Prisma com `directUrl` e `binaryTargets` Alpine

**Credenciais demo:**
- `demo@demo.com` / `123456` (gestor da Empresa Demonstração)
- `admin@demo.com` / `123456` (admin da demonstração)
- `diretoria@demo.com` / `123456` (diretoria)
- `gestor.prod@demo.com` / `123456` (gestor de Producao) — e assim para cada area

**URLs:**
- Web: <http://localhost:3000>
- API: <http://localhost:3333/api>
- Health: <http://localhost:3333/api/health>
- Prisma Studio: `pnpm --filter @g360/api prisma:studio`

---

## Modulos

### Backend (apps/api)

| Modulo | Endpoints principais | Descricao |
| ------ | -------------------- | --------- |
| `auth` | `POST /auth/login`, `/refresh`, `/logout`, `GET /auth/me` | JWT com refresh hash SHA-256 e audit log |
| `users` | CRUD basico de usuarios | Multi-tenant por companyId |
| `companies` | `GET /companies/me`, `/me/branches` | Empresa logada e filiais |
| `orgnodes` | `GET /orgnodes`, `/tree`, CRUD, `PATCH /:id/move` | Arvore organizacional recursiva |
| `indicators` | CRUD + `/series`, `/targets`, `/children`, `/tree/graph`, `/impact` | KPIs, metas, relacoes pai-filho e simulacao de impacto |
| `results` | `GET /results/pending`, `POST /results`, `/batch`, `POST /:id/approve` | Lancamentos com calculo automatico de farol |
| `deviations` | CRUD + causas, analises (`/causes`, `/analyses`), `POST /:id/close` | FCA/CAPA com 6 metodos (FCA, 5 Porques, Ishikawa, Pareto, CAPA, simples) |
| `actions` | CRUD + subtarefas (`/tasks`), `PATCH /:id/status` | Kanban com recalculo automatico de progresso |
| `dashboard` | `/overview`, `/ranking`, `/evolution`, `/worst`, `/pending` | Agregacoes para o dashboard executivo |
| `strategy` | CRUD de mapas, perspectivas, objetivos, layout, vinculos, relacoes e versoes | Mapa estrategico editavel integrado a Arvore Organizacional |
| `okrs` | CRUD de ciclos, objetivos, KRs e check-ins | Calculo de progresso ponderado por peso |
| `projects` | CRUD + milestones + tasks com dependencias | Suporte a Gantt |
| `meetings` | CRUD + participantes, agenda, decisoes, `POST /:id/actions` | Reuniao gera acao com origin=MEETING |
| `notifications` | `GET /`, `/count`, `PATCH /:id/read`, `POST /read-all`, `/generate` | Alertas internos + gerador de regras |
| `audit` | `GET /audit` com filtros | Rastro de quem-fez-o-que |
| `imports` | `POST /preview`, `/commit`, `GET /jobs` | Importacao CSV com validacao linha a linha |
| `reports` | `/indicators.csv`, `/results.csv`, `/actions.csv`, `/deviations.csv` | Exports CSV com BOM para Excel pt-BR |
| `insights` | `GET /insights` | Heuristicas locais: resumo executivo, tendencia, sugestoes |
| `traceability` | `/traceability`, `/traceability/indicators/:id` | Linha de rastreabilidade e historico completo do indicador |
| `search` | `/search?q=...` | Busca global entre indicadores, estrutura, acoes, desvios, reunioes, usuarios e objetivos |
| `health` | `GET /health` | Health check sem auth |

### Frontend (apps/web)

| Rota | Tela |
| ---- | ---- |
| `/login` | Login com tema claro/escuro e branding em duas colunas |
| `/` | **Dashboard executivo**: KPIs, evolucao 12m, ranking de areas, top criticos, pendencias |
| `/insights` | **Insights** consumindo o backend com cards categorizados (resumo, tendencia, causas, acoes) |
| `/strategy` | Lista de mapas estrategicos |
| `/strategy/:id` | **Mapa estrategico** com objetivos por perspectiva, farol agregado, edicao de status inline, criacao de objetivos |
| `/okrs` | **OKRs**: ciclos, objetivos, KRs com edicao inline de valor, **check-in semanal** com sliders, calculo automatico de status |
| `/indicators` | Lista com busca e filtro por farol |
| `/indicators/new` | **Formulario completo de novo indicador** com 14 campos |
| `/indicators/:id` | Detalhe: cards, grafico meta vs realizado, **editor de metas**, historico, botao **"abrir desvio"** se vermelho |
| `/results` | Grid de **lancamentos em lote** com calculo automatico de farol |
| `/tree` | Rota legada redirecionada para `/org`; a rastreabilidade operacional fica na Arvore Organizacional e no Mapa Estrategico |
| `/deviations` | Lista com severidade e contagens |
| `/deviations/:id` | **Detalhe completo do desvio** com Ishikawa 6M, editor de causas, multiplas analises (5 Porques, Ishikawa, Pareto, CAPA), fechamento que valida acoes abertas |
| `/actions` | Kanban com 4 colunas e troca rapida de status |
| `/actions/:id` | **Detalhe da acao** com subtarefas, edicao de descricao/datas/custo, status |
| `/projects` | Lista de projetos com progresso |
| `/projects/:id` | **Gantt SVG** com dependencias visualizadas, marcos com toggle, tarefas com edicao de progresso |
| `/meetings` | Lista + dialog de criacao |
| `/meetings/:id` | **Detalhe da reuniao** com pauta, participantes (toggle presenca), decisoes e **gerador de acao** |
| `/imports` | **Wizard CSV** com download de modelo, parse no browser (Papaparse), preview com erros linha a linha, commit em lote |
| `/reports` | **PDF executivo** gerado no browser (jsPDF) + 4 exports CSV |
| `/org` | Estrutura organizacional em arvore colapsavel |
| `/users` | Lista de usuarios com perfis |
| `/audit` | **Tabela de auditoria** com filtros por entidade e acao |
| `/settings` | Empresa e filiais |

### Componentes globais
- **Sidebar accordion** com grupos de Visualizacoes, Lancamentos, Gestao e Relatorios, filtrada por permissoes e com Configuracoes separadas no rodape por engrenagem
- **Topbar** com busca, **sino de notificacoes** com contador, toggle de tema, perfil
- **NotificationsBell** com dialog + endpoint `POST /notifications/generate` para rodar regras de alerta sob demanda

---

## Modelagem (Prisma) - ~535 models

O schema Prisma tem ~535 models e ~188 enums (535 models / 188 enums e 151 migrations em 2026-10-07, num `schema.prisma` de ~15,8k linhas) e cobre multiempresa, estrutura organizacional, usuarios/permissoes, estrategia, OKRs, indicadores, resultados, desvios, planos de acao, reunioes, documentos, auditorias, processos, formularios, Portal Admin, Platform Admin, mensageria, workflows, integracoes e modulos corporativos adicionais.

**Padroes:** `createdAt`, `updatedAt`, `deletedAt` em todas entidades de negocio (soft delete). `companyId` em todas (multi-tenant). Indices em campos quentes. Enums em Prisma + espelhados em `packages/shared/src/enums.ts`.

---

## Regras de negocio implementadas

- **Tratativa automatica de indicador fora da meta**: ao salvar resultado vermelho, o backend cria/atualiza uma `TreatmentCase`, registra historico e direciona a operacao para Plano de Acao.
- **Tratativa incorporada em Plano de Acao**: `/treatments` e detalhes de tratativa redirecionam para `/actions`; analise, reuniao, evidencias, responsaveis e reavaliacao vivem na experiencia de acoes.
- **Convites de reuniao com ICS**: `POST /meetings/:id/invitations/send` gera iCalendar e registra `EmailLog`; se SMTP nao estiver configurado, o envio fica como `PENDING` sem perder auditoria.
- **Status automatico da tratativa**: acoes vinculadas atualizam a tratativa para em andamento, atrasada ou aguardando reavaliacao; novo resultado verde resolve o caso.
- **Mapa de relacoes dentro de estrategia**: relacoes entre objetivo, indicador, desvio, reuniao e acao pertencem ao contexto de `strategy`/Mapa Estrategico, nao a um modulo de produto separado.
- **Calculo de farol automatico** (`packages/shared/src/status.ts`): direcao maior-melhor / menor-melhor / igual / faixa, retorna verde/amarelo/vermelho/cinza + atingimento + desvio. Mesmo codigo no front (badges) e backend (gravacao).
- **Sugestao de desvio**: `POST /results/batch` retorna `shouldOpenDeviation: true` quando o lancamento ficou vermelho; a UI exibe toast.
- **Abertura de desvio com numero sequencial** por empresa.
- **Bloqueio de fechamento de desvio** se houver acoes vinculadas em aberto.
- **`DONE_LATE` automatico**: marcar acao como `DONE` apos o prazo grava `DONE_LATE`.
- **Progresso da acao recalculado** quando subtarefa muda de estado.
- **Indicador atrasado** = `dueDate < hoje` AND status nao concluido — destacado em vermelho no Kanban.
- **OKR — status automatico no check-in**: `confidence >= 0.7 && progress >= 0.3` → ON_TRACK; `confidence < 0.4` → OFF_TRACK; demais → AT_RISK; `progress >= 0.95` → DONE.
- **OKR — progresso ponderado**: progresso de cada KR conforme direcao (HIGHER_BETTER/LOWER_BETTER), e do objetivo conforme peso dos KRs.
- **Mapa estrategico com farol agregado**: cada objetivo recebe um farol baseado nos indicadores vinculados (qualquer vermelho → vermelho, qualquer amarelo → amarelo, todos verdes → verde).
- **Simulacao de impacto** na arvore de indicadores: BFS ate profundidade configuravel com peso acumulado.
- **Importacao CSV** valida cada linha contra o schema do indicador (verifica codigo existente, area existente, valor numerico).
- **Notificacoes geradas por regras**: indicador vermelho sem notificacao previa + acao atrasada com responsavel.
- **Auditoria de login** com IP e user-agent automatico.

## Fluxo de indicador fora da meta

1. Lance um resultado em `/results`.
2. Se o farol calculado for vermelho, a tela mostra "Indicador fora da meta detectado" e oferece seguir para Plano de Acao.
3. Em `/actions`, registre problema, causa provavel, causa raiz e metodo de analise: 5 Porques, Ishikawa, Pareto, PDCA, MASP, DMAIC, FCA, CAPA ou simples.
4. Agende a "Reuniao de Tratativa do Indicador"; a pauta e o titulo sao sugeridos a partir do indicador, meta, resultado e desvio.
5. Adicione participantes internos ou externos com nome, e-mail, area, cargo e papel.
6. Envie convites pela reuniao. O sistema gera ICS e registra `EmailLog` por participante. Para envio real, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.
7. Crie acoes pela aba de plano de acao da reuniao ou diretamente em `/actions`. As acoes ficam vinculadas ao indicador, analise, reuniao e tratativa tecnica.
8. Ao concluir as acoes, lance novo resultado e use "Reavaliar indicador". Resultado verde resolve a tratativa; resultado vermelho marca como nao resolvida.

Tabelas novas/alteradas neste fluxo: `TreatmentCase`, `MeetingGuest`, `EmailLog`, `CalendarInvite`, novos campos em `Meeting`, `MeetingParticipant` e `ActionPlan`, e novos eventos em `TraceabilityEvent`.

---

## Convencoes

- **TypeScript estrito** em todo lugar.
- **Validacao com Zod** nas bordas (controllers + forms).
- **Soft delete** em vez de DELETE fisico.
- **periodRef como string canonica** (`YYYY-MM`, `YYYY-Q1`, etc.) — `apps/api/src/modules/indicators/period.util.ts`.
- **Status calculado** sempre via `calcStatus` do `@g360/shared`.
- **Tema** via `next-themes` com tokens HSL em `globals.css`.
- **Refresh transparente em 401** no `lib/api.ts` do front.

---

## Comandos uteis

```bash
pnpm dev                  # API + Web em paralelo
pnpm dev:api              # Apenas API
pnpm dev:web              # Apenas Web

pnpm db:up                # docker compose up postgres redis
pnpm db:down              # docker compose down
pnpm db:migrate           # prisma migrate dev: cria migration nova (revise o SQL gerado)
pnpm --filter @g360/api prisma:deploy   # Aplica as migrations existentes
pnpm db:seed              # Popula demo
pnpm db:reset             # CUIDADO: dropa e recria

pnpm --filter @g360/api prisma:studio    # GUI do banco
pnpm --filter @g360/shared test          # Testes de calcStatus
pnpm build                               # Build de tudo
```

---

## Notas de honestidade

- **CI parado:** desde julho de 2026 o GitHub Actions nao executa os jobs ("account is locked due to a billing issue"). Ate resolver a cobranca, rode localmente o gate do `.github/workflows/ci.yml` antes de publicar.
- **BullMQ:** os workers existem em `apps/api/src/jobs` (notificacoes, automacoes, premio), mas ficam desligados por padrao (`WORKERS_ENABLED=false`). `POST /notifications/generate` roda as regras sob demanda.
- **Multi-tenancy** filtra por `companyId` nos controllers, mas falta RLS no Postgres para isolamento forte.
- **Permissoes granulares**: catalogo de permissoes ja semeado no banco e o decorator `@Roles` funciona, mas o enforcement detalhado de `permissions:key` por endpoint ainda nao esta espalhado em todos os controllers.
- **IA:** os recursos de IA (insights, planos de acao, reunioes, formularios, recrutamento, entre outros) usam Google Gemini (`GEMINI_API_KEY`). Sem a chave, insights e sugestoes voltam para regras deterministicas.

Tudo o que esta documentado acima como "Implementado" **funciona de verdade** — login, lancar valores, ver farol mudar, abrir desvio, gerar acao automatica, fechar desvio bloqueado por acoes abertas, check-in de OKR mudando status, importar CSV com erros linha a linha, exportar PDF, navegar arvore de indicadores e simular impacto.

---

## Licenca

Proprietario — todos os direitos reservados.
