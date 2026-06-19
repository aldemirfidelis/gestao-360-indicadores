# Documentacao completa do projeto Gestao 360

Atualizado em: 2026-06-03

Este documento descreve o estado atual do repositorio `gestao-indicadores-sqlite`, suas funcionalidades, arquitetura tecnica, modulos, telas, banco de dados, permissoes e fluxo de deploy. Ele foi produzido a partir da leitura direta do codigo-fonte, schema Prisma, rotas do frontend, controladores NestJS, scripts e arquivos Docker.

## 1. Visao geral

O Gestao 360 e uma plataforma SaaS de gestao estrategica e melhoria continua. O sistema combina:

- Mapa estrategico, perspectivas, objetivos e relacoes.
- Indicadores/KPIs com metas, resultados, farol, anexos, comentarios e historico.
- Planos de acao com execucao, tarefas, evidencias, analise de causa, eficacia, aprovacoes e IA.
- Reunioes conectadas a planos de acao, participantes, agenda, convites e tarefas.
- Desvios, tratativas de indicadores fora da meta e analises de causa.
- OKRs, projetos/cronogramas e relatorios.
- Comunicacao corporativa em tempo real, diretorio de pessoas, perfil, presenca, mensagens e anexos.
- Central de Ajuda e Central de Integracoes.
- Administracao de usuarios, perfis, permissoes, empresas, parametros e auditoria.
- Central do Portal para Super Admin controlar modulos, paginas, funcionalidades, menus, flags, manutencao, integracoes, comunicados, snapshots e diagnosticos.
- Administracao do banco para Super Admin: schema, tabelas, registros, SQL, import/export, backup, diagnosticos e auditoria.
- Matriz de visibilidade por area, permitindo definir quais areas enxergam ou editam dados de outras areas.

## 2. Estrutura do repositorio

```text
.
+-- apps
|   +-- api      # API NestJS, Prisma, regras de negocio e modulos backend
|   +-- web      # Frontend Next.js, telas, componentes e shell autenticado
+-- packages
|   +-- shared   # Tipos, schemas e utilitarios compartilhados
+-- docs         # Documentacao funcional/tecnica
+-- scripts      # Deploy, release e setup da Droplet
+-- docker-compose.yml
+-- docker-compose.droplet.yml
+-- Makefile
+-- Caddyfile
+-- pnpm-workspace.yaml
+-- package.json
```

O projeto e um monorepo `pnpm`:

- `apps/api`: pacote `@g360/api`.
- `apps/web`: pacote `@g360/web`.
- `packages/shared`: pacote `@g360/shared`.

## 3. Stack principal

### Backend

- NestJS 10.
- Prisma ORM.
- PostgreSQL.
- JWT + Passport.
- `class-validator` e `class-transformer` para DTOs.
- `zod` e `nestjs-zod` em partes compartilhadas/validadas.
- Socket.IO/Nest WebSockets para comunicacao em tempo real.
- Nodemailer para e-mail/convites.
- Gemini/Google Generative AI para assistencias de IA.
- Vitest para testes.

### Frontend

- Next.js 15.
- React 18.
- TanStack Query.
- Radix UI.
- Tailwind CSS.
- Lucide React.
- Recharts.
- React Flow.
- CodeMirror para SQL.
- Sonner para notificacoes/toasts.
- Socket.IO client para tempo real.

### Infraestrutura

- Docker e Docker Compose.
- Caddy como proxy reverso em producao.
- Droplet DigitalOcean.
- Banco externo em producao, descrito como Neon no `docker-compose.droplet.yml`.
- Redis no compose local, embora nem todos os modulos atuais dependam diretamente dele.

## 4. Scripts principais

Na raiz:

- `pnpm dev`: compila shared e sobe API/Web em paralelo.
- `pnpm dev:api`: sobe apenas API.
- `pnpm dev:web`: sobe apenas Web.
- `pnpm build`: build shared + API + Web.
- `pnpm test`: testes de todos os pacotes.
- `pnpm db:up`: sobe PostgreSQL e Redis locais.
- `pnpm db:migrate`: roda migrate dev da API.
- `pnpm db:seed`: executa seed.
- `pnpm deploy:migrate`: roda migrate deploy.
- `pnpm setup`: instala dependencias, compila shared, sobe banco, roda migrations e seed.

No `Makefile`, voltado para Droplet:

- `make deploy`: `git pull`, build Docker, sobe containers e aplica migrations.
- `make build`: build sequencial das imagens API e Web.
- `make up/down/restart`: operacao dos containers.
- `make logs`, `make logs-api`, `make logs-web`, `make logs-caddy`: logs.
- `make migrate`: roda `prisma migrate deploy` dentro do container API.
- `make seed`: roda seed dentro do container API.
- `make stats`: uso de CPU/RAM dos containers.

Em `scripts`:

- `scripts/release.ps1`: roda localmente no Windows; valida TypeScript API/Web, commita, faz push e dispara deploy remoto via SSH.
- `scripts/deploy.sh`: roda dentro da Droplet; faz `git pull`, build Docker, `up -d`, `prisma migrate deploy`, mostra status e limpa imagens antigas.
- `scripts/setup-droplet.sh`: apoio de preparacao da Droplet.

## 5. Configuracao e runtime

### Variaveis

Arquivos de referencia:

- `.env.example`
- `.env.production.example`
- `.env.droplet.example`
- `.env.droplet-ready`

Variaveis importantes inferidas pelo codigo:

- `DATABASE_URL`: conexao Prisma.
- `DIRECT_URL`: conexao direta para migrations/introspeccao.
- `JWT_ACCESS_SECRET`: obrigatoria e validada por `requireSecret`.
- `JWT_ACCESS_TTL`: TTL do token de acesso.
- `PORT` ou `API_PORT`: porta da API.
- `API_PREFIX`: prefixo global, padrao `api`.
- `API_CORS_ORIGIN`: origem permitida no CORS.
- `NEXT_PUBLIC_API_URL`: URL da API no Web.
- `NEXT_PUBLIC_APP_NAME`: nome publico do app.
- `OPENAI_API_KEY`: usado como indicador de integracao IA no Portal; ha tambem modulo Gemini.
- `SMTP_HOST` e variaveis de e-mail associadas: usadas/monitoradas por integracoes e convites.

### API

`apps/api/src/main.ts`:

- Configura prefixo global `api`.
- Habilita Helmet.
- Habilita CORS com regra especial para origem `*`.
- Usa `ValidationPipe` global com `whitelist`, `transform` e `forbidNonWhitelisted: false`.
- Usa filtro global `HttpExceptionFilter`.
- Faz listen em `0.0.0.0`.

