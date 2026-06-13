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

## Riscos e proximos passos

- Completar fluxos visuais de aprovacao em multiplas alcadas.
- Adicionar importacao assistida com validacao linha a linha.
- Criar paginas dedicadas para ciclos, orcamento, pesquisas salariais, simulacoes, aprovacao e configuracoes.
- Expandir testes e2e para o redirect `/organograma` e responsividade das novas telas.
- Integrar notificacoes do modulo com Meu Dia e Central de Impactos.

