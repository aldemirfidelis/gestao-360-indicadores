# Fluxograma completo da aplicacao

Documentacao visual do projeto **Gestao 360 Indicadores**, criada para usuarios, gestores e equipes tecnicas entenderem o caminho completo da aplicacao: da configuracao inicial ao acompanhamento executivo, tratamento de desvios, planos de acao, reunioes, importacoes, relatorios, notificacoes e auditoria.

Esta documentacao foi montada a partir do `README.md`, schema Prisma, controllers/services do backend NestJS e rotas do frontend Next.js.

Arquivo para abrir no navegador: [fluxograma-completo.html](./fluxograma-completo.html)

## Legenda

| Simbolo | Significado |
| --- | --- |
| Caixa azul | Tela, modulo ou etapa acessada pelo usuario |
| Caixa verde | Regra de negocio automatica |
| Caixa amarela | Decisao, alerta ou ponto de atencao |
| Caixa vermelha | Risco, pendencia, atraso ou desvio |
| Banco | Persistencia via Prisma/PostgreSQL |

## 1. Visao geral da arquitetura

```mermaid
flowchart LR
  U["Usuario / Gestor"] --> W["Frontend Next.js 14<br/>apps/web"]
  W --> A["Cliente API<br/>lib/api.ts"]
  A -->|Bearer JWT| B["Backend NestJS<br/>apps/api"]
  B --> G["Guards globais<br/>JWT + Roles + Throttler"]
  G --> M["Modulos de negocio<br/>auth, indicadores, resultados,<br/>desvios, acoes, dashboard..."]
  M --> P["Prisma Service"]
  P --> DB[("PostgreSQL<br/>41 entidades")]
  M --> S["Package compartilhado<br/>packages/shared"]
  S --> C["Enums, schemas Zod<br/>calcStatus"]
  B -. pronto para filas .-> R[("Redis / BullMQ")]
  W --> UI["UI<br/>Tailwind, shadcn-style,<br/>Recharts, React Flow, jsPDF"]
  D["Deploy<br/>Docker + DigitalOcean App Platform"] --> B
  D --> W
  D --> N[("Neon Postgres")]

  classDef user fill:#dbeafe,stroke:#2563eb,color:#0f172a
  classDef app fill:#e0f2fe,stroke:#0284c7,color:#0f172a
  classDef rule fill:#dcfce7,stroke:#16a34a,color:#0f172a
  classDef warn fill:#fef3c7,stroke:#d97706,color:#0f172a
  classDef data fill:#ede9fe,stroke:#7c3aed,color:#0f172a
  class U,W,A,B,M,UI,D app
  class G,S,C rule
  class R warn
  class DB,N data
```

### Item por item

1. O usuario acessa o **frontend Next.js** em `apps/web`.
2. O frontend usa `apps/web/lib/api.ts` para chamar a API. Esse cliente adiciona `Authorization: Bearer <token>` e tenta renovar o access token automaticamente quando recebe `401`.
3. O backend NestJS roda com prefixo global `/api`, aplica `helmet`, CORS configuravel, `ValidationPipe`, filtro global de excecoes e limite de requisicoes com `Throttler`.
4. O `AuthModule` registra guards globais: JWT para proteger rotas e `RolesGuard` para endpoints com restricao de perfil.
5. Os modulos de negocio acessam o banco via `PrismaService`.
6. O banco modelado no Prisma e PostgreSQL possui 41 entidades, com `companyId` nas entidades de negocio para multiempresa.
7. O pacote `@g360/shared` concentra enums, schemas Zod e a regra `calcStatus`, usada por backend e frontend.
8. Redis/BullMQ estao instalados na stack, mas o fluxo atual de notificacoes e manual via `POST /notifications/generate`.
9. Em producao, o projeto esta preparado para Docker e DigitalOcean App Platform, com banco Neon Postgres.

## 2. Jornada ponta a ponta do sistema

```mermaid
flowchart TD
  A["Inicio<br/>Setup local ou deploy"] --> B["Criar/semear empresa,<br/>filiais, usuarios e permissoes"]
  B --> C["Login do usuario<br/>/login"]
  C --> D{"Credenciais validas?"}
  D -- "Nao" --> C1["Exibe erro<br/>na tela de login"]
  D -- "Sim" --> E["API gera access token,<br/>refresh token e log de auditoria"]
  E --> F["Dashboard executivo<br/>/"]
  F --> G["Configurar base corporativa<br/>Empresa, filiais, estrutura, usuarios"]
  G --> H["Definir estrategia<br/>Mapa BSC e OKRs"]
  H --> I["Cadastrar indicadores,<br/>metas e arvore de influencia"]
  I --> J["Lancamento manual ou<br/>importacao CSV de resultados"]
  J --> K["Calculo automatico<br/>de farol e atingimento"]
  K --> L{"Farol vermelho?"}
  L -- "Nao" --> M["Dashboard, ranking,<br/>evolucao, relatorios e insights"]
  L -- "Sim" --> N["Sugerir / abrir desvio<br/>FCA, 5 Porques, Ishikawa,<br/>Pareto, CAPA ou simples"]
  N --> O["Registrar causas,<br/>analises e impacto"]
  O --> P["Criar plano de acao<br/>manual, por desvio ou por reuniao"]
  P --> Q["Executar tarefas,<br/>atualizar status e progresso"]
  Q --> R{"Todas as acoes<br/>do desvio concluidas?"}
  R -- "Nao" --> Q1["Desvio permanece aberto<br/>ou aguardando acao"]
  R -- "Sim" --> S["Fechar desvio<br/>normal ou com atraso"]
  S --> T["Gerar notificacoes,<br/>auditoria e relatorios"]
  M --> U["Ciclo de gestao continua"]
  T --> U
  U --> J

  classDef step fill:#e0f2fe,stroke:#0284c7,color:#0f172a
  classDef rule fill:#dcfce7,stroke:#16a34a,color:#0f172a
  classDef decision fill:#fef3c7,stroke:#d97706,color:#0f172a
  classDef risk fill:#fee2e2,stroke:#dc2626,color:#0f172a
  class A,B,C,E,F,G,H,I,J,M,O,P,Q,S,T,U step
  class K rule
  class D,L,R decision
  class C1,N,Q1 risk
```