### Guardas globais

`apps/api/src/app.module.ts` registra:

- `ThrottlerGuard` global, limite 200 requisicoes por 60 segundos.
- `AuditInterceptor` global.

`AuthModule` registra:

- `JwtAuthGuard` global.
- `RolesGuard` global.

Sem `@Public`, rotas exigem JWT. O `RolesGuard` aplica:

- `@Roles(...)` quando definido.
- `@RequirePermissions(...)` quando definido.
- Super Admin passa por bypass.
- Company Admin sem permissoes explicitas cadastradas recebe acesso amplo.
- Semantica de permissao: basta uma permissao exigida; tambem aceita curinga `<modulo>:manage`.

## 6. Banco de dados e dominio

O banco usa Prisma/PostgreSQL. O schema fica em `apps/api/prisma/schema.prisma`.

### Principais enums

- Usuarios/acesso: `UserRoleEnum`, `UserAccessStatus`.
- Empresa: `CompanyStatus`.
- Periodo de trabalho: `WorkPeriodStatus`.
- Estrutura: `OrgNodeType`.
- Indicadores: `IndicatorType`, `IndicatorUnit`, `Periodicity`, `Direction`, `FeedKind`, `IndicatorStatus`, `ResultStatus`.
- Desvios: `DeviationSeverity`, `DeviationStatus`, `AnalysisMethod`.
- Planos de acao: `ActionAnalysisTool`, `ActionToolStatus`, `ActionStepStatus`, `ActionEffectivenessStatus`, `ActionAiSuggestionStatus`, `ActionStatus`, `ActionPriority`, `ActionOrigin`.
- Estrategia: `PerspectiveKind`, `ObjectiveStatus`, `TrafficLight`, `MapNodeType`, `MapMode`.
- Projetos/reunioes: `ProjectStatus`, `MeetingKind`, `MeetingFormat`, `MeetingStatus`, `MeetingParticipantRole`.
- Notificacoes/importacao/rastreabilidade: `NotificationKind`, `ImportTargetKind`, `ImportRowStatus`, `TraceEventType`, `TraceEntityType`.
- Comunicacao: `ConversationKind`, `ConversationRole`, `PresenceStatus`.
- Visibilidade: `AreaAssignmentType`, `VisibilityLevel`, `VisibilityEffect`.

### Principais grupos de tabelas

Multiempresa:

- `Company`, `Branch`, `OrgNode`, `User`.
- Empresas possuem status, limite de usuarios, dados de contato, flag `areaAccessEnabled` e isolamento por `companyId`.

Usuarios e seguranca:

- `Permission`, `UserPermission`, `AccessProfile`, `ProfilePermission`, `RefreshToken`.
- Perfis padrao definidos no catalogo de permissoes.

Estrategia e mapa:

- `StrategicMap`, `Perspective`, `StrategicObjective`, `ObjectiveRelation`, `StrategicObjectiveIndicator`, `StrategicObjectiveOrgNode`, `StrategicMapVersion`.
- Suporte a layout, versoes, relacoes entre objetivos e vinculacao de indicadores/areas.

OKRs:

- `OKRCycle`, `OKRObjective`, `KeyResult`, `OKRCheckin`.

Indicadores:

- `Indicator`, `IndicatorTarget`, `IndicatorResult`, `IndicatorTreeRelation`, `ClosedMonth`.
- Anexos e comentarios de resultado: `IndicatorResultAttachment`, `IndicatorResultComment`.

Desvios, tratativas e planos:

- `Deviation`, `DeviationCause`, `DeviationAnalysis`.
- `TreatmentCase`.
- `ActionPlan`, `ActionTask`, `GeneralApprovalRequest`, `ActionParticipant`, `ActionEvidence`, `ActionComment`, `ActionHistory`.
- Ferramentas de analise: `ActionAnalysisSession`, `ActionFiveWhy`, `ActionIshikawaCause`, `ActionMaspStep`, `ActionPdcaStep`, `ActionFiveW2H`.
- IA: `ActionAiSuggestion`.

Projetos:

- `Project`, `ProjectMilestone`, `ProjectTask`.

Reunioes:

- `Meeting`, `MeetingParticipant`, `MeetingGuest`, `MeetingAgendaItem`, `MeetingDecision`.
- `CalendarInvite`, `EmailLog`.

Arquivos, comentarios e notificacoes:

- `Attachment`, `Comment`, `Notification`, `NotificationPreference`.

Auditoria e rastreabilidade:

- `AuditLog`, `TraceabilityEvent`, `StatusHistory`.

Mapa de relacionamento:

- `RelationshipMap`, `MapNode`, `MapEdge`, `MapLayout`.

Configuracoes e parametros:

- `AppSetting`, `ParameterCategory`, `ParameterItem`.

Organograma de cargos:

- `OrgJob`, `OrgEmployee`, `OrgJobApprovalRequest`, `OrgJobCareerPath`.

Administracao do banco:

- `DbAdminAuditLog`, `DbAdminBackup`, `DbAdminSavedQuery`, `DbAdminQueryHistory`.

Central do Portal:

- `PortalModule`, `PortalPage`, `PortalFeature`, `PortalFeatureFlag`, `PortalNavOverride`, `PortalScopeRule`, `PortalIntegration`, `PortalAnnouncement`, `PortalMaintenanceWindow`, `PortalAdminAuditLog`, `PortalConfigSnapshot`, `PortalDiagnosticRun`.

Comunicacao corporativa:

- `Conversation`, `ConversationParticipant`, `Message`, `MessageAttachment`, `MessageReaction`, `UserPresence`.
- Anexos de mensagem podem armazenar bytes no banco via `MessageAttachment.data`.

Central de Ajuda e integracoes:

- `HelpCategory`, `HelpArticle`, `HelpFeedback`.
- `UserIntegrationPreference`.

Matriz de visibilidade por area:

- `UserAreaAssignment`, `AreaVisibilityRule`, `UserVisibilityException`.

### Migrations atuais

As migrations indicam a evolucao funcional:

- Inicializacao do dominio.
- Rastreabilidade e mapa de relacionamentos.
- Tratativa de indicador fora da meta.
- Parametros administrativos.
- Workspace do mapa estrategico.
- Suite avancada de planos de acao.
- Periodos de trabalho e meses fechados.
- Diretriz/no organizacional de indicadores.
- Aprovacoes de carreira.
- Relacionamento pai/filho de OKR.
- Notas de resultados.
- Acao preventiva.
- Administracao de banco.
- Central do Portal.
- Aprovacoes gerais e conclusao de tarefas.
- Evidencias de tarefas.
- Comunicacao/diretorio.
- Anexos de mensagem, Central de Ajuda e integracoes.
- Campos de status de empresa.
- Visibilidade por area.

