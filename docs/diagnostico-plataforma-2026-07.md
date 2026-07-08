# Diagnóstico Técnico Completo — Plataforma Gestão 360

**Data:** 2026-07-07 · **Base:** main @ `3465a52` (sincronizado com origin/main)
**Método:** varredura estrutural fresca (código, schema, git) + reconciliação com 4 auditorias anteriores registradas (segurança/IDOR 2026-06, código morto + DRY 2026-06, performance 2026-07, anti-mock 2026-07).

---

## 1. Fotografia do projeto

| Dimensão | Valor |
|---|---|
| Módulos backend (NestJS) | 53 em `apps/api/src/modules/` |
| Rotas frontend (Next.js App Router) | ~66 rotas em `app/(app)/` + site público |
| Schema Prisma | **392 models**, 167 enums, 1.009 `@@index`, 11.835 linhas |
| Consultas `findMany` | 393 em 60 arquivos |
| Uso de React Query | 1.129 usos em 170 arquivos (bem adotado) |
| UI kit (`components/ui/`) | apenas 15 primitivas |

## 2. O que JÁ está saudável (não mexer)

- **Zero mocks no backend** — varredura fresca confirma a auditoria 2026-07: nenhum `Math.random`/mock/fake em `apps/api/src`.
- **React Query** amplamente adotado; **sonner** (toasts), **react-hook-form + zod**, **radix** já no stack.
- **Multiempresa**: auditoria IDOR/permissões 2026-06-21 limpa nos módulos prioritários; padrão manual *scoped-read-before-mutate*.
- **Meu Dia backend robusto**: 14 coletores (ações, tarefas de ação/projeto/workflow, aprovações, reuniões do dia, documentos, auditorias, achados, formulários, riscos, NCs, **indicadores fora da meta**, notificações) + priorização + event bus + visão de equipe.
- **Tarefas**: 5 visões prontas (Kanban, Lista, Calendário, Timeline, Wiki) em `components/tasks/tasks-workspace.tsx`.
- **Qualidade**: matriz de riscos 5×5 + residual; **checklist reprovado → NC automática já em produção** (`4394caa`).
- **Comunicação**: enquetes e confirmação de leitura REAIS no backend (`organizational-communication.service.ts`).
- **Performance**: fixes N+1 (Meu Dia thundering herd + count de conversas) **já mergeados em main** (branch `perf/n1-hotpaths` integrada).
- **Fluxo Indicador→Desvio→Reunião**: commits do redesign **já em main** (`a8c777a`, `5eee8ce`, `4e0e3be`).
- **Validação parcial**: `ac16ee2` já adicionou Zod + teto de listagem em controllers de escrita prioritários.
- Observabilidade pino estruturado em produção; logger com request-id e redação de sensíveis.

## 3. Problemas confirmados

### CRÍTICO
| # | Problema | Evidência |
|---|---|---|
| C1 | **Páginas monolíticas gigantes** — manutenção arriscada, regressões, build já sofreu OOM | `comunicacao/page.tsx` 115 KB, `strategy/[id]` 113 KB, `documents` 111 KB, `indicators` 90 KB, `forms` 85 KB, `seguranca-alimentos` 85 KB, `meu-dia` 74 KB, `monthly-results/[id]` 66 KB, `audits` 65 KB, `platform-admin-app.tsx` 134 KB |
| C2 | **Cobertura de validação Zod incompleta** — 22 de 53 módulos têm validação; o resto aceita body cru | grep `zod|ValidationPipe` |
| C3 | **Rotação de segredos pendente** (P0 da auditoria de segurança; exige ação manual do Aldemir — fora do escopo de código) | memória `audit_2026_07_fixes` |