### Etapas operacionais

1. **Setup ou deploy**: `pnpm setup` no ambiente local ou deploy via `.do/app.yaml` na DigitalOcean.
2. **Dados iniciais**: seed cria empresa, estrutura, usuarios demo, permissoes, indicadores e dados realistas.
3. **Login**: o usuario entra por `/login`; a API valida senha bcrypt, usuario ativo e gera tokens.
4. **Sessao**: o frontend guarda tokens em `localStorage`; em falha de access token, chama `/auth/refresh`.
5. **Painel executivo**: gestores iniciam no dashboard com total de indicadores, farois, ranking, evolucao e pendencias.
6. **Base corporativa**: empresa, filiais, organograma e usuarios sustentam todos os filtros por area/responsavel.
7. **Estrategia**: mapa BSC, objetivos e OKRs conectam metas estrategicas ao acompanhamento operacional.
8. **Indicadores**: cada KPI tem area dona, responsavel, periodicidade, direcao de meta, unidade, fonte e peso.
9. **Metas**: metas sao cadastradas por `periodRef` canonico, como `YYYY-MM`, `YYYY-Q1`, `YYYY`, etc.
10. **Resultados**: o valor realizado pode ser lancado em lote na tela `/results` ou importado por CSV.
11. **Farol**: a regra `calcStatus` calcula verde, amarelo, vermelho ou cinza, alem de atingimento e desvios.
12. **Gestao do desvio**: se o farol fica vermelho, o sistema permite abrir desvio e conduzir analise de causa.
13. **Plano de acao**: acoes tratam desvios, reunioes, projetos, OKRs, objetivos ou demandas manuais.
14. **Controle de execucao**: subtarefas recalculam progresso; acoes concluidas fora do prazo viram `DONE_LATE`.
15. **Fechamento**: desvio nao fecha enquanto houver acao vinculada aberta.
16. **Aprendizado e governanca**: notificacoes, auditoria, relatorios e insights alimentam o proximo ciclo.

## 3. Fluxo de autenticacao e seguranca

```mermaid
flowchart TD
  A["Usuario informa email e senha"] --> B["POST /auth/login"]
  B --> C["Busca usuario por email"]
  C --> D{"Usuario existe,<br/>ativo e sem deletedAt?"}
  D -- "Nao" --> X["401 Credenciais invalidas"]
  D -- "Sim" --> E["Compara senha com bcrypt"]
  E --> F{"Senha confere?"}
  F -- "Nao" --> X
  F -- "Sim" --> G["Gera access token JWT<br/>TTL padrao 15m"]
  G --> H["Gera refresh token aleatorio<br/>salva hash SHA-256"]
  H --> I["Atualiza lastLoginAt"]
  I --> J["Cria AuditLog LOGIN<br/>com IP e user-agent"]
  J --> K["Frontend salva tokens<br/>e abre Dashboard"]
  K --> L["Chamadas autenticadas<br/>Bearer JWT"]
  L --> M{"Access token expirou?"}
  M -- "Nao" --> N["API responde dados"]
  M -- "Sim" --> O["Frontend chama<br/>POST /auth/refresh"]
  O --> P{"Refresh valido,<br/>nao revogado e nao vencido?"}
  P -- "Nao" --> Q["Limpa tokens<br/>volta para /login"]
  P -- "Sim" --> R["Novo access token"]
  R --> L

  classDef step fill:#e0f2fe,stroke:#0284c7,color:#0f172a
  classDef rule fill:#dcfce7,stroke:#16a34a,color:#0f172a
  classDef decision fill:#fef3c7,stroke:#d97706,color:#0f172a
  classDef risk fill:#fee2e2,stroke:#dc2626,color:#0f172a
  class A,B,C,E,G,H,I,J,K,L,N,O,R step
  class D,F,M,P decision
  class X,Q risk
```

### Controles existentes

| Controle | Onde fica | Como funciona |
| --- | --- | --- |
| JWT obrigatorio | `AuthModule` / `JwtAuthGuard` | Rotas sao protegidas por padrao, exceto `@Public()` como login, refresh e health. |
| Refresh token | `AuthService` | Token bruto fica no cliente; hash SHA-256 fica no banco. |
| Perfil de acesso | `RolesGuard` + `@Roles` | Usado em criacao, ativacao e remocao de usuarios. |
| Tenant | `companyId` no payload JWT | Controllers filtram dados por empresa do usuario logado. |
| Auditoria | `AuditLog` | Login e consultas de auditoria estao implementados; demais acoes podem ser ampliadas. |
| Rate limit | `ThrottlerGuard` | Limite global configurado em 200 requisicoes por minuto. |

