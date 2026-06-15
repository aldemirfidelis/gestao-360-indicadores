# Modulo Cargos e Salarios

## Visao geral

O modulo Cargos e Salarios evolui a antiga pagina de Organograma para uma area de Gestao de Pessoas. A rota principal e `/cargos-salarios` e a rota legada `/organograma` redireciona para `/cargos-salarios/estrutura-quadro`.

O modulo reaproveita os dados existentes de `OrgJob` e `OrgEmployee` e cria uma camada corporativa persistida para catalogo de cargos, posicoes, descricoes versionadas, tabelas salariais, enquadramento, movimentacoes, orcamento, ciclos, pesquisas, simulacoes e auditoria.

## Rotas web

- `/cargos-salarios`: dashboard do modulo com filtros, cards e graficos.
- `/cargos-salarios/estrutura-quadro`: tela hierarquica preservada do antigo Organograma.
- `/cargos-salarios/catalogo`: catalogo de cargos.
- `/cargos-salarios/descricoes`: descricoes de cargos com versao e workflow.
- `/cargos-salarios/tabelas-salariais`: tabelas e faixas salariais.
- `/cargos-salarios/enquadramento`: analise de compa-ratio e situacao salarial.
- `/cargos-salarios/movimentacoes`: solicitacoes de movimentacao.
- `/cargos-salarios/relatorios`: relatorios disponiveis e auditoria recente.

## Endpoints

- `GET /api/cargos-salarios/options`
- `GET /api/cargos-salarios/overview`
- `GET /api/cargos-salarios/estrutura-quadro`
- `GET/POST/PATCH /api/cargos-salarios/jobs`
- `POST /api/cargos-salarios/jobs/:id/duplicate`
- `POST /api/cargos-salarios/jobs/:id/version`
- `PATCH /api/cargos-salarios/jobs/:id/inactivate`
- `PATCH /api/cargos-salarios/jobs/:id/reactivate`
- `GET/POST/PATCH /api/cargos-salarios/descriptions`
- `PATCH /api/cargos-salarios/descriptions/:id/status`
- `GET/POST/PATCH /api/cargos-salarios/salary-tables`
- `POST /api/cargos-salarios/salary-tables/:id/ranges`
- `POST /api/cargos-salarios/salary-tables/:id/publish`
- `POST /api/cargos-salarios/salary-tables/:id/revision`
- `GET /api/cargos-salarios/enquadramento`
- `GET/POST /api/cargos-salarios/movements`
- `PATCH /api/cargos-salarios/movements/:id/approve`
- `PATCH /api/cargos-salarios/movements/:id/reject`
- `PATCH /api/cargos-salarios/movements/:id/apply`
- `GET /api/cargos-salarios/reports`
- `GET /api/cargos-salarios/audit`

## Modelo de dados

Migration: `apps/api/prisma/migrations/20260613100000_compensation_module/migration.sql`

Novas entidades:

- `CompensationJobCatalog`: cargo estrutural reutilizavel.
- `CompensationJobCatalogVersion`: versoes do catalogo.
- `CompensationJobDescription`: descricao versionada e workflow.
- `CompensationSalaryTable`: tabela salarial com vigencia.
- `CompensationSalaryRange`: faixa salarial por tabela/cargo/faixa.
- `CompensationPosition`: posicao no quadro.
- `CompensationAllocationHistory`: historico de alocacao.
- `CompensationSalarySnapshot`: salario vigente/historico por colaborador.
- `CompensationMovementRequest`: solicitacao de movimentacao.
- `CompensationBudget`: orcamento de pessoal por periodo.
- `CompensationCycle`: ciclo de merito/promocao/reajuste.
- `CompensationSalarySurvey`: pesquisa salarial e benchmark.
- `CompensationSimulation`: simulacoes financeiras.

Todas as tabelas possuem `companyId` e indices de escopo para reduzir risco de acesso cruzado.

## Regras implementadas