### ALTO
| # | Problema | Evidência |
|---|---|---|
| A1 | **UI kit mínimo → inconsistência visual entre módulos.** Sem `DataTable` (— `@tanstack/react-table` instalado e **nunca usado**), sem `EmptyState` compartilhado (7+ bolsões duplicados), sem `Drawer/SidePanel`, `Skeleton`, `PageHeader`, `FilterBar`, `ConfirmDialog` padronizados | `components/ui/` = 15 arquivos básicos |
| A2 | **Farol/status não unificado** (Épico 2 da auditoria DRY, pendente) — lógica de cor/status espalhada em ≥12 arquivos | grep `farol\|statusColor` |
| A3 | **`writeAudit` duplicado em 13 serviços** (B1 pendente) — rastreabilidade inconsistente; módulos novos esquecem auditoria | grep `writeAudit` |
| A4 | **Paginação incompleta** — 393 `findMany` vs `take:` presente em só 53 arquivos; listagens sem teto restantes | greps comparados |
| A5 | **Multiempresa sem guard-rail sistêmico** — o padrão manual depende de disciplina em cada endpoint novo; não há helper/extension que injete `companyId` | arquitetura conhecida |

### MÉDIO
| # | Problema |
|---|---|
| M1 | Meu Dia **não agrega comunicados não lidos** nem **ocorrências patrimoniais abertas** (integrações pedidas e coerentes com o produto) |
| M2 | Ocorrência patrimonial → tarefa/plano: existe só o vínculo `actionPlanId`; **sem geração automática nem CTA** |
| M3 | Indicador fora da meta aparece no Meu Dia, mas o card **não oferece ação direta** "criar análise de causa/plano" |
| M4 | `AnalysisCanvas` duplicado (B5 da auditoria DRY, pendente) |
| M5 | Testes esparsos (poucos `.spec.ts`); E2E bloqueado local (máquina sem Docker — constraint conhecida) |
| M6 | Prêmio: importador BaseAnexos e UI hierárquica de competência pendentes |

### BAIXO
- `tabs-bar.tsx` sem uso; imports mortos restantes (sobras do Épico DRY).
- Barra inferior mobile não aplica overlay do Portal Admin (`mobileNavItems`).

## 4. Pedidos que são FEATURES NOVAS (não gaps de implementação)

1. **Gestão de Prêmio — campanhas/ranking/pontuação**: o módulo atual é orientado a *programas + regras em matriz + apuração* (domínio calibrado pelas planilhas reais da usina). "Campanha com ranking" é um conceito novo que exigiria modelagem própria — recomendo tratar como feature separada, não como refatoração.
2. **Comunicação — banners/vídeos**: enquetes e confirmação de leitura já existem; banners/vídeo exigiriam campos/telas novos.

## 5. Plano de melhoria priorizado

### Fase 1 — Fundação de padronização (CRÍTICO/ALTO; sem risco funcional)
1.1 UI kit compartilhado em `components/ui/`: `DataTable` (tanstack: busca, ordenação, filtros, ações), `EmptyState`, `Skeleton`, `PageHeader`, `FilterBar`, `SidePanel` (drawer de detalhes), `ConfirmDialog`, `StatFarol` (farol unificado).
1.2 Unificar a lógica de farol (Épico 2) em módulo único consumido por todos.
1.3 `AuditWriterService` central no backend (B1); migrar os 13 serviços.

### Fase 2 — Hardening backend
2.1 Completar Zod nos módulos de escrita restantes (31 módulos).
2.2 Teto de paginação nas listagens `findMany` restantes.
2.3 Helper de escopo multiempresa (`scopedWhere(me)`) e adoção nos serviços.

### Fase 3 — Integrações entre módulos
3.1 Meu Dia: coletor de comunicados não lidos + ocorrências patrimoniais.
3.2 Ocorrência patrimonial → gerar tarefa/plano (automático ou 1 clique).
3.3 Card de indicador fora da meta → CTA "analisar causa" (liga com desvio/ferramentas).

### Fase 4 — Decomposição das páginas monolíticas (módulo a módulo, adotando o kit)
Ordem sugerida (tamanho × tráfego): `comunicacao` → `documents` → `indicators` → `forms` → `seguranca-alimentos` → `meu-dia` → `monthly-results` → `audits` → `strategy/[id]`.

### Fase 5 — Polimento: responsividade, estados vazios/loading com o kit, mensagens padronizadas.

**Regras de execução:** sem remoção de funcionalidades; sem quebra de rotas/permissões; preservar multiempresa; commits pequenos por fase; sem push/deploy sem autorização (política do projeto).