## 4. Fluxo de indicadores, metas e resultados

```mermaid
flowchart TD
  A["Cadastrar indicador<br/>/indicators/new"] --> B["Selecionar area dona<br/>OrgNode"]
  B --> C["Definir responsavel,<br/>alimentador, tipo, unidade,<br/>periodicidade, direcao e peso"]
  C --> D["POST /indicators"]
  D --> DB1[("Indicator")]
  DB1 --> E["Cadastrar metas por periodo<br/>POST /indicators/:id/targets"]
  E --> DB2[("IndicatorTarget<br/>periodRef + target + bounds")]
  DB2 --> F["Se ja existe resultado<br/>recalcula farol do periodo"]
  F --> G["Lancamento manual em lote<br/>/results"]
  DB2 --> G
  G --> H["POST /results/batch"]
  H --> I["Para cada linha:<br/>busca indicador e meta"]
  I --> J["periodRef vira periodDate<br/>para ordenacao"]
  J --> K["calcStatus"]
  K --> L["Upsert IndicatorResult<br/>valor, light, attainment,<br/>deviationAbs, deviationPct"]
  L --> M{"light == RED?"}
  M -- "Nao" --> N["Atualiza dashboards,<br/>series, ranking e relatorios"]
  M -- "Sim" --> O["Retorna shouldOpenDeviation=true<br/>e UI sugere abrir desvio"]
  O --> P["POST /deviations<br/>abre desvio sequencial"]
  N --> Q["Gestor acompanha<br/>/dashboard, /indicators/:id,<br/>/tree, /reports"]
  P --> Q

  classDef step fill:#e0f2fe,stroke:#0284c7,color:#0f172a
  classDef rule fill:#dcfce7,stroke:#16a34a,color:#0f172a
  classDef decision fill:#fef3c7,stroke:#d97706,color:#0f172a
  classDef risk fill:#fee2e2,stroke:#dc2626,color:#0f172a
  classDef data fill:#ede9fe,stroke:#7c3aed,color:#0f172a
  class A,B,C,D,E,G,H,I,J,L,N,Q step
  class F,K rule
  class M decision
  class O,P risk
  class DB1,DB2 data
```

### Regras do farol

| Direcao da meta | Verde | Amarelo | Vermelho | Cinza |
| --- | --- | --- | --- | --- |
| `HIGHER_BETTER` | realizado maior ou igual a meta | abaixo da meta dentro da tolerancia | abaixo da tolerancia | sem valor ou sem meta |
| `LOWER_BETTER` | realizado menor ou igual a meta | acima da meta dentro da tolerancia | acima da tolerancia | sem valor ou sem meta |
| `EQUAL_TARGET` | distancia ate a meta dentro de metade da tolerancia | distancia dentro da tolerancia | distancia acima da tolerancia | sem valor ou sem meta |
| `RANGE` | realizado entre limite inferior e superior | fora da faixa, mas dentro da tolerancia | fora da faixa acima da tolerancia | sem valor ou sem meta |

### Telas envolvidas

| Tela | Funcao |
| --- | --- |
| `/indicators` | Lista indicadores, permite busca e filtro por farol. |
| `/indicators/new` | Cadastro completo do KPI. |
| `/indicators/:id` | Detalhe, historico, grafico meta x realizado, metas e abertura de desvio. |
| `/results` | Lancamento em lote dos ultimos periodos. |
| `/tree` | Grafo de influencia entre indicadores e simulacao de impacto. |
| `/reports` | PDF executivo no navegador e CSVs. |

## 5. Fluxo de desvios, causa raiz e planos de acao

```mermaid
flowchart TD
  A["Resultado vermelho<br/>ou decisao manual do gestor"] --> B["Abrir desvio<br/>POST /deviations"]
  B --> C["Sistema calcula numero sequencial<br/>por empresa"]
  C --> D[("Deviation<br/>status OPEN")]
  D --> E["Detalhar fato,<br/>impacto, severidade,<br/>responsavel, prazo e metodo"]
  E --> F["Adicionar causas<br/>POST /deviations/:id/causes"]
  F --> G["Registrar analises<br/>FCA, 5 Porques, Ishikawa,<br/>Pareto, CAPA ou simples"]
  G --> H["Criar plano de acao<br/>POST /actions<br/>origin=DEVIATION"]
  H --> I[("ActionPlan<br/>vinculado ao desvio")]
  I --> J["Adicionar subtarefas<br/>POST /actions/:id/tasks"]
  J --> K["Executar e marcar subtarefas"]
  K --> L["Recalculo automatico<br/>do progresso da acao"]
  L --> M["Alterar status da acao<br/>PATCH /actions/:id/status"]
  M --> N{"Status DONE<br/>apos dueDate?"}
  N -- "Sim" --> O["Sistema grava DONE_LATE"]
  N -- "Nao" --> P["Sistema grava DONE"]
  O --> Q["Tentar fechar desvio<br/>POST /deviations/:id/close"]
  P --> Q
  Q --> R{"Existe acao aberta<br/>vinculada ao desvio?"}
  R -- "Sim" --> S["Bloqueia fechamento<br/>e informa quantidade"]
  R -- "Nao" --> T{"Desvio fechou<br/>apos dueDate?"}
  T -- "Sim" --> U["Status CLOSED_LATE"]
  T -- "Nao" --> V["Status CLOSED"]

  classDef step fill:#e0f2fe,stroke:#0284c7,color:#0f172a
  classDef rule fill:#dcfce7,stroke:#16a34a,color:#0f172a
  classDef decision fill:#fef3c7,stroke:#d97706,color:#0f172a
  classDef risk fill:#fee2e2,stroke:#dc2626,color:#0f172a
  classDef data fill:#ede9fe,stroke:#7c3aed,color:#0f172a
  class A,B,E,F,G,H,J,K,M,Q step
  class C,L,O,P,U,V rule
  class N,R,T decision
  class S risk
  class D,I data
```