## 7. Backend: modulos e funcionalidades

### Auth

Modulo: `apps/api/src/modules/auth`.

Funcionalidades:

- Login por e-mail/senha.
- Refresh token.
- Logout.
- Consulta do usuario autenticado via `/auth/me`.
- JWT como mecanismo padrao para toda a API.
- Senhas com bcrypt.
- Refresh tokens persistidos.

Endpoints principais:

- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

### Usuarios, permissoes e perfis

Modulos:

- `users`
- `admin`

Funcionalidades:

- CRUD de usuarios.
- Ativar/inativar usuario.
- Atribuir permissoes individuais.
- Listar permissoes disponiveis.
- Bootstrap administrativo.
- Gerenciar empresas, filiais, categorias/itens de parametro e perfis de acesso.
- Perfis padrao: Super Admin, Admin, Gestor, Usuario e Visualizador.

Endpoints principais:

- `GET /users`
- `GET /users/permissions`
- `GET /users/:id`
- `POST /users`
- `PATCH /users/:id`
- `PATCH /users/:id/permissions`
- `PATCH /users/:id/active`
- `DELETE /users/:id`
- `GET /admin/bootstrap`
- `GET /admin/permissions`
- `POST/PATCH/DELETE /admin/companies`
- `POST/PATCH/DELETE /admin/branches`
- `POST/PATCH/DELETE /admin/parameters/categories`
- `POST/PATCH/DELETE /admin/parameters/items`
- `POST/PATCH/DELETE /admin/security/profiles`
- `PATCH /admin/security/profiles/:id/permissions`
- `PUT /admin/system/settings`

### Empresas e plataforma

Modulos:

- `companies`
- `platform`

Funcionalidades:

- Consulta da empresa do usuario e filiais.
- Super Admin gerencia empresas globalmente.
- Dashboard global da plataforma.
- Criacao/edicao de empresa.
- Status de empresa: ativa, suspensa, inativa.
- Metricas por empresa: usuarios, indicadores, acoes abertas, ultimo acesso.
- Flag por empresa para ligar/desligar controle de acesso por area.

Endpoints principais:

- `GET /companies/me`
- `GET /companies/me/branches`
- `GET /companies/:id`
- `GET /platform/overview`
- `GET /platform/companies`
- `GET /platform/companies/:id`
- `POST /platform/companies`
- `PATCH /platform/companies/:id`
- `PATCH /platform/companies/:id/status`

### Estrutura organizacional

Modulo: `orgnodes`.

Funcionalidades:

- Listar areas/setores/nos.
- Exibir arvore organizacional.
- Criar, editar, mover e remover nos.
- Vincular responsavel.
- Usado por indicadores, estrategia, visibilidade, usuarios e organograma.

Endpoints:

- `GET /orgnodes`
- `GET /orgnodes/tree`
- `POST /orgnodes`
- `PATCH /orgnodes/:id`
- `PATCH /orgnodes/:id/move`
- `DELETE /orgnodes/:id`

### Matriz de visibilidade por area

Modulos:

- `access`
- `AccessService`

Funcionalidades:

- Define quais areas um usuario possui como principal/secundarias.
- Define matriz area origem -> area destino por modulo.
- Permissoes por regra: visualizar, criar, editar, excluir, aprovar, exportar.
- Niveis de visibilidade: sem acesso, resumida, completa, criar, editar, aprovar, excluir, admin.
- Excecoes individuais por usuario.
- Simulador de acesso por usuario.
- Cache curto de contexto de acesso para reduzir consultas.
- Expansao de area para descendentes.
- Auditoria de negacoes.
- Admin/Super Admin e diretorias podem ter regras mais amplas conforme papel e acao.

Endpoints:

- `GET /access/modules`
- `GET /access/areas`
- `GET /access/users/:userId/areas`
- `POST /access/users/:userId/areas`
- `DELETE /access/users/:userId/areas/:orgNodeId`
- `PATCH /access/users/:userId/primary-area`
- `GET /access/matrix`
- `POST /access/matrix`
- `DELETE /access/matrix/:id`
- `GET /access/exceptions`
- `POST /access/exceptions`
- `DELETE /access/exceptions/:id`
- `GET /access/simulate/:userId`

### Indicadores e resultados

Modulos:

- `indicators`
- `results`

Funcionalidades:

- CRUD de indicadores.
- Tipos de indicador, periodicidade, unidade, direcao, feeder/responsavel.
- Filtros por status, area, responsavel e outros parametros.
- Metas por periodo, meta unica e metas em lote.
- Lancamento de resultados.
- Resultados mensais, diarios/semanais/quinzenais via granularidade.
- Recalculo de farol/status com base em meta e direcao.
- Historico do indicador.
- Series para graficos.
- Relacionamento entre indicadores pai/filho.
- Grafo de arvore de indicadores.
- Simulacao de impacto entre indicadores.
- Notas, anexos e comentarios por periodo de resultado.
- Aprovacao de resultados.
- Pendencias de lancamento.
- Meses fechados e bloqueio por periodo.
- Escopo por area via `AccessService`.

Endpoints principais:

- `GET /indicators`
- `GET /indicators/options`
- `GET /indicators/tree/graph`
- `GET /indicators/:id`
- `GET /indicators/:id/series`
- `GET /indicators/:id/targets`
- `GET /indicators/:id/history`
- `POST /indicators`
- `PATCH /indicators/:id`
- `POST /indicators/:id/targets`
- `POST /indicators/:id/target`
- `POST /indicators/:id/targets/batch`
- `POST /indicators/:id/results`
- `GET /indicators/:id/period/:periodRef/notes`
- `POST /indicators/:id/period/:periodRef/attachments`
- `POST /indicators/:id/period/:periodRef/comments`
- `GET /indicators/result-attachments/:attachmentId`
- `DELETE /indicators/result-attachments/:attachmentId`
- `DELETE /indicators/:id`
- `GET /indicators/:id/children`
- `POST /indicators/:id/children`
- `DELETE /indicators/:id/children/:childId`
- `GET /indicators/:id/impact`
- `GET /results/pending`
- `GET /results/grain`
- `POST /results`
- `POST /results/batch`
- `POST /results/:id/approve`

### Dashboard, visualizacao e insights

Modulos:

- `dashboard`
- `insights`

Funcionalidades:

- Resumo executivo.
- Ranking de indicadores.
- Evolucao historica.
- Piores indicadores.
- Pendencias.
- Alertas, tendencias e insights gerenciais.

Endpoints:

- `GET /dashboard/overview`
- `GET /dashboard/ranking`
- `GET /dashboard/evolution`
- `GET /dashboard/worst`
- `GET /dashboard/pending`
- `GET /insights`

### Desvios

Modulo: `deviations`.

Funcionalidades:

- Abertura de desvio.
- Listagem e detalhe.
- Atualizacao de dados do desvio.
- Causas do desvio.
- Analises de causa.
- Criacao de plano de acao a partir do desvio.
- Encerramento do desvio.

Endpoints:

- `GET /deviations`
- `GET /deviations/:id`
- `POST /deviations`
- `PATCH /deviations/:id`
- `POST /deviations/:id/causes`
- `DELETE /deviations/causes/:causeId`
- `POST /deviations/:id/analyses`
- `POST /deviations/:id/actions`
- `POST /deviations/:id/close`

### Tratativas

Modulo: `treatments`.

Observacao de estado atual: o modulo e as rotas ainda existem no codigo, mas a navegacao principal atual nao exibe item de Tratativas.

Funcionalidades:

- Tratativa de indicador fora da meta.
- Consulta da tratativa atual por indicador.
- Iniciar tratativa a partir de resultado.
- Ignorar tratativa com justificativa.
- Criar analise de causa.
- Agendar reuniao.
- Criar acoes.
- Reavaliar status.
- Criar desvio associado quando necessario.

Endpoints:

- `GET /treatments/:id`
- `GET /treatments/indicators/:indicatorId/current`
- `POST /treatments/from-result/:resultId/start`
- `POST /treatments/:id/ignore`
- `POST /treatments/:id/analysis`
- `POST /treatments/:id/meeting`
- `POST /treatments/:id/actions`
- `POST /treatments/:id/reevaluate`

### Planos de acao

Modulo: `actions`.

Funcionalidades:

- Listagem com filtros.
- Criacao de plano de acao.
- Edicao de plano.
- Alteracao de status.
- Vinculos com indicador, desvio, reuniao, tratamento e origem preventiva.
- Tarefas de execucao.
- Conclusao de tarefa com informacao do que foi feito.
- Edicao e exclusao de tarefa.
- Recalculo de progresso.
- Evidencias/anexos de plano ou tarefa.
- Comentarios.
- Historico.
- Analise de causa no plano.
- Ferramentas de analise: 5 Porques, Ishikawa, MASP, PDCA, 5W2H ainda modelado no banco.
- Pedido de exclusao com aprovacao geral.
- Aprovacoes gerais.
- Solicitacao de avaliacao de eficacia.
- Decisao de eficacia.
- Reabertura quando ineficaz.
- Finalizacao quando eficaz.
- Assistente de IA para sugestoes.
- Aceite/rejeicao de sugestoes de IA.
- Auditoria e rastreabilidade.

Endpoints:

- `GET /actions`
- `GET /actions/options`
- `GET /actions/general-approvals`
- `GET /actions/evidences/:evidenceId`
- `GET /actions/:id`
- `POST /actions`
- `PATCH /actions/:id`
- `PATCH /actions/:id/status`
- `POST /actions/:id/meeting`
- `POST /actions/:id/tasks`
- `PATCH /actions/tasks/:taskId`
- `DELETE /actions/tasks/:taskId`
- `POST /actions/:id/delete-request`
- `PATCH /actions/general-approvals/:requestId/decision`
- `POST /actions/:id/analysis`
- `POST /actions/:id/evidences`
- `POST /actions/:id/comments`
- `POST /actions/:id/effectiveness/request`
- `POST /actions/:id/effectiveness`
- `POST /actions/:id/ai-assist`
- `PATCH /actions/ai-suggestions/:id`
- `DELETE /actions/:id`

### Reunioes

Modulo: `meetings`.

Funcionalidades:

- Criar, listar, editar e remover reunioes.
- Participantes internos.
- Convidados externos.
- Marcar presenca.
- Itens de agenda.
- Decisoes.
- Geracao de plano/acao/tarefa a partir da reuniao.
- Envio de convites ICS.
- Conclusao de reuniao.
- Log de envio de e-mail.

Endpoints:

- `GET /meetings`
- `GET /meetings/:id`
- `POST /meetings`
- `PATCH /meetings/:id`
- `DELETE /meetings/:id`
- `POST /meetings/:id/participants`
- `POST /meetings/:id/guests`
- `PATCH /meetings/:id/participants/:userId`
- `POST /meetings/:id/agenda`
- `POST /meetings/:id/decisions`
- `POST /meetings/:id/actions`
- `POST /meetings/:id/invitations/send`
- `POST /meetings/:id/complete`

### Estrategia, mapa estrategico e organograma

Modulo: `strategy`.

Funcionalidades:

- Mapas estrategicos.
- Perspectivas.
- Objetivos estrategicos.
- Relacoes entre objetivos.
- Layout do mapa.
- Vinculo de indicadores a objetivos.
- Vinculo de areas/orgnodes a objetivos.
- Versoes do mapa estrategico.
- Duplicacao de mapa.
- Organograma de cargos.
- Cargos e colaboradores do organograma.
- Trilhas de carreira.
- Aprovacoes de mudancas de cargo.
- Aba/tela de aprovacoes combinando aprovacoes de cargo, eficacia e gerais no frontend.

Endpoints principais:

- `GET /strategy/maps`
- `GET /strategy/options`
- `GET /strategy/maps/:id`
- `POST /strategy/maps`
- `POST /strategy/maps/:id/duplicate`
- `PATCH /strategy/maps/:id`
- `DELETE /strategy/maps/:id`
- `POST /strategy/maps/:id/perspectives`
- `PATCH /strategy/perspectives/:id`
- `DELETE /strategy/perspectives/:id`
- `PATCH /strategy/maps/:id/perspectives/reorder`
- `POST /strategy/maps/:id/objectives`
- `PATCH /strategy/objectives/:objId`
- `DELETE /strategy/objectives/:objId`
- `PATCH /strategy/maps/:id/layout`
- `POST /strategy/relations`
- `PATCH /strategy/relations/:id`
- `DELETE /strategy/relations/:id`
- `POST /strategy/objectives/:objId/indicators/:indicatorId`
- `DELETE /strategy/objectives/:objId/indicators/:indicatorId`
- `DELETE /strategy/indicators/:indicatorId/objective`
- `POST /strategy/objectives/:objId/orgnodes/:orgNodeId`
- `DELETE /strategy/objectives/:objId/orgnodes/:orgNodeId`
- `GET /strategy/maps/:id/versions`
- `POST /strategy/maps/:id/versions`
- `GET /strategy/organograma`
- `POST/PATCH/DELETE /strategy/jobs`
- `POST/PATCH/DELETE /strategy/employees`
- `POST /strategy/career-paths`
- `DELETE /strategy/career-paths/:id`
- `GET /strategy/career-approvals/approvers`
- `GET /strategy/career-approvals`
- `GET /strategy/career-approvals/:id`
- `POST /strategy/career-approvals`
- `PATCH /strategy/career-approvals/:id/decision`
- `PATCH /strategy/career-approvals/:id/cancel`

