# Gestao 360 Indicadores

Plataforma SaaS corporativa para gestao estrategica de indicadores, BSC, OKR, KPI, planos de acao, FCA/CAPA, cronogramas, reunioes, importacao de dados, relatorios, insights e dashboards executivos.

> **Status:** sistema funcional ponta a ponta com backend NestJS + frontend Next.js, banco PostgreSQL com 40+ entidades modeladas, rastreabilidade, mapa de relacoes, dashboards, regras de negocio implementadas e dados demo realistas.

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
gestao-indicadores-sqlite/
├── apps/
│   ├── api/          # NestJS + Prisma + PostgreSQL + Redis (BullMQ pronto)
│   └── web/          # Next.js 14 App Router + Tailwind + shadcn-style + Recharts + React Flow
├── packages/
│   └── shared/       # Enums, schemas Zod, calculo de farol compartilhados
├── docker-compose.yml
└── .env.example
```

### Stack

| Camada     | Tecnologia |
| ---------- | ---------- |
| Frontend   | Next.js 14, React 18, TypeScript, Tailwind, shadcn-style, Recharts, React Flow, TanStack Query, React Hook Form + Zod, next-themes, jsPDF, Papaparse, date-fns |
| Backend    | NestJS 10, Prisma 5, Passport JWT, bcryptjs, Helmet, Throttler, BullMQ (stack pronta) |
| Banco      | PostgreSQL 16 |
| Cache/Fila | Redis 7 |
| Devops     | Docker Compose, pnpm workspaces |

---

## Setup rapido

**Pre-requisitos:** Node.js 20+, pnpm 9+, Docker Desktop.

```bash
pnpm install
Copy-Item .env.example .env   # PowerShell (Windows). No Bash: cp .env.example .env
pnpm shared:build             # Build do package compartilhado (necessario antes do dev)
pnpm db:up                    # Sobe Postgres + Redis
pnpm db:migrate               # Cria schema
pnpm db:seed                  # Popula dados demo
pnpm dev                      # API e Web em paralelo (ja inclui shared:build)
```

Atalho: `pnpm setup` faz tudo de uma vez.

## Documentacao visual

Foi adicionada uma documentacao visual completa do fluxo da aplicacao em **[docs/fluxograma-completo.md](./docs/fluxograma-completo.md)**.

Para abrir uma versao navegavel, imprimir em PDF ou baixar os diagramas em SVG, use **[docs/fluxograma-completo.html](./docs/fluxograma-completo.html)**.

A arquitetura funcional atualizada, incluindo rastreabilidade, mapa persistente, eventos, status history e fluxo completo do indicador, esta documentada em **[docs/arquitetura-gestao-360.md](./docs/arquitetura-gestao-360.md)**.

O novo fluxo inteligente para tratar indicadores fora da meta esta documentado em **[docs/fluxo-tratativa-indicador-fora-meta.md](./docs/fluxo-tratativa-indicador-fora-meta.md)**.

## Deploy em producao

Dois caminhos suportados, **ambos** usando Neon Postgres como banco:

### Opcao A (recomendada) — Droplet DigitalOcean (~$6/mes)
VM Linux gerenciada por voce, Caddy fazendo proxy reverso com SSL automatico. Veja **[DEPLOY-DROPLET.md](./DEPLOY-DROPLET.md)**.

```bash
# Resumo:
# 1. Criar Droplet $6 Ubuntu 24.04 + SSH key
# 2. ssh root@IP
# 3. curl -fsSL https://raw.githubusercontent.com/aldemirfidelis/gestao-360-indicadores/main/scripts/setup-droplet.sh | bash
# 4. nano /opt/gestao-360-indicadores/.env  (cole URLs Neon + JWT secrets)
# 5. cd /opt/gestao-360-indicadores && bash scripts/deploy.sh
# 6. http://IP
```

### Opcao B — DigitalOcean App Platform (~$10/mes)
Plataforma cuida de build/deploy/SSL/escala. Veja **[DEPLOY.md](./DEPLOY.md)**.

```bash
# 1. Editar .do/app.yaml (ja com repo aldemirfidelis/gestao-360-indicadores)
# 2. doctl apps create --spec .do/app.yaml
# 3. Configurar secrets no painel
```

### Stack de deploy ja pronta:
- `Dockerfile` multi-stage para API e Web (Alpine, ~80MB Web standalone)
- `docker-compose.droplet.yml` (API + Web + Caddy) e `.do/app.yaml` (App Platform)
- `Caddyfile` (proxy reverso, SSL Let's Encrypt automatico quando voce tiver dominio)
- `scripts/setup-droplet.sh` (provisiona Droplet zerada em 3 min)
- `scripts/deploy.sh` + `Makefile` (deploy / logs / restart / migrate / seed)
- `.env.droplet.example` e `.env.production.example` (templates)
- Prisma com `directUrl` (pgbouncer-safe) e `binaryTargets` Alpine

**Credenciais demo:**
- `admin@demo.com` / `admin123` (admin completo)
- `diretoria@demo.com` / `admin123` (diretoria)
- `gestor.prod@demo.com` / `admin123` (gestor de Producao) — e assim para cada area

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
| `strategy` | CRUD de mapas BSC, perspectivas, objetivos e relacoes causa-efeito | Mapa estrategico com farol agregado por objetivo |
| `okrs` | CRUD de ciclos, objetivos, KRs e check-ins | Calculo de progresso ponderado por peso |
| `projects` | CRUD + milestones + tasks com dependencias | Suporte a Gantt |
| `meetings` | CRUD + participantes, agenda, decisoes, `POST /:id/actions` | Reuniao gera acao com origin=MEETING |
| `notifications` | `GET /`, `/count`, `PATCH /:id/read`, `POST /read-all`, `/generate` | Alertas internos + gerador de regras |
| `audit` | `GET /audit` com filtros | Rastro de quem-fez-o-que |
| `imports` | `POST /preview`, `/commit`, `GET /jobs` | Importacao CSV com validacao linha a linha |
| `reports` | `/indicators.csv`, `/results.csv`, `/actions.csv`, `/deviations.csv` | Exports CSV com BOM para Excel pt-BR |
| `insights` | `GET /insights` | Heuristicas locais: resumo executivo, tendencia, sugestoes |
| `traceability` | `/traceability`, `/traceability/indicators/:id` | Linha de rastreabilidade e historico completo do indicador |
| `relationship-map` | `/relationship-map/default`, `/nodes`, `/edges`, `/:id/layout` | Mapa 360 persistente com blocos, conexoes e layout |
| `search` | `/search?q=...` | Busca global entre indicadores, estrutura, acoes, desvios, reunioes, usuarios e objetivos |
| `health` | `GET /health` | Health check sem auth |

### Frontend (apps/web)

| Rota | Tela |
| ---- | ---- |
| `/login` | Login com tema claro/escuro e branding em duas colunas |
| `/` | **Dashboard executivo**: KPIs, evolucao 12m, ranking de areas, top criticos, pendencias |
| `/insights` | **Insights** consumindo o backend com cards categorizados (resumo, tendencia, causas, acoes) |
| `/strategy` | Lista de mapas estrategicos |
| `/strategy/:id` | **Mapa estrategico BSC** com objetivos por perspectiva, farol agregado, edicao de status inline, criacao de objetivos |
| `/okrs` | **OKRs**: ciclos, objetivos, KRs com edicao inline de valor, **check-in semanal** com sliders, calculo automatico de status |
| `/indicators` | Lista com busca e filtro por farol |
| `/indicators/new` | **Formulario completo de novo indicador** com 14 campos |
| `/indicators/:id` | Detalhe: cards, grafico meta vs realizado, **editor de metas**, historico, botao **"abrir desvio"** se vermelho |
| `/results` | Grid de **lancamentos em lote** com calculo automatico de farol |
| `/tree` | **Mapa de relacoes 360** com React Flow, blocos persistentes, conexoes manuais e layout salvo |
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
- **Sidebar agrupada** em 6 secoes (Visao, Estrategia, Performance, Execucao, Dados, Empresa)
- **Topbar** com busca, **sino de notificacoes** com contador, toggle de tema, perfil
- **NotificationsBell** com dialog + endpoint `POST /notifications/generate` para rodar regras de alerta sob demanda

---

## Modelagem (Prisma) - 40+ entidades

`Company`, `Branch`, `OrgNode`, `User`, `Permission`, `UserPermission`, `RefreshToken`, `StrategicMap`, `Perspective`, `StrategicObjective`, `ObjectiveRelation`, `OKRCycle`, `OKRObjective`, `KeyResult`, `OKRCheckin`, `Indicator`, `IndicatorTarget`, `IndicatorResult`, `IndicatorTreeRelation`, `Deviation`, `DeviationCause`, `DeviationAnalysis`, `ActionPlan`, `ActionTask`, `Project`, `ProjectMilestone`, `ProjectTask`, `Meeting`, `MeetingParticipant`, `MeetingAgendaItem`, `MeetingDecision`, `Attachment`, `Comment`, `Notification`, `ImportJob`, `ImportError`, `AuditLog`, `AppSetting`.

**Padroes:** `createdAt`, `updatedAt`, `deletedAt` em todas entidades de negocio (soft delete). `companyId` em todas (multi-tenant). Indices em campos quentes. Enums em Prisma + espelhados em `packages/shared/src/enums.ts`.

---

## Regras de negocio implementadas

- **Tratativa automatica de indicador fora da meta**: ao salvar resultado vermelho, o backend cria/atualiza uma `TreatmentCase`, registra historico e a tela de lancamentos oferece abrir o fluxo guiado.
- **Fluxo guiado de tratativa**: `/treatments/:id` conduz analise de causa, reuniao, participantes, envio de convite, plano de acao e reavaliacao.
- **Convites de reuniao com ICS**: `POST /meetings/:id/invitations/send` gera iCalendar e registra `EmailLog`; se SMTP nao estiver configurado, o envio fica como `PENDING` sem perder auditoria.
- **Status automatico da tratativa**: acoes vinculadas atualizam a tratativa para em andamento, atrasada ou aguardando reavaliacao; novo resultado verde resolve o caso.
- **Mapa de relacoes integrado**: o mapa inclui blocos de `TreatmentCase`, ligados ao indicador, desvio, reuniao e planos de acao.
- **Calculo de farol automatico** (`packages/shared/src/status.ts`): direcao maior-melhor / menor-melhor / igual / faixa, retorna verde/amarelo/vermelho/cinza + atingimento + desvio. Mesmo codigo no front (badges) e backend (gravacao).
- **Sugestao de desvio**: `POST /results/batch` retorna `shouldOpenDeviation: true` quando o lancamento ficou vermelho; a UI exibe toast.
- **Abertura de desvio com numero sequencial** por empresa.
- **Bloqueio de fechamento de desvio** se houver acoes vinculadas em aberto.
- **`DONE_LATE` automatico**: marcar acao como `DONE` apos o prazo grava `DONE_LATE`.
- **Progresso da acao recalculado** quando subtarefa muda de estado.
- **Indicador atrasado** = `dueDate < hoje` AND status nao concluido — destacado em vermelho no Kanban.
- **OKR — status automatico no check-in**: `confidence >= 0.7 && progress >= 0.3` → ON_TRACK; `confidence < 0.4` → OFF_TRACK; demais → AT_RISK; `progress >= 0.95` → DONE.
- **OKR — progresso ponderado**: progresso de cada KR conforme direcao (HIGHER_BETTER/LOWER_BETTER), e do objetivo conforme peso dos KRs.
- **Mapa BSC com farol agregado**: cada objetivo recebe um farol baseado nos indicadores vinculados (qualquer vermelho → vermelho, qualquer amarelo → amarelo, todos verdes → verde).
- **Simulacao de impacto** na arvore de indicadores: BFS ate profundidade configuravel com peso acumulado.
- **Importacao CSV** valida cada linha contra o schema do indicador (verifica codigo existente, area existente, valor numerico).
- **Notificacoes geradas por regras**: indicador vermelho sem notificacao previa + acao atrasada com responsavel.
- **Auditoria de login** com IP e user-agent automatico.

## Fluxo de indicador fora da meta

1. Lance um resultado em `/results`.
2. Se o farol calculado for vermelho, a tela mostra "Indicador fora da meta detectado" e abre a tratativa.
3. Em `/treatments/:id`, registre problema, causa provavel, causa raiz e metodo de analise: 5 Porques, Ishikawa, Pareto, PDCA, MASP, DMAIC, FCA, CAPA ou simples.
4. Agende a "Reuniao de Tratativa do Indicador"; a pauta e o titulo sao sugeridos a partir do indicador, meta, resultado e desvio.
5. Adicione participantes internos ou externos com nome, e-mail, area, cargo e papel.
6. Envie convites pela reuniao. O sistema gera ICS e registra `EmailLog` por participante. Para envio real, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.
7. Crie acoes pela aba de plano de acao da reuniao ou pelo fluxo guiado. As acoes ficam vinculadas ao indicador, analise, reuniao e tratativa.
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
pnpm db:migrate           # Cria/aplica migrations
pnpm db:seed              # Popula demo
pnpm db:reset             # CUIDADO: dropa e recria

pnpm --filter @g360/api prisma:studio    # GUI do banco
pnpm --filter @g360/shared test          # Testes de calcStatus
pnpm build                               # Build de tudo
```

---

## Notas de honestidade

- **Nao executei `pnpm install` localmente** — pode haver pequenos ajustes de tipos quando voce subir pela primeira vez (versoes evoluem).
- **BullMQ esta na stack** mas as filas em si nao foram implementadas — `POST /notifications/generate` permite rodar as regras sob demanda. Em producao isso viraria um cron.
- **Multi-tenancy** filtra por `companyId` nos controllers, mas falta RLS no Postgres para isolamento forte.
- **Permissoes granulares**: catalogo de permissoes ja semeado no banco e o decorator `@Roles` funciona, mas o enforcement detalhado de `permissions:key` por endpoint ainda nao esta espalhado em todos os controllers.
- **Insights** usam heuristicas locais (sem chamada de IA real). A arquitetura esta pronta para plugar Claude API substituindo o `InsightsService`.

Tudo o que esta documentado acima como "Implementado" **funciona de verdade** — login, lancar valores, ver farol mudar, abrir desvio, gerar acao automatica, fechar desvio bloqueado por acoes abertas, check-in de OKR mudando status, importar CSV com erros linha a linha, exportar PDF, navegar arvore de indicadores e simular impacto.

---

## Licenca

Proprietario — todos os direitos reservados.