### Item por item

1. Um desvio nasce normalmente de indicador vermelho, mas tambem pode ser aberto manualmente pela tela do indicador.
2. O backend gera um numero sequencial por empresa para facilitar rastreabilidade.
3. A ficha do desvio aceita fato, causa raiz, impacto, severidade, responsavel, prazo e metodo de analise.
4. As causas podem ser categorizadas, por exemplo, usando 6M no Ishikawa.
5. Analises sao armazenadas como texto livre ou JSON serializado.
6. Acoes podem nascer do desvio e ficam vinculadas por `deviationId`.
7. Subtarefas controlam a execucao fina; ao marcar/desmarcar, o progresso da acao e recalculado.
8. Ao concluir uma acao depois do prazo, a regra grava `DONE_LATE`.
9. O fechamento do desvio e bloqueado se ainda houver acao diferente de `DONE` ou `DONE_LATE`.
10. Se o desvio for fechado depois do prazo, o status final vira `CLOSED_LATE`.

## 6. Fluxo estrategico: BSC, objetivos e OKRs

```mermaid
flowchart TD
  A["Criar mapa estrategico<br/>POST /strategy/maps"] --> B[("StrategicMap")]
  B --> C["Adicionar perspectivas<br/>Financeira, clientes,<br/>processos, pessoas etc."]
  C --> D[("Perspective")]
  D --> E["Adicionar objetivos estrategicos"]
  E --> F[("StrategicObjective")]
  F --> G["Criar relacoes causa-efeito<br/>entre objetivos"]
  G --> H[("ObjectiveRelation")]
  F --> I["Vincular indicadores<br/>ao objetivo"]
  I --> J["Buscar ultimo resultado<br/>de cada indicador"]
  J --> K["Farol agregado do objetivo"]
  K --> L{"Algum indicador vermelho?"}
  L -- "Sim" --> M["Objetivo agregado vermelho"]
  L -- "Nao" --> N{"Algum indicador amarelo?"}
  N -- "Sim" --> O["Objetivo agregado amarelo"]
  N -- "Nao" --> P["Todos verdes ou cinza<br/>conforme disponibilidade"]
  B --> Q["Criar ciclo OKR<br/>POST /okrs/cycles"]
  Q --> R["Criar objetivo OKR"]
  R --> S["Adicionar Key Results<br/>com peso e direcao"]
  S --> T["Atualizar valor atual<br/>dos KRs"]
  T --> U["Calculo de progresso<br/>ponderado"]
  U --> V["Check-in semanal<br/>confidence + progress"]
  V --> W{"progress >= 95%?"}
  W -- "Sim" --> X["OKR DONE"]
  W -- "Nao" --> Y{"confidence >= 70%<br/>e progress >= 30%?"}
  Y -- "Sim" --> Z["OKR ON_TRACK"]
  Y -- "Nao" --> AA{"confidence < 40%?"}
  AA -- "Sim" --> AB["OKR OFF_TRACK"]
  AA -- "Nao" --> AC["OKR AT_RISK"]

  classDef step fill:#e0f2fe,stroke:#0284c7,color:#0f172a
  classDef rule fill:#dcfce7,stroke:#16a34a,color:#0f172a
  classDef decision fill:#fef3c7,stroke:#d97706,color:#0f172a
  classDef data fill:#ede9fe,stroke:#7c3aed,color:#0f172a
  class A,C,E,G,I,J,Q,R,S,T,V step
  class K,M,O,P,U,X,Z,AB,AC rule
  class L,N,W,Y,AA decision
  class B,D,F,H data
```

### Como o gestor usa

| Modulo | Uso gerencial |
| --- | --- |
| Mapa BSC | Mostra a estrategia em perspectivas e objetivos, com farol agregado pelos indicadores vinculados. |
| Relacoes causa-efeito | Mostram dependencia entre objetivos estrategicos. |
| OKRs | Traduzem objetivos em ciclos, objetivos mensuraveis, KRs e check-ins. |
| Check-in | Atualiza confianca e status automaticamente: `DONE`, `ON_TRACK`, `OFF_TRACK` ou `AT_RISK`. |

## 7. Fluxo de arvore de indicadores e simulacao de impacto