### OKRs

Modulo: `okrs`.

Funcionalidades:

- Ciclos de OKR.
- Objetivos dentro de ciclos.
- Key Results.
- Check-ins.
- Hierarquia objetivo pai/filho.

Endpoints:

- `GET /okrs/cycles`
- `POST /okrs/cycles`
- `GET /okrs/cycles/:cycleId/objectives`
- `GET /okrs/objectives/:id`
- `POST /okrs/cycles/:cycleId/objectives`
- `PATCH /okrs/objectives/:id`
- `DELETE /okrs/objectives/:id`
- `POST /okrs/objectives/:id/krs`
- `PATCH /okrs/krs/:krId`
- `DELETE /okrs/krs/:krId`
- `POST /okrs/objectives/:id/checkin`

### Projetos e cronogramas

Modulo: `projects`.

Funcionalidades:

- CRUD de projetos.
- Vinculo de indicadores.
- Marcos/milestones.
- Tarefas do projeto.

Endpoints:

- `GET /projects`
- `GET /projects/indicators`
- `GET /projects/:id`
- `POST /projects`
- `PATCH /projects/:id`
- `DELETE /projects/:id`
- `POST /projects/:id/milestones`
- `PATCH /projects/milestones/:id`
- `POST /projects/:id/tasks`
- `PATCH /projects/tasks/:id`
- `DELETE /projects/tasks/:id`

### Importacoes

Modulo: `imports`.

Funcionalidades:

- Historico de jobs de importacao.
- Erros por job.
- Preview de importacao.
- Commit de importacao.
- Suporte a alvos modelados por `ImportTargetKind`.

Endpoints:

- `GET /imports/jobs`
- `GET /imports/jobs/:id/errors`
- `POST /imports/preview`
- `POST /imports/commit`

### Relatorios

Modulo: `reports`.

Funcionalidades:

- Exportacao CSV de indicadores.
- Exportacao CSV de resultados.
- Exportacao CSV de planos de acao.
- Exportacao CSV de desvios.

Endpoints:

- `GET /reports/indicators.csv`
- `GET /reports/results.csv`
- `GET /reports/actions.csv`
- `GET /reports/deviations.csv`

### Auditoria e rastreabilidade

Modulos:

- `audit`
- `traceability`

Funcionalidades:

- Consulta de auditoria.
- Detalhe de entrada de auditoria.
- Export CSV de auditoria.
- Eventos de rastreabilidade por entidade.
- Rastreabilidade de indicador.
- Interceptor global para registrar acoes.

Endpoints:

- `GET /audit`
- `GET /audit/entries/:id`
- `GET /audit/exports/csv`
- `GET /traceability`
- `GET /traceability/indicators/:id`

### Notificacoes

Modulo: `notifications`.

Funcionalidades:

- Listagem de notificacoes.
- Contador.
- Marcar uma como lida.
- Marcar todas como lidas.
- Geracao manual/sistemica.
- Notificacoes em tempo real para mensagens e eventos relevantes.

Endpoints:

- `GET /notifications`
- `GET /notifications/count`
- `PATCH /notifications/:id/read`
- `POST /notifications/read-all`
- `POST /notifications/generate`

### Comunicacao corporativa

Modulo: `communication`.

Funcionalidades:

- Diretorio global de pessoas.
- Filtros por busca, area, cargo, presenca e pagina.
- Usuarios online.
- Perfil corporativo de usuarios.
- Perfil e status customizado do proprio usuario.
- Preferencias de notificacao/comunicacao.
- Presenca em tempo real.
- WebSocket/Socket.IO.
- Conversas diretas.
- Lista de conversas com nao lidas, fixadas e silenciadas.
- Mensagens em tempo real.
- Historico paginado por cursor.
- Responder mensagem.
- Editar mensagem propria.
- Excluir mensagem propria.
- Reacoes rapidas.
- Marcacao de leitura.
- Digitando.
- Anexos em mensagem salvos no banco, com download autenticado.
- Fan-out para participantes e notificacao para usuarios offline.

Endpoints HTTP:

- `GET /communication/directory`
- `GET /communication/directory/online`
- `GET /communication/users/:id/profile`
- `GET /communication/me/preferences`
- `PATCH /communication/me/profile`
- `PATCH /communication/me/status`
- `PATCH /communication/me/preferences`
- `GET /communication/conversations`
- `POST /communication/conversations/direct`
- `GET /communication/conversations/:id`
- `GET /communication/conversations/:id/messages`
- `POST /communication/conversations/:id/messages`
- `GET /communication/message-attachments/:id`
- `POST /communication/conversations/:id/read`
- `POST /communication/conversations/:id/mute`
- `POST /communication/conversations/:id/pin`
- `PATCH /communication/messages/:id`
- `DELETE /communication/messages/:id`
- `POST /communication/messages/:id/reactions`
- `DELETE /communication/messages/:id/reactions/:emoji`

Eventos em tempo real:

- Conversa join/leave.
- Mensagem criada/atualizada/excluida.
- Reacao atualizada.
- Digitando/inativo.
- Leitura.
- Presenca.
- Notificacao criada.

### Central de Ajuda

Modulo: `help`.

Funcionalidades:

- Categorias de ajuda.
- Artigos publicados.
- Busca por termo.
- Artigos populares por visualizacao.
- Incremento de visualizacao.
- Feedback util/nao util.
- Admin/Super Admin edita categorias e artigos.
- Conteudo padrao semeado automaticamente quando vazio.

Endpoints:

- `GET /help`
- `GET /help/articles/:slug`
- `POST /help/articles/:slug/feedback`
- `GET /admin/help`
- `POST /admin/help/categories`
- `PUT /admin/help/categories/:id`
- `POST /admin/help/articles`
- `PUT /admin/help/articles/:id`
- `POST /admin/help/articles/:id/status`

### Integracoes

Modulos:

- `integrations`
- `portal-admin/services/integration.service.ts`

Funcionalidades:

- Lista de integracoes disponiveis.
- Preferencia de integracao por usuario.
- Status operacional controlado pelo Super Admin.
- Teste de conectividade basico.
- Integracoes padrao: e-mail, ICS/calendario, IA, banco de dados, armazenamento, comunicacao interna, Central de Ajuda.
- Google/Microsoft nao fazem parte da fase atual.

