# Gestão de Prêmio (Remuneração Variável)

> Módulo corporativo do Gestão 360 para controlar o ciclo completo da remuneração
> variável: **Programa → Anexo → Aprovação → Indicadores → Metas → Realizado →
> Fechamento → Base Elegível → Eventos → Transitoriedade → Ajustes → Exceções →
> Cálculo → Conferência → Aprovação → Folha → Espelho → Auditoria**.
>
> Documento vivo. Cobre as Fases **1 (Fundação + Governança)**, **2 (Realizado +
> Previsto × Realizado)**, **3 (Base Elegível / Apdata + Snapshot + Conciliação)**
> e **4 (Motor de Cálculo + Apuração)**, entregues e validadas. As fases seguintes
> estão no backlog residual (seção 7).

## 0.2. Fase 4 — Motor de Cálculo + Apuração (entregue)

> **Calibração:** revisados TODOS os arquivos da pasta `Gestao_premio` (PDF, DOCX,
> XLSX, PPTX, .bpm). Os documentos definem o **conjunto completo de regras/etapas**
> (idêntico ao processo GOIASA), porém **não fixam percentuais** — por exigência
> dos requisitos, os valores são **parametrizáveis** e vivem no anexo + nas regras
> de moderador. Único default fixo: **média de 6 meses** (configurável) para
> impossibilidade. Logo, o motor sai calibrado nas regras; os números entram pela
> configuração (multiempresa, sem hardcode).

- **Banco** (aditivo): 4 enums + 7 tabelas (`PrizeModeratorRule`,
  `PrizeManualAdjustment`, `PrizeException`, `PrizeTemporaryAllocation`,
  `PrizeCalculationRun`, `PrizeCalculationResult`, `PrizeCalculationLine`).
  Migração `20260609200000_prize_calc_engine`.
- **Motor PURO** (`prize-calc-engine.ts`, `computePrize`): etapas do procedimento
  (potencial → atingimento ponderado por faixa → resultado-base → proporcionalidade
  → indicadores individuais/comportamentais → bruto → moderadores → ajustes →
  exceções → teto/piso → arredondamento → final), com **memória de cálculo**
  (linhas auditáveis) e hash do processamento. Determinístico e 100% testado
  (`prize-calc-engine.spec.ts`, 10 cenários).
- **Orquestração** (`prize-calc.service.ts`): carrega snapshot elegível + anexo
  vigente (match por cargo/área) + indicadores + realizado + eventos + regras +
  ajustes/exceções aprovados; roda o motor por colaborador; persiste run/result/
  line. **Reprocesso versionado** (run anterior → SUPERSEDED, nunca sobrescreve);
  impossibilidade usa média histórica das competências anteriores.
- **Configuração e governança** (`prize-calc-config.service.ts`): moderadores
  (CRUD parametrizável), ajustes manuais e exceções com **fluxo de aprovação e
  segregação** (quem solicita não aprova o próprio ajuste), transitoriedade.
- **Frontend**: `/gestao-premio/apuracao` (rodar/reprocessar + resultados +
  **memória de cálculo** por colaborador) e `/gestao-premio/moderadores` (config).
- **Testes**: suíte total **274 verdes**. tsc verde (api+web).

## 0.1. Fase 3 — Base Elegível (Apdata) + Snapshot + Conciliação (entregue)

- **Banco** (aditivo): enums `PrizeConnectorType`, `PrizeJobStatus` + tabelas
  `PrizeIntegrationConfig`, `PrizeIntegrationJob`, `PrizeEmployeeSnapshot`,
  `PrizeEmployeeEvent`. Migração `20260609190000_prize_eligible`.
- **Conectores desacoplados** (`/gestao-premio/integracoes`): Apdata (base/eventos),
  BSC e Folha; tipos API/CSV/XLSX/banco/manual. **Segredos por referência**
  (`secretRef` = nome de env var/cofre) — nunca armazenados em claro; resposta
  redige a referência (`hasSecret`). Teste de conector valida credencial/endpoint
  sem expor valores. Sem conector real → **importação assistida por arquivo/mock**.
- **Base elegível** (`/gestao-premio/colaboradores`): import por competência com
  **snapshot imutável por lote** (`lotVersion`, `current`), **CPF mascarado**
  (`***.456.789-**`) e **salário protegido** por `prize:salary:view`. Eventos
  (faltas/atestados/medidas/acidentes/treinamento…) importados junto, alimentando
  proporcionalidade/moderadores da Fase 4.