```mermaid
flowchart TD
  A["Cadastrar indicadores"] --> B["Criar relacoes pai-filho<br/>POST /indicators/:id/children"]
  B --> C[("IndicatorTreeRelation<br/>kind + weight")]
  C --> D["Abrir tela /tree"]
  D --> E["GET /indicators/tree/graph"]
  E --> F["API retorna nodes e edges<br/>com ultimo farol"]
  F --> G["Frontend monta grafo<br/>com React Flow"]
  G --> H["Usuario seleciona indicador"]
  H --> I["GET /indicators/:id/impact?depth=4"]
  I --> J["Backend percorre descendentes<br/>com BFS ate profundidade maxima"]
  J --> K["Multiplica pesos acumulados"]
  K --> L["Retorna indicadores impactados,<br/>profundidade, peso e farol"]
  L --> M["Gestor identifica efeito cascata<br/>de um KPI sobre outros"]

  classDef step fill:#e0f2fe,stroke:#0284c7,color:#0f172a
  classDef rule fill:#dcfce7,stroke:#16a34a,color:#0f172a
  classDef data fill:#ede9fe,stroke:#7c3aed,color:#0f172a
  class A,B,D,E,F,G,H,I,L,M step
  class J,K rule
  class C data
```

## 8. Fluxo de reunioes, projetos e execucao

```mermaid
flowchart TD
  A["Criar reuniao<br/>/meetings"] --> B[("Meeting")]
  B --> C["Adicionar participantes"]
  C --> D["Registrar pauta"]
  D --> E["Registrar decisoes"]
  E --> F["Gerar acao a partir da reuniao"]
  F --> G[("ActionPlan<br/>origin=MEETING")]
  G --> H["Kanban de acoes<br/>/actions"]
  H --> I["Mover status<br/>NOT_STARTED, IN_PROGRESS,<br/>WAITING_THIRD, PAUSED, DONE"]
  I --> J["Detalhe da acao<br/>subtarefas, custo, prazo,<br/>responsavel e progresso"]
  J --> K["Concluir ou registrar atraso"]
  A --> L["Criar projeto<br/>/projects"]
  L --> M[("Project")]
  M --> N["Adicionar milestones"]
  N --> O["Adicionar tarefas<br/>com dependencias"]
  O --> P["Visualizar Gantt SVG"]
  P --> Q["Atualizar progresso e marcos"]
  Q --> H

  classDef step fill:#e0f2fe,stroke:#0284c7,color:#0f172a
  classDef rule fill:#dcfce7,stroke:#16a34a,color:#0f172a
  classDef data fill:#ede9fe,stroke:#7c3aed,color:#0f172a
  class A,C,D,E,F,H,I,J,L,N,O,P,Q step
  class K rule
  class B,G,M data
```

### Pontos de controle

| Area | Controle |
| --- | --- |
| Reunioes | Participantes, presenca, pauta, decisoes e geracao de acao. |
| Acoes | Kanban, prioridade, responsavel, area, origem, prazo, progresso e subtarefas. |
| Projetos | Marcos, tarefas, dependencias e visualizacao em Gantt. |
| Atrasos | Acoes vencidas aparecem em filtros, notificacoes e dashboard. |

## 9. Fluxo de importacao CSV

```mermaid
flowchart TD
  A["Usuario baixa ou prepara modelo CSV"] --> B["Tela /imports<br/>Papaparse no navegador"]
  B --> C["Seleciona alvo<br/>INDICATORS, TARGETS ou RESULTS"]
  C --> D["CSV vira linhas JSON<br/>com rowIndex"]
  D --> E["POST /imports/preview"]
  E --> F["Backend valida linha a linha"]
  F --> G{"Linha valida?"}
  G -- "Nao" --> H["Retorna erro da linha<br/>sem gravar no banco"]
  G -- "Sim" --> I["Marca linha como OK<br/>no preview"]
  H --> J["Usuario corrige arquivo<br/>ou decide importar validas"]
  I --> K["POST /imports/commit"]
  K --> L["Cria ImportJob"]
  L --> M["Processa cada linha"]
  M --> N{"Erro no processamento?"}
  N -- "Sim" --> O["Cria ImportError<br/>com payload e mensagem"]
  N -- "Nao" --> P["Upsert no destino"]
  P --> Q{"Destino RESULTS?"}
  Q -- "Sim" --> R["Calcula farol via calcStatus"]
  Q -- "Nao" --> S["Atualiza indicador ou meta"]
  R --> T["Atualiza ImportJob<br/>okRows, errorRows, finishedAt"]
  S --> T
  O --> T
  T --> U["Historico em /imports/jobs"]

  classDef step fill:#e0f2fe,stroke:#0284c7,color:#0f172a
  classDef rule fill:#dcfce7,stroke:#16a34a,color:#0f172a
  classDef decision fill:#fef3c7,stroke:#d97706,color:#0f172a
  classDef risk fill:#fee2e2,stroke:#dc2626,color:#0f172a
  classDef data fill:#ede9fe,stroke:#7c3aed,color:#0f172a
  class A,B,C,D,E,F,I,J,K,M,P,S,T,U step
  class R rule
  class G,N,Q decision
  class H,O risk
  class L data
```

### Validacoes importantes

| Alvo | Validacao principal | Gravacao |
| --- | --- | --- |
| `INDICATORS` | `code` e `name` obrigatorios; `ownerCode` precisa existir. | Upsert de indicador por `companyId + code`. |
| `TARGETS` | `code`, `periodRef` e `target` numerico; indicador precisa existir. | Upsert de meta por `indicatorId + periodRef`. |
| `RESULTS` | `code`, `periodRef` e `value` numerico; indicador precisa existir. | Upsert de resultado e calculo automatico do farol. |