Endpoints:

- `GET /integrations`
- `PUT /integrations/:code/preference`
- `GET /admin/portal/integrations`
- `POST /admin/portal/integrations/:code/test`
- `POST /admin/portal/integrations/:code/status`

### IA

Modulo: `ai`.

Funcionalidades:

- Consulta de status do provedor IA.
- Contexto de indicador para assistencia.
- Integracao com Gemini no backend.
- Planos de acao usam IA para sugestoes.

Endpoints:

- `GET /ai/status`
- `GET /ai/indicators/:id/context`

### Busca

Modulo: `search`.

Funcionalidades:

- Busca global/centralizada de registros.

Endpoint:

- `GET /search`

### Periodos e meses fechados

Modulos:

- `periods`
- `closed-months`

Funcionalidades:

- Periodos de trabalho.
- Criar periodo.
- Definir periodo corrente.
- Fechar periodo.
- Fechar/reabrir ou remover mes fechado conforme modulo.

Endpoints:

- `GET /periods`
- `POST /periods`
- `PATCH /periods/:id/current`
- `POST /periods/:id/close`
- `GET /closed-months`
- `POST /closed-months`
- `DELETE /closed-months/:id`

### Administracao do Portal

Modulo: `portal-admin`.

Funcionalidades:

- Exclusivo de Super Admin por `SuperAdminPortalGuard`.
- Audita tentativas negadas e acoes administrativas.
- Registro/catalogo de modulos, paginas e funcionalidades.
- Sincronizacao aditiva do catalogo.
- Status de modulos/paginas/features.
- Feature flags.
- Configuracao publica do portal para frontend aplicar bloqueios/overrides.
- Overrides de navegacao: esconder, renomear, ordenar, mudar grupo/icone.
- Regras de escopo organizacional.
- Janelas de manutencao.
- Parametros gerais.
- Integracoes.
- Comunicados/avisos.
- Snapshots de configuracao e restauracao.
- Diagnosticos.
- Visao de perfis/permissoes.
- Auditoria propria da Central do Portal.

Endpoints principais:

- `GET /portal/config`
- `GET /admin/portal/overview`
- `POST /admin/portal/registry/sync`
- `GET /admin/portal/modules`
- `PUT /admin/portal/modules/:code`
- `POST /admin/portal/modules/:code/status`
- `POST /admin/portal/modules/:code/enable`
- `POST /admin/portal/modules/:code/disable`
- `POST /admin/portal/modules/:code/maintenance`
- `GET /admin/portal/pages`
- `PUT /admin/portal/pages/:code`
- `POST /admin/portal/pages/:code/status`
- `GET /admin/portal/features`
- `PUT /admin/portal/features/:code`
- `POST /admin/portal/features/:code/status`
- `GET /admin/portal/flags`
- `PUT /admin/portal/flags`
- `DELETE /admin/portal/flags/:key`
- `GET /admin/portal/navigation`
- `PUT /admin/portal/navigation`
- `POST /admin/portal/navigation/reorder`
- `DELETE /admin/portal/navigation/:itemKey`
- `GET /admin/portal/scope`
- `GET /admin/portal/scope/options`
- `POST /admin/portal/scope`
- `DELETE /admin/portal/scope/:id`
- `GET/POST/PUT/DELETE /admin/portal/maintenance`
- `GET/PUT /admin/portal/parameters`
- `GET/POST/PUT/DELETE /admin/portal/announcements`
- `GET/POST/DELETE /admin/portal/snapshots`
- `GET /admin/portal/snapshots/:id/diff`
- `POST /admin/portal/snapshots/:id/restore`
- `GET /admin/portal/diagnostics`
- `POST /admin/portal/diagnostics/run`
- `GET /admin/portal/permissions`
- `GET /admin/portal/audit`

### Administracao do Banco

Modulo: `database-admin`.

Funcionalidades:

- Exclusivo do Super Admin via `SuperAdminDbGuard`.
- Overview do banco.
- Schema/tabelas/relacionamentos/indices.
- Listagem de tabelas.
- Schema de tabela.
- CRUD generico de linhas com validacao.
- Query builder/SQL com validacao, execucao, explain, historico e favoritos.
- Backup, download, verificacao, marcar como importante, exclusao e restauracao.
- Import/export.
- Diagnosticos.
- Configuracoes administrativas.
- Auditoria da administracao do banco.
- Servicos dedicados: schema inspection, record management, query validation/execution, import/export, backup, diagnostics.

Endpoints principais:

- `GET /admin/database/overview`
- `GET /admin/database/schema`
- `GET /admin/database/relationships`
- `GET /admin/database/indexes`
- `GET /admin/database/tables`
- `GET /admin/database/tables/:table/schema`
- `GET/POST/PATCH /admin/database/tables/:table/rows`
- `POST /admin/database/tables/:table/rows/delete`
- `POST /admin/database/query/validate`
- `POST /admin/database/query/execute`
- `POST /admin/database/query/explain`
- `GET /admin/database/query/history`
- `GET/POST/DELETE /admin/database/query/favorites`
- `POST /admin/database/export`
- `POST /admin/database/import/preview`
- `POST /admin/database/import/commit`
- `GET/POST /admin/database/diagnostics`
- `GET/PUT /admin/database/settings`
- `GET /admin/database/audit`
- `GET/POST /admin/database/backups`
- `GET /admin/database/backups/:id/download`
- `POST /admin/database/backups/:id/verify`
- `POST /admin/database/backups/:id/important`
- `DELETE /admin/database/backups/:id`
- `POST /admin/database/backups/:id/restore`
- `POST /admin/database/structure/preview`
- `POST /admin/database/structure/execute`

### Health

Modulo: `health`.

Funcionalidade:

- Healthcheck usado pelo Docker/Caddy.

Endpoint:

- `GET /health`

## 8. Frontend: estrutura e telas

O frontend usa Next.js App Router.

### Shell autenticado

Pasta: `apps/web/app/(app)`.

Componentes principais:

- `components/shell/navigation.ts`: catalogo de menu, permissoes de rota e itens mobile.
- `components/shell/topbar.tsx`: barra superior.
- `components/shell/accordion-navigation.tsx`: menu lateral em acordeao.
- `components/auth/route-permission-gate`: bloqueio por rota.
- `components/communication/realtime-provider`: conexao realtime.

### Rotas publicas

- `/login`: tela de login.
- `/`: redirecionamento/entrada.

### Visualizacoes