- **Conciliação**: cada import compara o lote entrante com o corrente e reporta
  inclusões, exclusões, alterações (cargo/área/CC/situação/salário) e pendências
  (sem salário, sem cargo, desligados). Helper puro `reconcile`/`maskCpf` testado.
- **Permissão**: `prize:eligible:manage` (importar/conciliar); conectores sob
  `prize:admin`. **Checklist de fechamento**: item "base elegível" disponível.
- **Testes**: `prize-eligible.util.spec.ts` (masking, conciliação, mock).
- **Isolamento de trabalho**: esta fase foi desenvolvida em git **worktree**
  dedicada (`.claude/worktrees/gestao-premio`) no branch `feat/gestao-premio`,
  sem tocar no `main`.

## 0. Fase 2 — Lançamento do Realizado + Previsto × Realizado (entregue)

O Gestão 360 passa a ser a **fonte oficial do realizado**.

- **Banco** (aditivo): enum `PrizeActualStatus` + tabelas `PrizeActualResult` e
  `PrizeActualEvidence`. Migração `20260609180000_prize_actuals`. Realizado é
  único por `(competência, indicador, escopo, semana, dia)`.
- **Lançamento do Realizado** (`/gestao-premio/realizado`): grade editável por
  indicador/competência, salvamento em lote, validações (competência travada,
  indicador inativo, alteração de realizado em validação exige justificativa),
  status do realizado (`IN_FILLING → PENDING → IN_VALIDATION → PRE_CLOSE → CLOSED
  → REOPENED → CORRECTED`), **fechamento do realizado** (trava) e **reabertura
  controlada** (alçada `prize:actuals:close` + justificativa). Evidências por
  lançamento (API).
- **Previsto × Realizado** (`/gestao-premio/previsto-realizado`): por competência,
  compara meta/zero × realizado e calcula **desvio, % de atingimento e faixa
  alcançada** (helper puro `evaluateActual`, testado). Resumo (com realizado /
  sem realizado / fora da meta) e atalhos para Análise de Causa e Plano de Ação.
- **Checklist de fechamento** da competência agora valida **realizado completo**
  (item impeditivo real: nº de indicadores com realizado).
- **Testes**: `prize-evaluation.spec.ts` (6 casos de atingimento/faixa). Suíte
  total **257 verdes**.

---

## 1. Relatório executivo

