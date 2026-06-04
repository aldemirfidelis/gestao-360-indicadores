# Fluxo: Indicador → Desvio → Tratativa → Ação → Eficácia

> FASE 2. Documenta o fluxo principal da plataforma ponta a ponta, a decisão
> **Desvio × Tratativa**, e as conexões que garantem que **nenhuma etapa é uma página
> isolada**. Atualizado em 2026-06-04.

---

## 1. Visão do fluxo (end-to-end)

```
Resultado lançado (results.upsert)
  → cálculo de farol (calcStatus)        [shared/status]
  → indicador fora da meta (light=RED)
     → cria TreatmentCase (orquestrador)  status AWAITING_CAUSE_ANALYSIS
     → traceability OFF_TARGET_ALERT
     → notification INDICATOR_OFF_TARGET  → link p/ detalhe do indicador
  → análise de causa
     → abre Deviation (registro canônico no UI) + DeviationCause + DeviationAnalysis
     → TreatmentCase: CAUSE_ANALYSIS_CREATED
  → reunião de tratativa (Meeting, kind=DEVIATION)
     → TreatmentCase: MEETING_SCHEDULED
  → plano de ação (ActionPlan, origin DEVIATION/MEETING)
     → TreatmentCase: ACTION_PLAN_CREATED
  → tarefas (ActionTask) + evidências (ActionEvidence)
     → ao concluir: updateTreatmentFromActions → ACTIONS_IN_PROGRESS / ACTIONS_OVERDUE
     → todas concluídas → AWAITING_REEVALUATION
  → avaliação de eficácia (validateEffectiveness)
     → EFFECTIVE / INEFFECTIVE / REOPENED
     → **propaga p/ TreatmentCase** (FASE 2): reabertura volta a ACTIONS_IN_PROGRESS
  → reavaliação (treatments.reevaluate) ou novo resultado GREEN
     → indicador recupera → TreatmentCase RESOLVED (auto no results.upsert GREEN)
  → rastreabilidade: TraceabilityEvent em cada passo (timeline por indicador)
```

Caminho preventivo: `ActionPlan` também nasce de `origin=PREVENTIVE`, `MEETING`,
`STRATEGY`, etc., não só de desvio.

---

## 2. Decisão: Desvio × Tratativa (arquitetura)

A plataforma tem **dois conceitos** no fluxo de fora-da-meta. A decisão (já refletida no
código e confirmada na FASE 2) é:

| Entidade | Papel | UI |
|---|---|---|
| **`TreatmentCase`** | **Orquestrador/rastreador de backend** do ciclo de fora-da-meta. Criado **automaticamente** quando um resultado fica RED. Mantém o **status macro** do tratamento (aguardando análise → análise → reunião → ação → reavaliação → resolvido) e alimenta os **alertas do dashboard**. | Sem página própria (`/treatments` e `/treatments/[id]` **redirecionam** — ver abaixo). |
| **`Deviation`** | **Registro canônico para o usuário** (FCA/análise de causa). Aberto pelo botão **"Abrir análise de causa"** no detalhe do indicador. É o que aparece em `/deviations` e `/deviations/[id]`. | `/deviations`, `/deviations/[id]`, detalhe do indicador. |

**Por que não há tela de tratativa separada:** evitar **experiência redundante** (a regra do
projeto). O usuário trabalha o fora-da-meta a partir do **detalhe do indicador** (abre o
desvio, vê ações/reuniões relacionadas e a timeline) e do **detalhe do desvio**. O
`TreatmentCase` roda "por baixo", conectando tudo e medindo o progresso — não precisa de
tela própria. Por isso `/treatments` e `/treatments/[id]` redirecionam para `/actions`.

> **Nota:** a API de `treatments` (`createAnalysis/scheduleMeeting/createAction/reevaluate`)
> permanece funcional e isolada por empresa+área (FASE 2). Ela é uma forma alternativa,
> "guiada", de dirigir o mesmo fluxo a partir de um `TreatmentCase` — útil para automações
> e para uma futura UI assistida, sem duplicar o registro de desvio.