## 10. Fluxo de dashboard, insights, notificacoes e relatorios

```mermaid
flowchart TD
  A["Resultados, metas,<br/>acoes e desvios no banco"] --> B["Dashboard /"]
  B --> C["GET /dashboard/overview"]
  B --> D["GET /dashboard/ranking"]
  B --> E["GET /dashboard/evolution"]
  B --> F["GET /dashboard/worst"]
  B --> G["GET /dashboard/pending"]
  C --> H["Cards executivos<br/>total, farois, atingimento,<br/>acoes abertas, atrasadas,<br/>desvios criticos"]
  D --> I["Ranking de areas<br/>por atingimento medio"]
  E --> J["Evolucao mensal<br/>e taxa de verdes"]
  F --> K["Piores indicadores<br/>vermelhos recentes"]
  G --> L["Pendencias de lancamento"]
  A --> M["Insights /insights"]
  M --> N["Resumo executivo"]
  M --> O["Tendencia de piora"]
  M --> P["Sugestoes de causa"]
  M --> Q["Sugestoes de acao"]
  A --> R["Sino de notificacoes"]
  R --> S["POST /notifications/generate"]
  S --> T["Regra: acoes atrasadas<br/>sem alerta aberto"]
  S --> U["Regra: indicador vermelho<br/>para responsavel"]
  T --> V[("Notification")]
  U --> V
  A --> W["Relatorios /reports"]
  W --> X["PDF executivo no browser<br/>jsPDF"]
  W --> Y["CSVs da API<br/>indicadores, resultados,<br/>acoes e desvios"]

  classDef step fill:#e0f2fe,stroke:#0284c7,color:#0f172a
  classDef rule fill:#dcfce7,stroke:#16a34a,color:#0f172a
  classDef data fill:#ede9fe,stroke:#7c3aed,color:#0f172a
  class A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,W,X,Y step
  class T,U rule
  class V data
```

### Como a informacao executiva e formada

| Saida | Origem dos dados |
| --- | --- |
| Total e farois | Ultimo resultado de cada indicador ativo. |
| Atingimento geral | Media dos atingimentos, limitada para evitar distorcao extrema. |
| Ranking de areas | Agrupa indicadores por `ownerNodeId`. |
| Evolucao | Resultados mensais dos ultimos N meses. |
| Piores indicadores | Indicadores com ultimo farol vermelho, ordenados por pior atingimento. |
| Insights | Heuristicas locais; nao chama IA externa no estado atual. |
| Notificacoes | Geradas sob demanda por regras de indicador vermelho e acao atrasada. |
| Relatorios | CSVs no backend e PDF executivo gerado no frontend. |

## 11. Fluxo de dados principais

```mermaid
erDiagram
  Company ||--o{ Branch : possui
  Company ||--o{ OrgNode : organiza
  Company ||--o{ User : possui
  Company ||--o{ Indicator : mede
  Company ||--o{ StrategicMap : define
  Company ||--o{ OKRCycle : acompanha
  Company ||--o{ Deviation : trata
  Company ||--o{ ActionPlan : executa
  Company ||--o{ Project : gerencia
  Company ||--o{ Meeting : agenda
  Company ||--o{ Notification : alerta
  Company ||--o{ ImportJob : importa
  Company ||--o{ AuditLog : audita

  OrgNode ||--o{ OrgNode : contem
  OrgNode ||--o{ Indicator : e_dono_de
  OrgNode ||--o{ ActionPlan : e_area_de

  User ||--o{ IndicatorResult : lanca
  User ||--o{ ActionPlan : responsavel
  User ||--o{ Deviation : responsavel
  User ||--o{ Notification : recebe

  Indicator ||--o{ IndicatorTarget : tem_metas
  Indicator ||--o{ IndicatorResult : tem_resultados
  Indicator ||--o{ Deviation : gera_desvios
  Indicator ||--o{ IndicatorTreeRelation : relaciona

  Deviation ||--o{ DeviationCause : possui
  Deviation ||--o{ DeviationAnalysis : possui
  Deviation ||--o{ ActionPlan : exige

  ActionPlan ||--o{ ActionTask : detalha
  StrategicMap ||--o{ Perspective : possui
  Perspective ||--o{ StrategicObjective : agrupa
  StrategicObjective ||--o{ Indicator : vincula
  StrategicObjective ||--o{ OKRObjective : conecta
  OKRCycle ||--o{ OKRObjective : possui
  OKRObjective ||--o{ KeyResult : mede
  OKRObjective ||--o{ OKRCheckin : registra
  Project ||--o{ ProjectMilestone : possui
  Project ||--o{ ProjectTask : possui
  Meeting ||--o{ MeetingParticipant : possui
  Meeting ||--o{ MeetingAgendaItem : possui
  Meeting ||--o{ MeetingDecision : possui
  ImportJob ||--o{ ImportError : registra
```

### Entidades por dominio