### Cenário anterior
A apuração do prêmio dependia de controles paralelos: BSC, planilhas de resultados
e de apontamentos, SESuite, Helpdesk, Apdata, e-mails e validações manuais
(transitoriedade, gratificação de treinamento, conferência de indicadores). Isso
gerava divergências, retrabalho, atraso no fechamento, baixa rastreabilidade e
risco de pagamento incorreto — conforme o mapa do processo (BIZAGI "GESTÃO DE
PRÊMIO2") e a matriz de 25 requisitos (POC, indispensáveis).

### Solução implementada (Fase 1)
O Gestão 360 passa a ser a **fonte oficial e auditável** da governança do prêmio.
Nesta fase entregamos a fundação completa do módulo:

- **Programas de Prêmio**: cadastro parametrizável (periodicidade, moeda,
  arredondamento, prazos, rubrica, responsáveis, elegibilidade) com versionamento
  de configuração e duplicação.
- **Anexos e Regras com governança real**: versões, **workflow de aprovação**
  (rascunho → em elaboração → em validação → em aprovação → aprovado → vigente →
  substituído), **regra de versão única vigente por anexo/contexto**, bloqueio de
  edição de versão vigente, devolução/reprovação com comentário obrigatório,
  verificação de **sobreposição de vigência** e comparação entre versões.
- **Indicadores** coletivos, individuais e comportamentais com **metas, zeros,
  pesos e faixas variáveis por período**.
- **Competências** com máquina de estados, **checklist de fechamento** (itens
  impeditivos x alertas), **fechamento que trava alterações** e **reabertura
  controlada com justificativa obrigatória e alçada**.
- **Trilha de auditoria** imutável para toda ação crítica.
- **Painel executivo** (Visão Geral) com cards de governança e ciclo + atividade
  recente, e cards de apuração/folha já visíveis (preenchidos nas próximas fases).
- **Multiempresa**: isolamento por `companyId`; módulo `prize` no catálogo do
  Super Admin (liga/desliga por empresa); 19 permissões granulares com
  **segregação de função** (quem opera não aprova; salário é permissão separada).

### Telas criadas
`/gestao-premio` (Visão Geral), `/gestao-premio/programas`,
`/gestao-premio/competencias`, `/gestao-premio/anexos`,
`/gestao-premio/indicadores`.

### Ganhos esperados
Base única e versionada das regras; rastreabilidade ponta a ponta; redução de
divergências e retrabalho; fechamento com checklist; segregação de função e
conformidade (LGPD: salário sob permissão dedicada).

### Riscos / pendências
- Migração ainda **não aplicada** ao banco de produção (Neon) — requer
  autorização explícita (ver seção 5).
- Fases 2–7 (realizado, Apdata, motor de cálculo, moderadores, transitoriedade,
  folha, espelho PDF, relatórios) no backlog.

---

## 2. Relatório técnico

### Arquitetura
- **Backend** (`apps/api`, NestJS + Prisma): módulo `prize` registrado em
  `app.module.ts`. Controllers REST sob `/api/prize/*`, services com toda a regra
  de negócio (cálculos e workflow **no backend**, nunca no frontend).
- **Frontend** (`apps/web`, Next.js App Router): rotas em
  `app/(app)/gestao-premio/*`, react-query + `useAuth().hasPermission`.
- **Tenancy**: `companyId` escalar em todas as tabelas do módulo (mesmo padrão de
  `PlatformCompanyModule`). Relações **internas** ao módulo usam `@relation`;
  referências externas (User/OrgNode) são colunas escalares para não impactar os
  modelos compartilhados.

### Banco de dados (8 enums + 10 tabelas)
`PrizeProgram`, `PrizeProgramVersion`, `PrizeCompetence`, `PrizeAnnex`,
`PrizeAnnexVersion`, `PrizeAnnexApproval`, `PrizeIndicator`,
`PrizeIndicatorParameter`, `PrizeIndicatorRange`, `PrizeAuditLog`.
Enums: `PrizeProgramStatus`, `PrizePeriodicity`, `PrizeCompetenceStatus`,
`PrizeAnnexStatus`, `PrizeApprovalStatus`, `PrizeIndicatorKind`,
`PrizeIndicatorDirection`, `PrizeIndicatorSource`.

### Migração
`apps/api/prisma/migrations/20260609170000_prize_module_foundation/migration.sql`
— **aditiva e reversível**. Não altera nenhuma tabela existente (verificado: sem
DROP/ALTER em tabelas legadas). Cabeçalho documenta o rollback.

### APIs (resumo)
| Método | Rota | Permissão |
|---|---|---|
| GET | `/prize/overview` | `prize:view` |
| GET | `/prize/audit` | `prize:reports:view` |
| GET/POST/PATCH/DELETE | `/prize/programs[...]` | `prize:view` / `prize:programs:manage` |
| GET/POST/PATCH | `/prize/competences[...]` | `prize:view` / `prize:competences:manage` |
| POST | `/prize/competences/:id/close` | `prize:competences:close` |
| POST | `/prize/competences/:id/reopen` | `prize:competences:reopen` |
| GET/POST/PATCH | `/prize/annexes[...]` | `prize:view` / `prize:annex:manage` |
| POST | `/prize/annexes/versions/:id/submit` · `/send-approval` | `prize:annex:submit` |
| POST | `/prize/annexes/versions/:id/decide` · `/publish` | `prize:annex:approve` |
| GET/POST/PATCH/DELETE | `/prize/indicators[...]` (+ `/parameters`, `/ranges`) | `prize:view` / `prize:indicators:manage` |

### Permissões (19)
`prize:view`, `prize:programs:manage`, `prize:competences:manage|close|reopen`,
`prize:annex:manage|submit|approve`, `prize:indicators:manage`,
`prize:actuals:manage|close`, `prize:calc:run`,
`prize:adjustments:manage|approve`, `prize:payroll:manage`,
`prize:payslip:publish`, `prize:reports:view`, `prize:salary:view`,
`prize:admin`. SUPER_ADMIN/ADMIN recebem todas; GESTOR recebe um subconjunto
operacional **sem** aprovar/ver salário (segregação).

### Arquivos
**Criados (backend):** `modules/prize/` → `prize.module.ts`, `prize.controller.ts`,
`prize-audit.service.ts`, `prize-overview.service.ts`,
`prize-programs.{service,controller}.ts`,
`prize-competences.{service,controller}.ts`,
`prize-annexes.{service,controller}.ts`,
`prize-indicators.{service,controller}.ts`,
`prize-annexes.service.spec.ts`.
**Criados (frontend):** `app/(app)/gestao-premio/{,programas,competencias,anexos,indicadores}/page.tsx`.
**Alterados:** `prisma/schema.prisma`, `app.module.ts`,
`modules/users/permission-catalog.ts`,
`modules/portal-admin/portal-catalog.ts`,
`web/components/shell/navigation.ts`.

### Testes
`prize-annexes.service.spec.ts` (5 casos): versão única vigente ao publicar;
bloqueio de publicar não-aprovada; bloqueio de editar versão vigente; fluxo
completo submit→aprovação→publicação; devolução exige comentário.
**Suíte total: 251 testes verdes.** `tsc --noEmit` verde em `apps/api` e `apps/web`.

### Deploy / rollback
- `npx prisma generate` já executado (atualiza o client, não toca o banco).
- Para aplicar em produção: `pnpm --filter @g360/api prisma:deploy` (após
  autorização — ver seção 5).
- Rollback: cabeçalho da migration tem o `DROP TABLE/TYPE` correspondente.

---

## 3. Mapa funcional (ciclo do prêmio)

```text
Programa → Anexo → Aprovação → Indicadores → Metas → Realizado → Fechamento
→ Base Elegível → Eventos → Transitoriedade → Ajustes → Exceções → Cálculo
→ Conferência → Aprovação → Folha → Espelho → Auditoria
```

Legenda Fase 1: **implementado** = Programa, Anexo, Aprovação, Indicadores, Metas,
Fechamento (checklist/trava/reabertura), Auditoria. **Próximas fases** = Realizado,
Base Elegível (Apdata), Eventos, Transitoriedade, Ajustes, Exceções, Cálculo,
Conferência, Folha, Espelho.

---

## 4. Máquinas de estado

**Anexo (versão):** `DRAFT → IN_ELABORATION → IN_VALIDATION → IN_APPROVAL →
APPROVED → EFFECTIVE → SUPERSEDED → ARCHIVED`. Publicar exige `APPROVED`; ao
publicar, a versão vigente anterior vira `SUPERSEDED` (versão única vigente).

**Competência:** `PLANNED → OPEN → FILLING → IN_VALIDATION → PRE_CLOSE →
CLOSED_FOR_CALC → IN_CALCULATION → IN_REVIEW → IN_APPROVAL → APPROVED →
SENT_TO_PAYROLL → PAYSLIPS_PUBLISHED → CLOSED`. A partir de `CLOSED_FOR_CALC` a
competência fica **travada**; reabrir exige `prize:competences:reopen` +
justificativa.

---

## 5. Ações manuais pendentes (segurança)

1. **Aplicar a migração no banco de produção (Neon)** — requer autorização
   explícita do responsável. Comando: `prisma migrate deploy` no ambiente alvo.
   O `.env` da API aponta para o Neon de produção; **não** foi aplicada
   automaticamente.
2. **Sincronizar o catálogo de módulos / permissões** no ambiente (o bootstrap de
   permissões e o sync do catálogo do portal são aditivos por `code`).

---

## 6. Segurança e LGPD

- Autorização **no backend** em todas as rotas (`@RequirePermissions`).
- Isolamento por empresa (`companyId`) em todas as consultas.
- Dados salariais e valores individuais sob permissão dedicada
  `prize:salary:view` (não concedida ao GESTOR por padrão).
- Segregação de função: aprovação de anexos/ajustes e reabertura de competência
  são permissões separadas da operação.
- Trilha de auditoria imutável (`PrizeAuditLog`) — sem update/delete por telas.

---

## 7. Backlog residual

### Parcialmente concluído / fundação pronta
- Dashboard com drill-down completo e gráficos (cards prontos; gráficos pendentes).
- Wizard de criação de anexo em 12 passos (CRUD/governança pronta; wizard pendente).
- Realizado: lançamento manual + grade prontos; **importação em massa (XLSX/CSV)**
  e UI de evidências pendentes (API de evidência já existe).
- Tendência e impacto financeiro no Previsto × Realizado (dependem de histórico e
  do Motor de Cálculo da Fase 4).
- Fase 4: motor + apuração + memória prontos; **telas de ajustes/exceções/
  transitoriedade** têm API completa, faltando a UI dedicada (inc. 2). Conferência
  formal (workflow de aprovação da apuração) pendente.

### Próximas fases (não iniciadas)
- **Fase 5 — Folha**: geração de lote (rubrica/verba), retorno e conciliação.
- **Fase 6 — Espelho do prêmio (PDF)**: demonstrativo individual com memória de
  cálculo, emissão em lote, publicação e ciência.
- **Fase 7 — Relatórios, Super Admin (seção Gestão de Prêmio), automações e IA
  assistiva**.

### Depende de credencial / regra externa
- Endpoints/credenciais reais do Apdata e da Folha (até lá: importação assistida
  por arquivo + mocks documentados).
- Percentuais e critérios específicos de moderadores/faixas (parametrizáveis —
  não fixados em código).
