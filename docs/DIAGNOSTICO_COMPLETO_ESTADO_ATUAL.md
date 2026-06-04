# Diagnóstico Completo — Estado Atual da Plataforma Gestão 360

> **FASE 0 — Auditoria.** Documento de leitura. Nenhuma funcionalidade foi alterada
> para produzi-lo. Fonte da verdade: o repositório real em `d:/Projetos/gestao-indicadores-sqlite`.
> Gerado em **2026-06-04**. Branch `main` (working tree limpo no início da auditoria).

> **Atualização 2026-06-04 — FASE 1 CONCLUÍDA (consolidação de segurança multiempresa+área).**
> Enforcement por área (`AccessService`) + reforço de isolamento por empresa aplicados, com
> correção de vazamentos cross-company reais (vários services resolviam registros por `id`
> sem escopo de empresa). Testes API: **54 → 111** (+57 de isolamento).
>
> | Módulo | O que foi feito | Testes |
> |---|---|---|
> | **deviations** | área via indicador; isolamento em getById/update/causes/analyses/createAction/close; `SUMMARY` | +9 |
> | **meetings** | área via indicador/desvio; isolamento em todos os mutators; validação de vínculo no create; sendInvites não cruza empresa | +10 |
> | **results** | corrige cross-company no `upsert`/`approve`; área via indicador; `upsertSystem` p/ integrações (empresa só) | +7 |
> | **okrs** | isolamento por empresa (via ciclo) em todos os métodos; sem área (OKR não tem área) | +6 |
> | **projects** | área via indicador; isolamento em projeto/marco/tarefa; validação de vínculo | +9 |
> | **reports** | anti-vazamento: exportações CSV filtram por área (`export`) | +6 |
> | **search** | busca global filtra por área por domínio (indicadores/ações/desvios/reuniões/org) | +3 |
> | **dashboard** | agregados (overview/ranking/worst/evolution/pending) por área | +5 |
> | **insights** | regras + **contexto de IA** filtrados por área (IA não vaza dados) | +2 |
> | **strategy** | **verificado**: já isolado por empresa (getMapRecord/getObjectiveRecord etc.); mapa é company-wide por design | — |
> | **orgnodes** | **verificado**: já isolado por empresa; writes admin-only; impacto checado no delete | — |
>
> Também: menu reorganizado (revela Desvios, Comunicação, Pessoas, Perfil, Integrações,
> Ajuda, Importações, Plataforma) e pastas órfãs vazias removidas. **Commit local único da
> FASE 1.** Sem push/deploy.

---

## 1. Sumário executivo

Após as fases executadas, a plataforma está **madura e operacional no código**. O schema é
válido, a API e o frontend passam no typecheck, os testes unitários da API cobrem o núcleo
de segurança/fluxo/módulos corporativos e há smoke E2E com Playwright. O sistema já cobre
o ciclo estratégia -> indicador -> desvio -> ação -> eficácia, além de PMO, reuniões,
comunicação, integrações externas, Portal Admin, Database Admin e os módulos corporativos
da FASE 6.

As lacunas atuais são de **ambiente e validação final**, não de ausência de implementação:

1. **Migrations pendentes no Neon** — Auditorias, Processos/SIPOC e Formulários/Checklists
   estão no schema e no código, mas dependem de autorização para `prisma migrate deploy`.
2. **E2E operacional completo** — a infraestrutura Playwright existe; os fluxos de negócio
   completos devem rodar em banco de teste já migrado.
3. **Build completo** — foi tentado no ambiente local, mas excedeu 5 minutos; repetir antes
   de deploy em ambiente com tempo/recursos suficientes.

> **Conclusão do gate da FASE 7:** não há FASE 8 no plano mestre usado nesta execução.
> O que resta é operacional: autorizar/aplicar migrations, expandir E2E em banco isolado e
> repetir build completo antes de publicar.

---

## 2. Resultado das verificações (gate técnico)