- `/dashboard`: visao geral com resumo, pendencias e atalhos.
- `/visualization`: dashboard executivo.
- `/org`: arvore organizacional.
- `/strategy`: mapas estrategicos.
- `/strategy/[id]`: detalhe/workspace de mapa estrategico.
- `/indicators`: lista/farol/ranking/historico de indicadores.
- `/indicators/new`: novo indicador.
- `/indicators/[id]`: detalhe do indicador, metas, resultados, historico, anexos/comentarios.
- `/projects`: cronogramas/projetos.
- `/projects/[id]`: detalhe de projeto.
- `/insights`: alertas, tendencias e insights.

### Comunicacao

- `/comunicacao`: conversas, mensagens, anexos, reacoes, fixar/silenciar.
- `/pessoas`: diretorio corporativo, presenca e busca de usuarios.
- `/perfil`: perfil do usuario atual.
- `/perfil/[id]`: perfil de outro usuario.
- `/integracoes`: integracoes internas disponiveis e preferencias do usuario.
- `/ajuda`: Central de Ajuda com busca, categorias, artigos e feedback.

### Lancamentos

- `/deviations`: desvios e analises de causa.
- `/deviations/[id]`: detalhe do desvio.
- `/imports`: registrar/importar evidencias e arquivos.
- `/treatments`: tratativas ainda existem como rota.
- `/treatments/[id]`: detalhe de tratativa ainda existe como rota.

### Gestao

- `/organograma`: cargos, funcionarios e trilhas.
- `/aprovacoes-cargo`: tela renomeada para Aprovacoes, com tabs para aprovacoes de cargo, eficacia e aprovacoes gerais.
- `/periods`: periodos de trabalho.
- `/actions`: planos de acao.
- `/actions/[id]`: detalhe do plano de acao, execucao, tarefas, evidencias, analise e eficacia.
- `/meetings`: reunioes.
- `/meetings/[id]`: detalhe da reuniao.
- `/okrs`: ciclos, objetivos, KRs e check-ins.
- `/settings/visibilidade`: matriz de visibilidade por area.

### Relatorios

- `/reports`: relatorios e exportacoes.
- `/audit`: auditoria.

### Configuracoes

- `/settings`: configuracoes gerais, usuarios, perfis, parametros e sistema.
- `/users`: gestao de usuarios.
- `/settings/portal`: Central do Portal, exclusiva Super Admin.
- `/settings/database`: Administracao do Banco, exclusiva Super Admin.

Subrotas de banco:

- `/settings/database/advanced`
- `/settings/database/audit`
- `/settings/database/backups`
- `/settings/database/diagnostics`
- `/settings/database/import-export`
- `/settings/database/indexes`
- `/settings/database/query-builder`
- `/settings/database/records`
- `/settings/database/sql`
- `/settings/database/structure`
- `/settings/database/tables`
- `/settings/database/tables/[table]`

### Administracao Geral

- `/plataforma`: Super Admin gerencia empresas, status, limites, metricas e acesso por area.

## 9. Componentes frontend relevantes

Pastas principais em `apps/web/components`:

- `auth`: provider de autenticacao e controle de rota.
- `brand`: identidade visual.
- `charts`: graficos.
- `communication`: chat, lista de conversas, detalhes de contato, avatar, providers realtime.
- `database-admin`: componentes de administracao do banco.
- `forms`: componentes/formularios reutilizaveis.
- `layout`: layout base.
- `platform`: cards, estados e componentes de plataforma.
- `portal-admin`: tabs da Central do Portal.
- `shell`: navegacao, topbar e PageHeader.
- `trees`: visualizacoes de arvore.
- `ui`: primitives de UI como Button, Card, Dialog, Input, Select, Tabs, Textarea, Badge.

## 10. Permissoes, papeis e navegacao

Papeis:

- `SUPER_ADMIN`
- `COMPANY_ADMIN`
- `DIRECTOR`
- `MANAGER`
- `ANALYST`
- `COLLABORATOR`
- `VIEWER`

Perfis padrao:

- Super Admin: todas as permissoes.
- Admin: todas, exceto exportacao de auditoria.
- Gestor: indicadores, planos, desvios, reunioes, comunicacao, relatorios e gestao operacional.
- Usuario: operacao basica, lancamentos, planos, reunioes, comunicacao e ajuda.
- Visualizador: leitura de dashboards, indicadores, projetos, estrategia, relatorios, comunicacao e ajuda.

Areas do menu:

- Visualizacoes.
- Comunicacao.
- Lancamentos.
- Gestao.
- Relatorios.
- Administracao Geral, exclusiva do Super Admin.

Rotas sem permissao especifica no frontend, mas autenticadas:

- `/comunicacao`
- `/pessoas`
- `/perfil`
- `/integracoes`
- `/ajuda`

Rotas Super Admin por permissao impossivel/bypass:

- `/settings/database`
- `/settings/portal`
- `/plataforma`

## 11. Fluxos funcionais principais

### Indicador fora da meta ate plano de acao

1. Usuario lanca resultado de indicador.
2. Sistema calcula status/farol.
3. Caso fora da meta, pode gerar desvio/tratativa.
4. Tratativa pode registrar analise, marcar reuniao e criar acoes.
5. Plano de acao nasce vinculado ao indicador/desvio/tratativa/reuniao.
6. Tarefas entram em execucao.
7. Responsaveis anexam evidencias e concluem tarefas.
8. Plano segue para avaliacao de eficacia.
9. Se eficaz, pode finalizar; se ineficaz, pode reabrir.

### Reuniao para plano de acao

1. Usuario abre/cria reuniao.
2. Define participantes e convidados.
3. Registra agenda e contexto.
4. Cria tarefas/acoes para plano de acao.
5. Pode enviar convite ICS/e-mail.
6. Pode concluir reuniao.

### Comunicacao

1. Usuario acessa Pessoas.
2. Encontra outro usuario no diretorio.
3. Cria/abre conversa direta.
4. Troca mensagens em tempo real.
5. Pode responder, reagir, editar/excluir mensagens proprias.
6. Pode anexar arquivos.
7. Pode fixar ou silenciar conversa.
8. Participantes online recebem via socket; offline recebem notificacao.

### Central do Portal

1. Super Admin acessa `/settings/portal`.
2. Sincroniza catalogo.
3. Controla modulos/paginas/features.
4. Ajusta menu/navegacao.
5. Cria manutencoes, comunicados e parametros.
6. Testa integracoes.
7. Gera snapshots e pode restaurar configuracoes.
8. Consulta diagnosticos/auditoria.

### Matriz de visibilidade

1. Admin acessa `/settings/visibilidade`.
2. Seleciona usuario e areas.
3. Define area principal/secundarias.
4. Cria regras origem -> destino por modulo.
5. Define nivel e capacidades.
6. Simula acesso.
7. Backend aplica regras em listagens e escritas quando os servicos usam `AccessService`.