- A rota antiga `/organograma` redireciona para `/cargos-salarios/estrutura-quadro`.
- A navegacao lateral passa a exibir `Gestao de Pessoas > Cargos e Salarios`.
- O antigo organograma foi preservado como aba Estrutura e Quadro.
- Ao abrir o modulo, cargos e colaboradores existentes sao migrados logicamente de forma idempotente para catalogo e posicoes.
- Cargo, posicao e colaborador passam a existir como conceitos separados.
- Catalogo de cargos permite criar, editar, duplicar, versionar, inativar e reativar.
- Inativacao de cargo exige justificativa e nao exclui registros vinculados.
- Descricoes de cargos possuem versao e workflow controlado.
- Tabelas salariais possuem vigencia, versao, publicacao e revisao sem sobrescrever historico.
- Enquadramento calcula `compa-ratio = salario atual / ponto medio da faixa`.
- Salario individual e valores de faixa sao mascarados quando o usuario nao possui `compensation:salary:individual`.
- Dashboard de massa salarial usa `compensation:salary:mass` ou `compensation:salary:individual`.
- Movimentacoes exigem tipo, motivo, justificativa e data de vigencia.
- Movimentacoes com impacto acima do orcamento disponivel sao bloqueadas.
- Aplicacao de movimentacao aprovada atualiza colaborador, posicao, historico e snapshot salarial.
- Visualizacao de salario nominal gera auditoria sensivel.
- Atualizacoes pela tela preservada registram historico de alocacao quando cargo ou area mudam.

## Permissoes

Principais permissoes criadas:

- `compensation:view`
- `compensation:manage`
- `compensation:structure:view`
- `compensation:jobs:create`
- `compensation:jobs:update`
- `compensation:jobs:approve`
- `compensation:descriptions:view`
- `compensation:descriptions:update`
- `compensation:descriptions:approve`
- `compensation:salary-table:view`
- `compensation:salary-table:update`
- `compensation:salary-table:approve`
- `compensation:salary-fit:view`
- `compensation:salary:individual`
- `compensation:salary:mass`
- `compensation:movements:view`
- `compensation:movements:request`
- `compensation:movements:approve`
- `compensation:movements:execute`
- `compensation:budget:view`
- `compensation:budget:update`
- `compensation:cycles:manage`
- `compensation:reports:view`
- `compensation:export`
- `compensation:audit:view`

Compatibilidade: rotas e acoes principais tambem aceitam permissoes antigas `org:positions:view` e `org:positions:manage` onde necessario para nao bloquear usuarios existentes.

## Administracao

1. Habilite o modulo `compensation` no Portal Admin Global quando houver controle de modulo por empresa.
2. Conceda `compensation:view` aos perfis que podem acessar o modulo.
3. Conceda `compensation:salary:individual` somente a usuarios autorizados a ver salario nominal.
4. Conceda `compensation:salary:mass` a usuarios autorizados a ver massas consolidadas.
5. Use o Catalogo de Cargos para criar cargos corporativos e manter versoes.
6. Use Tabelas Salariais para cadastrar faixas e publicar versoes vigentes.
7. Use Enquadramento para auditar colaboradores abaixo, dentro ou acima da faixa.
8. Use Movimentacoes para solicitar alteracoes com justificativa, vigencia e validacao de orcamento.
9. Consulte Relatorios e Auditoria para rastrear alteracoes e visualizacoes sensiveis.

## Importacao e integracoes

A arquitetura ja separa as entidades de cargo, posicao, faixa, salario e movimentacao. Importacoes futuras devem alimentar estas tabelas por CSV, Excel ou API, usando validacao previa e auditoria. O modulo nao implementa motor de folha de pagamento; ele prepara dados para integracao com folha/ERP.

## Testes executados