| Verificação | Comando | Resultado |
|---|---|---|
| Git working tree | `git status` | ✅ Limpo no início da auditoria |
| Schema Prisma | `prisma validate` | ✅ Válido |
| Migrations | `prisma migrate status` | ⚠️ 34 migrations no repo; 3 pendentes no Neon |
| Typecheck API | `tsc --noEmit` (api) | ✅ Sem erros (exit 0) |
| Typecheck Web | `tsc --noEmit` (web) | ✅ Sem erros (exit 0) |
| Testes API | `vitest run` (api) | ✅ **184 testes** / 26 arquivos |
| Testes Shared | `vitest run` (shared) | ✅ **13 testes** / 2 arquivos |
| E2E smoke | `pnpm test:e2e -- --reporter=list` | ✅ 4 testes Playwright |
| Build completo | `pnpm build` | ⚠️ Tentado; excedeu 5 minutos no ambiente local |

**Dívida de dependências:** Prisma **5.22.0** com major **7.8.0** disponível. Upgrade é
mudança maior (ver `pris.ly/d/major-version-upgrade`) — tratar como item planejado, não
às cegas. Consistente com a auditoria de segurança anterior.

**Cobertura de testes:** automação cobre lógica pura, isolamento multiempresa/área em
serviços críticos, relatórios/busca filtrados, módulos FASE 6 e shared. A lacuna restante
é E2E operacional ponta a ponta em banco isolado já migrado.

---

## 3. Arquitetura confirmada (fonte da verdade)

**Monorepo pnpm** (`pnpm-workspace.yaml` → `apps/*`, `packages/*`):

```
apps/api    NestJS 10 + Prisma 5 + PostgreSQL (Neon) + Passport/JWT + Socket.IO
apps/web    Next.js 15 (App Router) + React 18 + TanStack Query + Radix + Tailwind
packages/shared   tipos e utilitários compartilhados (status, traceability)
```

- **Todos os módulos de API vivem em `apps/api/src/modules/*`** e são registrados em
  [app.module.ts](apps/api/src/app.module.ts). Há 34 módulos importados.
- **Frontend** usa App Router sob `apps/web/app/(app)/*`, com `login` e `page.tsx` raiz fora do grupo.
- **Navegação** centralizada em [navigation.ts](apps/web/components/shell/navigation.ts)
  (seções, `ROUTE_PERMISSIONS` para bloqueio por URL e `canAccess`).

### 3.1. Modelo de segurança — estado real

| Camada | Onde | Estado |
|---|---|---|
| Autenticação | `JwtAuthGuard` global (`APP_GUARD`) | ✅ Toda rota exige JWT (salvo `@Public`) |
| Revalidação de sessão | [jwt.strategy.ts](apps/api/src/modules/auth/jwt.strategy.ts) | ✅ Reconsulta usuário+empresa **a cada request**; bloqueia usuário/empresa inativa na hora |
| Empresa efetiva | [effective-company.ts](apps/api/src/common/effective-company.ts) | ✅ Fonte única; só SUPER_ADMIN impersona via `activeCompanyId` |
| Papéis e permissões | `RolesGuard` global + `@Roles`/`@RequirePermissions` | ✅ OR semantics + curinga `modulo:manage` + bypass SUPER_ADMIN |
| Isolamento por **empresa** | `companyId` derivado de `req.user` em 72 arquivos | ✅ Amplo (services nunca confiam no body) |
| Visibilidade por **área** | [access.service.ts](apps/api/src/modules/access/access.service.ts) | ✅ Motor completo; aplicado em indicators, actions, **+ deviations, meetings, results, projects, reports, search, dashboard, insights** (FASE 1). strategy/orgnodes company-wide por design |
| Auditoria | `AuditInterceptor` global + `auditDenied` no AccessService | ✅ Ativo |

O `AccessService` já oferece tudo que as FASES 1/2 precisam: `permittedAreaIds`,
`listAreaFilter` (com **expansão para descendentes**), `canWriteArea`/`assertCanWrite`,
`visibilityLevel` (projeção resumida `SUMMARY`/`FULL`), `assertSameCompany` (defesa em
profundidade) e `auditDenied`. **A lacuna é de adoção, não de capacidade.**

---

## 4. Matriz de diagnóstico por módulo

Legenda de status:
**FUNCIONAL** · **PARCIAL** · **NÃO INTEGRADO** · **OCULTO** (existe, fora do menu) ·
**COM FALHAS** · **AUSENTE** · **NÃO RECRIAR** (maduro; só auditar/evoluir).

Coluna **Área?** = aplica enforcement de visibilidade por área via AccessService.
(✓ aplica · ✗ não aplica · n/a não se aplica).