## 12. Integracoes e servicos externos

Integracoes catalogadas:

- E-mail SMTP.
- Convites ICS/calendario.
- IA.
- Banco de dados.
- Armazenamento.
- Comunicacao interna.
- Central de Ajuda.

Nao ha conector Google/Microsoft na fase atual.

IA:

- Modulo Gemini/Google Generative AI.
- Usado em status/contexto e sugestoes para plano de acao.

E-mail:

- Nodemailer.
- Usado em reunioes/convites.
- Logs em `EmailLog`.

## 13. Deploy

### Local

Para ambiente local:

1. `pnpm install`
2. `pnpm shared:build`
3. `pnpm db:up`
4. `pnpm db:migrate`
5. `pnpm db:seed`
6. `pnpm dev`

### Droplet

Arquivos:

- `docker-compose.droplet.yml`
- `apps/api/Dockerfile`
- `apps/web/Dockerfile`
- `Caddyfile`
- `Makefile`
- `scripts/deploy.sh`
- `scripts/release.ps1`

Fluxo:

1. `scripts/release.ps1` roda localmente.
2. Type-check API e Web.
3. Commit e push.
4. SSH na Droplet.
5. Executa `make deploy`.
6. `scripts/deploy.sh` faz:
   - `git pull --ff-only`
   - build da API
   - build do Web
   - `docker compose up -d --remove-orphans`
   - `prisma migrate deploy`
   - status dos containers
   - limpeza de imagens antigas

Compose de producao:

- `api`: NestJS em `3333`, healthcheck `/api/health`.
- `web`: Next.js em `3000`, depende da API healthy.
- `caddy`: proxy reverso nas portas 80/443.

## 14. Testes e qualidade

Scripts:

- API: `pnpm --filter @g360/api exec tsc --noEmit --pretty false`
- Web: `pnpm --filter @g360/web exec tsc --noEmit --pretty false`
- Testes API: `pnpm --filter @g360/api test`
- Testes shared: `pnpm --filter @g360/shared test`
- Prisma: `pnpm --filter @g360/api exec prisma validate`
- Prisma generate: `pnpm --filter @g360/api exec prisma generate`

Testes existentes identificados:

- `packages/shared/src/status.test.ts`
- `packages/shared/src/traceability.test.ts`
- Testes de comunicacao/presenca e chave deterministica de conversa no backend.

## 15. Documentos ja existentes

O repositorio ja possui documentacao complementar em `docs/`:

- `arquitetura-gestao-360.md`
- `ARQUITETURA_MULTIEMPRESA_E_PERMISSOES.md`
- `configuracoes-administracao.md`
- `database-admin.md`
- `fluxo-tratativa-indicador-fora-meta.md`
- `fluxograma-completo.md`
- `mapa-estrategico-integrado.md`
- `mapa-estrategico-v2.md`
- `navegacao-menu-accordion.md`
- `plano-acao-avancado.md`
- `portal-admin.md`
- `SECURITY-AUDIT.md`
- `status-evolucao-gestao-360.md`

Arquivos de deploy:

- `README.md`
- `DEPLOY.md`
- `DEPLOY-DROPLET.md`

## 16. Observacoes importantes do estado atual

- O modulo Tratativas ainda existe no backend e nas rotas do frontend, mas nao aparece no menu principal atual.
- A Central de Comunicacao, Ajuda e Integracoes foram adicionadas ao menu de Comunicacao.
- A matriz de visibilidade por area existe e possui backend proprio; sua aplicacao efetiva depende de cada servico usar `AccessService` nas listagens e escritas.
- O Super Admin possui bypass tanto no frontend (`canAccess`) quanto no backend (`RolesGuard`/guards especificos).
- Rotas de Administracao do Banco e Central do Portal usam permissoes sentinela que nao sao concedidas a usuarios comuns; o acesso real e por papel Super Admin.
- O deploy da Droplet depende do `pnpm-lock.yaml` estar sincronizado com `package.json`, pois os Dockerfiles usam `pnpm install --frozen-lockfile`.
- O schema ainda mantem modelos de 5W2H (`ActionFiveW2H`) mesmo que a UI atual tenha removido/ocultado essa funcionalidade em plano de acao.

## 17. Mapa rapido por area de negocio

| Area | Principais telas | Principais modulos API | Descricao |
|---|---|---|---|
| Autenticacao | `/login` | `auth` | Login, refresh, logout, usuario autenticado |
| Dashboard | `/dashboard`, `/visualization` | `dashboard`, `insights` | Visao executiva, rankings, evolucao, pendencias |
| Estrutura | `/org`, `/organograma` | `orgnodes`, `strategy` | Areas, setores, cargos, colaboradores e carreira |
| Indicadores | `/indicators`, `/indicators/[id]` | `indicators`, `results` | KPIs, metas, resultados, anexos, comentarios |
| Desvios | `/deviations` | `deviations`, `treatments` | Desvios, causas, tratativas e planos derivados |
| Planos | `/actions`, `/actions/[id]` | `actions` | Plano de acao, tarefas, evidencias, eficacia, IA |
| Reunioes | `/meetings`, `/meetings/[id]` | `meetings` | Agenda, participantes, convites, tarefas e conclusao |
| Estrategia | `/strategy`, `/strategy/[id]` | `strategy` | Mapas, objetivos, relacoes, versoes |
| OKRs | `/okrs` | `okrs` | Ciclos, objetivos, KRs e check-ins |
| Projetos | `/projects` | `projects` | Cronogramas, marcos e tarefas |
| Relatorios | `/reports` | `reports` | Exportacoes CSV |
| Auditoria | `/audit` | `audit`, `traceability` | Logs, rastreabilidade e exportacao |
| Comunicacao | `/comunicacao`, `/pessoas`, `/perfil` | `communication`, `notifications` | Chat, diretorio, presenca, mensagens e anexos |
| Ajuda | `/ajuda` | `help` | Base de conhecimento e feedback |
| Integracoes | `/integracoes` | `integrations`, `portal-admin` | Status e preferencias de conectores |
| Configuracoes | `/settings`, `/users` | `admin`, `users`, `companies` | Usuarios, perfis, permissoes, parametros |
| Visibilidade | `/settings/visibilidade` | `access` | Acesso por area e simulacao |
| Portal Admin | `/settings/portal` | `portal-admin` | Governanca de modulos, paginas, flags e portal |
| Banco Admin | `/settings/database` | `database-admin` | Banco, tabelas, SQL, backup, import/export |
| Plataforma | `/plataforma` | `platform` | Gestao global de empresas pelo Super Admin |