| Dominio | Entidades |
| --- | --- |
| Organizacao | `Company`, `Branch`, `OrgNode`, `User`, `Permission`, `UserPermission`, `RefreshToken` |
| Estrategia | `StrategicMap`, `Perspective`, `StrategicObjective`, `ObjectiveRelation` |
| OKR | `OKRCycle`, `OKRObjective`, `KeyResult`, `OKRCheckin` |
| KPI | `Indicator`, `IndicatorTarget`, `IndicatorResult`, `IndicatorTreeRelation` |
| Desvio e acao | `Deviation`, `DeviationCause`, `DeviationAnalysis`, `ActionPlan`, `ActionTask` |
| Execucao | `Project`, `ProjectMilestone`, `ProjectTask`, `Meeting`, `MeetingParticipant`, `MeetingAgendaItem`, `MeetingDecision` |
| Suporte | `Attachment`, `Comment`, `Notification`, `ImportJob`, `ImportError`, `AuditLog`, `AppSetting` |

## 12. Fluxo de setup local e deploy

```mermaid
flowchart TD
  A["Desenvolvedor clona o repo"] --> B["pnpm install"]
  B --> C["Copiar .env.example para .env"]
  C --> D["pnpm shared:build"]
  D --> E["pnpm db:up<br/>Postgres + Redis via Docker"]
  E --> F["pnpm db:migrate<br/>Prisma cria schema"]
  F --> G["pnpm db:seed<br/>dados demo"]
  G --> H["pnpm dev<br/>API + Web"]
  H --> I["Web local<br/>localhost:3000"]
  H --> J["API local<br/>localhost:3333/api"]
  A --> K["Deploy producao"]
  K --> L["Criar Neon Postgres<br/>DATABASE_URL + DIRECT_URL"]
  L --> M["Subir repo no GitHub"]
  M --> N["Editar .do/app.yaml<br/>REPO_OWNER/REPO_NAME"]
  N --> O["Configurar secrets<br/>JWT e banco"]
  O --> P["doctl apps create --spec .do/app.yaml"]
  P --> Q["DigitalOcean cria services<br/>api e web"]
  Q --> R["Health check<br/>/api/health e /login"]

  classDef step fill:#e0f2fe,stroke:#0284c7,color:#0f172a
  classDef rule fill:#dcfce7,stroke:#16a34a,color:#0f172a
  class A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R step
```

## 13. Mapa de navegacao por perfil de uso

| Perfil | Primeiro uso recomendado | Rotas principais |
| --- | --- | --- |
| Diretoria | Acompanhar resultado consolidado e riscos. | `/`, `/insights`, `/strategy`, `/okrs`, `/reports` |
| Gestor de area | Cuidar indicadores, lancamentos, desvios e acoes da area. | `/indicators`, `/results`, `/deviations`, `/actions`, `/tree` |
| Analista | Alimentar dados, importar CSV, montar relatorios e apoiar causas. | `/results`, `/imports`, `/reports`, `/audit` |
| PMO / Projetos | Controlar cronogramas, marcos, tarefas e reunioes. | `/projects`, `/meetings`, `/actions` |
| Administrador | Manter empresa, estrutura e usuarios. | `/settings`, `/org`, `/users`, `/audit` |

## 14. Mapa completo das telas

| Secao da sidebar | Rota | O que entrega |
| --- | --- | --- |
| Visao | `/` | Dashboard executivo com KPIs, farois, ranking, evolucao, criticos e pendencias. |
| Visao | `/insights` | Heuristicas locais de resumo, tendencia, causa e acao. |
| Estrategia | `/strategy` | Lista de mapas estrategicos. |
| Estrategia | `/strategy/:id` | Mapa BSC com perspectivas, objetivos, farol agregado e status inline. |
| Estrategia | `/okrs` | Ciclos, objetivos, KRs, check-ins e progresso ponderado. |
| Performance | `/indicators` | Lista de indicadores com filtros. |
| Performance | `/indicators/new` | Cadastro de indicador. |
| Performance | `/indicators/:id` | Detalhe, serie historica, metas, historico e abertura de desvio. |
| Performance | `/results` | Lancamentos em lote dos resultados. |
| Performance | `/tree` | Arvore de indicadores e simulacao de impacto. |
| Execucao | `/deviations` | Lista de desvios com severidade e contagens. |
| Execucao | `/deviations/:id` | Analise completa do desvio, causas, metodos e fechamento. |
| Execucao | `/actions` | Kanban de planos de acao. |
| Execucao | `/actions/:id` | Detalhe da acao, subtarefas, status, custo, datas e progresso. |
| Execucao | `/projects` | Lista de projetos e progresso. |
| Execucao | `/projects/:id` | Gantt, marcos, tarefas e dependencias. |
| Execucao | `/meetings` | Lista e criacao de reunioes. |
| Execucao | `/meetings/:id` | Pauta, participantes, decisoes e gerador de acao. |
| Dados | `/imports` | Wizard CSV com preview, erros por linha e commit. |
| Dados | `/reports` | PDF executivo e exportacoes CSV. |
| Empresa | `/org` | Estrutura organizacional em arvore. |
| Empresa | `/users` | Usuarios e perfis. |
| Empresa | `/audit` | Auditoria com filtros por entidade e acao. |
| Empresa | `/settings` | Dados da empresa e filiais. |

## 15. API por modulo