| Módulo | Backend | Frontend | Empresa | Área? | Status | Próxima ação |
|---|---|---|---|---|---|---|
| **auth** | ✅ login/refresh/logout/me | login | ✅ | n/a | NÃO RECRIAR | manter |
| **companies / platform** | ✅ | `/plataforma`, `/selecionar-empresa`, `/settings/empresas` | ✅ | ✓ (platform) | FUNCIONAL | auditar métricas |
| **users / access / admin** | ✅ CRUD, perfis, matriz | `/users`, `/settings/visibilidade` | ✅ | ✓ (access-admin) | FUNCIONAL | testar exceções temporárias |
| **orgnodes** | ✅ árvore | `/org` | ✅ | n/a | FUNCIONAL (verificado) | já isolado; writes admin-only; impacto no delete ok |
| **indicators** | ✅ | `/indicators(+new,[id])` | ✅ | **✓** | FUNCIONAL (referência) | evoluir cards/drill-down |
| **results** | ✅ | (em `/indicators`) | ✅ | **✓** | FUNCIONAL (FASE 1 ok) | UI de aprovação; histórico visual |
| **closed-months / periods** | ✅ | `/periods` | ✅ | ✗ | FUNCIONAL | revisar guard de escrita |
| **deviations** | ✅ (+causas, análises) | `/deviations(+[id])` | ✅ | **✓** | FUNCIONAL (FASE 1 ok) | evoluir UI (SLA, gravidade, recorrência) |
| **treatments** | ✅ | `/treatments`→redirect `/actions`; `[id]` existe | ✅ | ✗ | DECIDIDO (incorporado) | documentar decisão; manter `[id]` |
| **actions** | ✅ planos, tarefas, evidências, 5W2H, eficácia, IA | `/actions(+[id])`, `/aprovacoes-cargo` | ✅ | **✓** | FUNCIONAL | Kanban/Gantt/curva S |
| **meetings** | ✅ atas, ICS, e-mail | `/meetings(+[id])` | ✅ | **✓** | FUNCIONAL (FASE 1 ok) | minuta/ata, resumo IA |
| **okrs** | ✅ ciclos, KRs, check-ins, pai/filho | `/okrs` | ✅ | n/a | FUNCIONAL (FASE 1 ok) | vincular a mapa/indicador (OKR não tem área) |
| **strategy** | ✅ mapa, perspectivas, objetivos, versões | `/strategy(+[id])` | ✅ | n/a | FUNCIONAL (verificado) | hover rico; drill-down (mapa é company-wide) |
| **projects** | ✅ marcos, tarefas | `/projects(+[id])` | ✅ | **✓** | FUNCIONAL (FASE 1 ok) | evoluir p/ PMO (Gantt, curva S) |
| **dashboard / insights** | ✅ | `/dashboard`, `/visualization`, `/insights` | ✅ | **✓** | FUNCIONAL (FASE 1 ok) | cards clicáveis/drill-down (FASE 3) |
| **reports** | ✅ CSVs | `/reports` | ✅ | **✓** | FUNCIONAL (FASE 1 ok) | PDF/Excel; agendamento (FASE 3) |
| **imports** | ✅ | `/imports` | ✅ | ✗ | **OCULTO** | incluir no menu (Lançamentos) |
| **audit / traceability** | ✅ logs, timeline | `/audit` | ✅ | n/a | FUNCIONAL | padronizar SUCCESS/DENIED/ERROR |
| **search** | ✅ | (global) | ✅ | **✓** | FUNCIONAL (FASE 1 ok) | — |
| **communication** | ✅ DM, presença, anexos, WS | `/comunicacao`, `/pessoas`, `/perfil(+[id])` | ✅ | n/a | **OCULTO** | criar seção "Comunicação" no menu |
| **help** | ✅ categorias, artigos, feedback | `/ajuda` | ✅ | n/a | **OCULTO** | incluir no menu |
| **integrations** | ✅ SMTP/ICS/IA/conectores cifrados | `/integracoes`, `/settings/integracoes` | ✅ | n/a | **OCULTO** (pública) | incluir no menu |
| **external-api** | ✅ `/external/v1` por chave (inbound) | n/a | ✅ | ✓ (key-scoped) | FUNCIONAL | doc em INTEGRACOES_API_EXTERNAS |
| **ai** | ✅ Gemini, contexto indicador | (em actions) | ✅ | n/a | PARCIAL | expandir 5 Porquês/Ishikawa/resumos |
| **notifications** | ✅ | sino | ✅ | n/a | FUNCIONAL | alertas de fluxo |
| **portal-admin** | ✅ módulos/páginas/flags/snapshots | `/settings/portal` | ✅ | n/a | NÃO RECRIAR | auditar enforcement de flags |
| **database-admin** | ✅ schema/tables/query/backup | `/settings/database/*` | ✅ | n/a | NÃO RECRIAR | confirmar guards SUPER_ADMIN |
| **organograma (org jobs)** | ✅ cargos, aprovações | `/organograma`, `/aprovacoes-cargo` | ✅ | ✗ | FUNCIONAL | área |
| **relationship-map** | ❌ pasta vazia | (mapa vive em strategy) | — | — | ÓRFÃO | remover pasta vazia |