---

## 3. Conexões (nenhuma página isolada)

| De | Para | Como |
|---|---|---|
| Resultado RED | Detalhe do indicador | Notificação `INDICATOR_OFF_TARGET` → `/indicators/{id}` (corrigido na FASE 2; antes ia p/ `/treatments/{id}` e perdia o contexto) |
| Detalhe do indicador | Desvio | Botão "Abrir análise de causa" → `POST /deviations` |
| Desvio (lista) | Indicador | Card do desvio → `/indicators/{indicatorId}` |
| Detalhe do indicador | Ações / Reuniões | Blocos "Planos de Ação Relacionados" e "Reuniões" → `/actions/{id}`, `/meetings/{id}` |
| Ação | Origem (trilha) | `buildOriginTrail`: Objetivo → Área → Indicador → Resultado → Desvio → Análise → Reunião |
| Ação (eficácia) | Tratativa | `validateEffectiveness` → `updateTreatmentFromActions` (FASE 2) |
| Qualquer etapa | Timeline | `TraceabilityEvent` por indicador (detalhe do indicador renderiza a linha do tempo, com link por `entityType`) |

---

## 4. Correções da FASE 2

1. **Eficácia repercute na tratativa** — `validateEffectiveness` passou a chamar
   `updateTreatmentFromActions`. Sem isso, validar/reabrir a eficácia deixava o
   `TreatmentCase` com status defasado (ex.: reabrir uma ação não voltava a tratativa para
   `ACTIONS_IN_PROGRESS`). +2 testes.
2. **Link da notificação de fora-da-meta** — apontava para `/treatments/{id}` (que
   redireciona para `/actions`, **perdendo o contexto**). Agora aponta para
   `/indicators/{indicatorId}`, onde o usuário efetivamente abre a análise de causa.
3. **Isolamento do hub do fluxo** — o módulo `treatments` (que cria desvios/reuniões/ações
   diretamente) ganhou **enforcement por empresa + área** (espelha `deviations`): leitura
   bloqueia área não permitida; escrita exige `assertCanWrite`. Fecha o resíduo de área que
   existia no orquestrador do fluxo. +5 testes.

---

## 5. Estado de cada etapa (FASE 2)

| Etapa | Backend | UI | Conectada? |
|---|---|---|---|
| Resultado / farol | `results.upsert` + `calcStatus` | detalhe do indicador | ✅ |
| Tratativa (orquestrador) | `treatments.*` + auto no `results.upsert` | sem tela (by design) | ✅ (alimenta dashboard/notificação) |
| Desvio / análise de causa | `deviations.*` | `/deviations`, `/deviations/[id]`, indicador | ✅ |
| Reunião | `meetings.*` | `/meetings`, `/meetings/[id]` | ✅ |
| Plano de ação / tarefas / evidências | `actions.*` | `/actions`, `/actions/[id]` | ✅ |
| Eficácia / encerramento / reabertura | `actions.validateEffectiveness` | `/aprovacoes-cargo?tab=eficacia` | ✅ (propaga p/ tratativa) |
| Rastreabilidade | `traceability.*` | timeline no detalhe do indicador | ✅ |

---

## 6. Pendências (fora do escopo da FASE 2, registradas)

- **Análise de causa estruturada** (5 Porquês, Ishikawa, MASP, PDCA, 5W2H): os modelos
  existem (`ActionFiveWhy`, `ActionIshikawaCause`, `ActionMaspStep`, `ActionPdcaStep`,
  `ActionFiveW2H`) e há `ActionAnalysisSession`. Restaurar/uniformizar a UI dessas
  ferramentas é trabalho da FASE 2/6 (seção 13 do escopo) — hoje a análise no desvio é texto
  livre + causas 6M.
- **Projeção `SUMMARY`** no detalhe do desvio/tratativa ainda sem tratamento visual dedicado.
- **Resumo de reunião / minuta de ata por IA**: FASE 5.