| Modulo | Endpoints principais | Papel no fluxo |
| --- | --- | --- |
| `auth` | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` | Entrada, sessao, renovacao e identidade do usuario. |
| `companies` | `GET /companies/me`, `GET /companies/me/branches` | Dados da empresa logada e filiais. |
| `users` | `GET /users`, `POST /users`, `PATCH /users/:id/active`, `DELETE /users/:id` | Gestao de usuarios, com criacao/ativacao/remocao restritas a admin. |
| `orgnodes` | `GET /orgnodes`, `GET /orgnodes/tree`, CRUD, `PATCH /:id/move` | Organograma e areas donas dos indicadores. |
| `indicators` | CRUD, `/series`, `/targets`, `/children`, `/tree/graph`, `/impact` | KPIs, metas, series, arvore e simulacao. |
| `results` | `/pending`, `POST /results`, `POST /results/batch`, `POST /:id/approve` | Lancamentos, calculo de farol e aprovacao/rejeicao. |
| `deviations` | CRUD, `/causes`, `/analyses`, `/close` | Desvios, causa raiz, analises e fechamento controlado. |
| `actions` | CRUD, `/status`, `/tasks` | Planos de acao, Kanban, subtarefas e progresso. |
| `dashboard` | `/overview`, `/ranking`, `/evolution`, `/worst`, `/pending` | Agregacoes executivas. |
| `strategy` | `/maps`, `/perspectives`, `/objectives`, `/relations`, vinculo de indicadores | Mapa estrategico BSC. |
| `okrs` | `/cycles`, `/objectives`, `/krs`, `/checkin` | Ciclos OKR, KRs, progresso e confianca. |
| `projects` | CRUD, `/milestones`, `/tasks` | Projetos, Gantt, marcos e dependencias. |
| `meetings` | CRUD, participantes, pauta, decisoes, `/actions` | Reunioes e geracao de acoes. |
| `notifications` | `/`, `/count`, `/read`, `/read-all`, `/generate` | Sino, contagem e regras de alerta. |
| `imports` | `/preview`, `/commit`, `/jobs`, `/jobs/:id/errors` | Importacao CSV validada linha a linha. |
| `reports` | `/indicators.csv`, `/results.csv`, `/actions.csv`, `/deviations.csv` | Exportacoes para Excel/BI. |
| `insights` | `GET /insights` | Heuristicas executivas sem IA externa. |
| `audit` | `GET /audit` | Rastro consultavel por empresa, entidade e acao. |
| `health` | `GET /health` | Health check publico. |

## 16. Regras de negocio consolidadas

| Regra | Onde aparece | Resultado |
| --- | --- | --- |
| `calcStatus` compartilhado | `packages/shared/src/status.ts` | Mesmo calculo de farol no front e no back. |
| Meta alterada recalcula resultado existente | `IndicatorsService.upsertTarget` | Evita farol desatualizado quando a meta muda. |
| Resultado vermelho sugere desvio | `ResultsService.upsert` | Retorna `shouldOpenDeviation: true`. |
| Desvio recebe numero sequencial por empresa | `DeviationsService.open` | Facilita gestao e rastreabilidade. |
| Fechamento de desvio exige acoes concluidas | `DeviationsService.close` | Bloqueia encerramento prematuro. |
| Acao concluida em atraso vira `DONE_LATE` | `ActionsService.changeStatus` | Mantem historico do prazo. |
| Subtarefas recalculam progresso | `ActionsService.recalcProgress` | Progresso sempre coerente com tarefas. |
| Ranking de areas usa ultimo resultado | `DashboardService.ranking` | Gestao compara areas pelo atingimento. |
| Objetivo BSC agrega farol dos indicadores | `StrategyService.getMap` | Vermelho prevalece, depois amarelo, depois verde. |
| OKR usa progresso ponderado | `OkrsService.enrich` | KRs com maior peso impactam mais o objetivo. |
| Check-in define status OKR | `OkrsService.checkin` | `DONE`, `ON_TRACK`, `OFF_TRACK` ou `AT_RISK`. |
| Importacao valida antes de gravar | `ImportsService.preview` | Erros aparecem por linha antes do commit. |
| Notificacao evita duplicidade aberta | `NotificationsService.generateAlerts` | Nao cria alerta repetido nao lido para o mesmo link. |
| Soft delete | Diversos services | Registros sao inativados via `deletedAt`, nao apagados fisicamente. |

## 17. Leitura gerencial do ciclo

O sistema implementa um ciclo PDCA/gestao a vista:

1. **Planejar**: estrutura organizacional, estrategia, objetivos, OKRs, indicadores e metas.
2. **Executar**: lancar resultados, executar projetos, reunioes e planos de acao.
3. **Checar**: dashboards, farois, ranking, evolucao, relatorios, insights e notificacoes.
4. **Agir**: abrir desvios, analisar causa raiz, criar acoes, acompanhar prazos e fechar somente quando resolvido.
5. **Aprender**: auditoria, historico, tendencias e relatorios alimentam a proxima rodada de metas.

## 18. Observacoes importantes

- Apesar do nome da pasta conter `sqlite`, o schema atual usa **PostgreSQL** via Prisma.
- Redis/BullMQ esta na stack, mas as filas ainda nao foram implementadas; alertas rodam sob demanda.
- Os insights sao heuristicas locais, nao chamadas a uma IA externa.
- O isolamento multiempresa depende de `companyId` nos filtros da aplicacao; nao ha RLS no Postgres no estado atual.
- O catalogo de permissoes existe, mas o enforcement detalhado por permissao ainda nao esta espalhado por todos os endpoints.