### Módulos corporativos novos (FASE 6) — **ENTREGUES NO CÓDIGO**
Riscos/Oportunidades · Processos/SIPOC · Gestão Documental · Auditorias & Compliance ·
Não Conformidades · Formulários/Checklists. Os modelos existem no schema, as rotas web/API
foram documentadas e há testes unitários dos serviços. No Neon, Riscos, Não Conformidades
e Documentos já têm migrations aplicadas; Auditorias, Processos/SIPOC e Formulários/Checklists
aguardam autorização para migration.

---

## 5. Páginas × Menu (ocultos, redirects e órfãos)

**Redirects intencionais (decisões de arquitetura já tomadas — não são stubs quebrados):**
- `/treatments` → `/actions` (tratativa **incorporada** ao plano de ação)
- `/eficacia` → `/aprovacoes-cargo?tab=eficacia`
- `/perfil` → `/perfil/[id]` (próprio usuário)

**Páginas reais FORA do menu lateral** (`navSections` em navigation.ts) — categoria OCULTO:
`/deviations`, `/imports`, `/comunicacao`, `/pessoas`, `/perfil`, `/integracoes`, `/ajuda`.
(Têm entrada em `ROUTE_PERMISSIONS`, logo o acesso por URL funciona, mas não há item de menu.)

**Diretórios órfãos vazios** (resíduo de refactor, podem ser removidos):
- `apps/api/src/{actions,admin,ai,auth,dashboard,imports,indicators,meetings,okrs,organization,projects,reports,strategy}` (vazios — o código real está em `src/modules/*`)
- `apps/api/src/modules/relationship-map` (vazio)
- `apps/web/app/(app)/cronograma` (sem `page.tsx`)

**Decisão de navegação pendente:** o prompt (seção 28) propõe seções "Comunicação" e
"Lançamentos" e reorganização em acordeons. A `navigation.ts` atual tem só 3 seções
(Visualizações, Gestão, Relatórios) + Configurações. Alinhar com a estrutura desejada,
mostrando **apenas módulos ativos e autorizados**.

---

## 6. Lacunas e dívidas priorizadas

| # | Lacuna | Severidade | Fase alvo | Status |
|---|---|---|---|---|
| 1 | AccessService aplicado só em indicators/actions | **Alta** (vazamento entre áreas) | FASE 1 | ✅ resolvido |
| 2 | Testes de isolamento empresa/área | **Alta** | FASE 1/7 | ✅ +57 testes unitários (E2E na FASE 7) |
| 3 | Páginas ocultas no menu (deviations, comunicação, ajuda, etc.) | Média (UX/descoberta) | FASE 1 | ✅ resolvido |
| 4 | Reports/Search/IA sem garantia anti-vazamento por área | Média | FASE 1/2 | ✅ resolvido |
| 5 | Diretórios órfãos vazios | Baixa (higiene) | FASE 0/1 | ✅ resolvido |
| 6 | Prisma 5→7 pendente | Média (manutenção) | planejado |
| 7 | Fluxo indicador→eficácia: validar conexões ponta a ponta | Média | FASE 2 | ✅ resolvido no código |
| 8 | Dashboard/cards não clicáveis (drill-down) | Média (UX) | FASE 3 | ✅ resolvido no escopo da fase |
| 9 | Módulos corporativos novos ausentes | — (planejado) | FASE 6 | ✅ resolvido no código; 3 migrations pendentes no Neon |