- `pnpm --filter @g360/api exec prisma generate`
- `pnpm --filter @g360/api exec tsc -p tsconfig.json --noEmit --pretty false`
- `pnpm --filter @g360/web exec tsc -p tsconfig.json --noEmit --pretty false`
- `pnpm --filter @g360/api exec vitest run src/modules/compensation/compensation.service.spec.ts`

## Arquivos principais alterados

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/20260613100000_compensation_module/migration.sql`
- `apps/api/src/modules/compensation/*`
- `apps/api/src/app.module.ts`
- `apps/api/src/modules/users/permission-catalog.ts`
- `apps/api/src/modules/portal-admin/portal-catalog.ts`
- `apps/api/src/modules/portal-admin/guards/portal-gate.guard.ts`
- `apps/api/src/modules/strategy/strategy.service.ts`
- `apps/web/middleware.ts`
- `apps/web/components/shell/navigation.ts`
- `apps/web/components/compensation/module-nav.tsx`
- `apps/web/app/(app)/cargos-salarios/*`
- `apps/web/app/(app)/organograma/page.tsx`

## Fase 1 - Overhaul de frontend (mercado)

Reformulacao das telas-nucleo para deixarem de ser "cadastro cru" e ganharem profundidade
de produto de mercado (Salary.com/CompAnalyst, Ravio, Payscale, beqom, CompUp). Sem migracao
de banco: as analises novas sao compostas no cliente a partir dos endpoints existentes.

Helpers e componentes compartilhados:

- `apps/web/lib/compensation/{types,format,analytics,print-description}.ts`: tipos, formatacao
  monetaria com mascaramento, funcoes puras (KPIs de enquadramento, distribuicao/penetracao de
  compa-ratio, equidade por area/cargo/faixa, posicionamento de mercado, estrutura salarial e
  matriz de merito) e impressao de descricao.
- `apps/web/components/compensation/{salary-structure-chart,compa-ratio-chart,job-detail-dialog,merit-matrix,description-editor-dialog}.tsx`.

Telas reformuladas:

- **Visao Geral**: KPI de compa-ratio medio + empty states.
- **Catalogo**: busca/filtros, dialog de detalhe (dados/versoes/descricoes/vinculos) com acoes
  (editar/duplicar/versionar/inativar/reativar) e matriz de arquitetura familia x grade.
- **Tabelas Salariais**: grafico de estrutura (min->medio->max), amplitude/progressao/sobreposicao,
  gerenciar faixas, publicar e gerar revisao.
- **Enquadramento**: KPIs, dispersao compa-ratio x penetracao, histogramas, equidade por dimensao,
  posicionamento de mercado (pesquisa x ponto medio interno) e export CSV.
- **Descricoes**: editor estruturado completo, edicao, workflow (transicoes), impressao.
- **Ciclos de Merito**: matriz desempenho x compa-ratio configuravel + simulador de impacto
  (persistida em `CompensationCycle.workflow.meritMatrix`).

Limitacoes honestas: equidade por genero/raca pendente (sem campo demografico em `OrgEmployee`);
a matriz de merito usa distribuicao de desempenho assumida (sem rating por colaborador na Fase 1).

## Fase 2 - Overhaul das telas operacionais

Mesmo tratamento aplicado as 7 telas restantes (sem migracao de banco; tudo via endpoints existentes):

- **Movimentacoes**: KPIs (pendentes/aprovadas/aplicadas/impacto), filtros por status e tipo, e o
  fluxo completo **aprovar/rejeitar/aplicar** visivel na propria lista (antes era so leitura),
  gated por `movements:approve` e `movements:execute`. Rejeicao pede motivo.
- **Aprovacoes**: caixa unificada com KPIs por tipo, rotulos PT, empty states, rejeicao com motivo
  e acoes gated por permissao.
- **Orcamento**: KPIs (headcount/folha/custo total) + **planejado x realizado** (via overview),
  grafico de folha por area, filtro por periodo.
- **Pesquisas**: formulario ganhou **percentis P25/P50/P75/P90** (alimentam o posicionamento de
  mercado no Enquadramento), filtro por cargo e empty states.
- **Simulacoes**: KPIs (cenarios/aprovados/pessoas/impacto anual), filtros e rotulos.
- **Configuracoes**: textos de ajuda por politica, gating por permissao.
- **Relatorios**: auditoria com filtro por entidade, rotulos PT de acao/entidade e **export CSV**.

Rotulos e tons compartilhados em `apps/web/lib/compensation/types.ts`
(`MOVEMENT_*`, `SIMULATION_STATUS_LABELS`, `SCENARIO_LABELS`, `movementStatusTone`).

## Fase 3 - Itens cross-module (sem migracao)

- **Edicao de ciclo**: novo `PATCH /cargos-salarios/cycles/:id` (`updateCycle`) + UI para editar/atualizar
  a matriz de um ciclo existente sem recriar (botoes "Atualizar ciclo" / "Salvar como novo").
- **Notificacoes**: `CompensationService` injeta `NotificationsService` (kind `MESSAGE`, best-effort).
  Avisa o gestor quando uma movimentacao entra na fila e o solicitante a cada decisao/aplicacao.
- **Aprovacao multi-alcada**: `createMovement` aceita `approvalSteps` (ex.: `['RH','GESTOR','DIRETORIA']`);
  `decideMovement` avanca a primeira etapa pendente e so marca `APPROVED` apos a ultima (status
  intermediario `IN_APPROVAL`); qualquer rejeicao encerra. UI: selecao de alcadas na solicitacao e
  cadeia de status em Movimentacoes/Aprovacoes. Coberto por testes em `compensation.service.spec.ts`.
- **Export DOCX**: `GET /cargos-salarios/descriptions/:id/docx` gera um `.docx` real via
  `documents/docx.util.ts` (`buildDocx`), retornado como base64; botao "Word" na tela de Descricoes.
- **Importacao assistida CSV**: wizard no Catalogo (`components/compensation/import-jobs-dialog.tsx`)
  com `papaparse`, preview/validacao linha a linha e criacao em lote via `POST /jobs` (sem migracao;
  o modulo `imports` nativo e dirigido por enum `ImportTargetKind`, que exigiria migracao).

## Fase 4 - Complementos do modulo (sem migracao)

- **Importacao XLSX**: o wizard do Catalogo agora aceita `.xlsx` (SheetJS/`xlsx` no web) alem de CSV,
  com a mesma previa/validacao linha a linha.
- **Notificar todos os aprovadores**: `createMovement` busca os usuarios aptos a aprovar
  (`findApproverUserIds`: permissao direta ou via perfil de acesso, ou papel SUPER_ADMIN/COMPANY_ADMIN)
  e notifica todos eles (alem do gestor informado), sempre best-effort.
- **Export para o GED (edicao online)**: `POST /cargos-salarios/descriptions/:id/document`
  (`exportDescriptionToGed`) cria um documento controlado no GED a partir da descricao, reutilizando
  `DocumentsService.create`; a edicao online (Collabora/WOPI) ocorre no proprio modulo de Documentos,
  pelo fluxo de liberacao existente. Botao "Enviar ao GED" na tela de Descricoes.
  Observacao: o Collabora edita o `.docx` no GED; as edicoes nao retornam aos campos estruturados
  da descricao (export controlado, nao edicao in-place).

## Riscos e proximos passos

- Equidade por genero/raca (requer campo demografico em `OrgEmployee` - migracao; nao autorizada).
- Integrar a matriz de merito com fonte real de avaliacao de desempenho (nao existe modulo dedicado).
- Importacao assistida tambem para faixas/colaboradores.
- Notificacao "por alcada" exata (mapear papel RH/GESTOR/DIRETORIA -> usuarios; hoje notifica todo o
  pool de aprovadores).
- Edicao in-place online da descricao estruturada (limitacao inerente ao WOPI sobre `.docx`).
- Expandir testes e2e.