---

## 7. Riscos e restrições operacionais

- **Banco de produção é o Neon** (não há banco local nesta auditoria). Migrations já
  aplicadas. Qualquer nova migration deve ser revisada e **nunca** aplicada sem autorização.
- **Sem push/deploy automático** — conforme instrução. Deploy é manual via `make deploy`/SSH.
- **Segredos** ficam em `.env`/conectores cifrados; nunca expor no frontend.
- **Anexos/binários no banco** (comunicação, evidências) — gargalo futuro; storage externo
  é evolução planejada, não bloqueante.

---

## 8. Plano de execução recomendado (alinhado às fases do prompt)

> Regra: ao fim de cada fase → testes + typecheck + build + migrations + doc + **commit local
> isolado** + relatório. **Sem push/deploy sem autorização.**

- **FASE 0:** auditoria + diagnóstico. _Concluída._
- **FASE 1 — Segurança/consolidação:** `AccessService`, isolamento multiempresa/área,
  menu e testes. _Concluída._
- **FASE 2 — Fluxo principal:** indicador -> desvio -> análise -> reunião -> plano ->
  tarefa -> eficácia -> rastreabilidade. _Concluída._
- **FASE 3 — Estratégia/visão:** mapa executivo, drill-down, OKR integrado e visão
  executiva. _Concluída._
- **FASE 4 — PMO:** portfólio, filtros executivos e painel PMO. _Concluída._
- **FASE 5 — Comunicação/Ajuda/Integrações/IA/Performance/Mobile:** escopo executado nas
  entregas de comunicação, integrações e IA de reuniões. _Concluída no escopo aplicado._
- **FASE 6 — Novos módulos:** Riscos, Não Conformidades, Documentos, Auditorias,
  Processos/SIPOC e Formulários/Checklists. _Concluída no código; 3 migrations pendentes
  no Neon._
- **FASE 7 — E2E, documentação completa, checklist de produção:** Playwright smoke,
  rotas/APIs, guia de testes, checklist, DER, segurança e gates. _Concluída no escopo
  possível sem migrar Neon._

---

### Anexo A — Inventário de migrations (34)
`init` · `traceability_relationship_map` · `off_target_treatment_flow` ·
`backfill_current_red_treatments` · `admin_settings_parameters` ·
`strategic_map_workspace` · `action_plan_management_suite` · `work_periods` ·
`indicator_guideline_node` · `closed_months` · `strategic_objective_size` ·
`perspective_size` · `perspective_position` · `career_approval_requests` ·
`legacy_external_id_mapping` · `okr_parent_child` · `indicator_result_notes` ·
`action_origin_preventive` · `database_admin` · `portal_admin` ·
`action_task_completion_general_approvals` · `action_task_evidence` ·
`communication_directory` · `message_attachments_help_integrations` ·
`company_status_fields` · `area_visibility` · `user_active_company` ·
`external_integrations` · `risk_register` · `non_conformity` · `document_register` ·
`audit_compliance` · `process_sipoc` · `forms_checklists`.

### Anexo B — Documentação existente em `docs/`
`ARQUITETURA_MULTIEMPRESA_E_PERMISSOES.md` · `INTEGRACOES_API_EXTERNAS.md` ·
`SECURITY-AUDIT.md` · `arquitetura-gestao-360.md` · `configuracoes-administracao.md` ·
`database-admin.md` · `documentacao-completa-projeto.md` ·
`fluxo-tratativa-indicador-fora-meta.md` · `fluxograma-completo.{md,html}` ·
`FASE6_MODULOS_CORPORATIVOS.md` · `ROTAS_E_APIS.md` · `GUIA_DE_TESTES.md` ·
`CHECKLIST_PRODUCAO.md` · `DER_BANCO_DADOS.md` · `SEGURANCA.md` ·
`GATES_FASES_IMPLEMENTADAS.md` ·
`mapa-estrategico-integrado.md` · `mapa-estrategico-v2.md` ·
`navegacao-menu-accordion.md` · `plano-acao-avancado.md` · `portal-admin.md` ·
`status-evolucao-gestao-360.md`.
