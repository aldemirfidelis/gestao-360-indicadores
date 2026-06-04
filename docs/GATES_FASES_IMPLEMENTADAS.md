# Gates das fases implementadas

Conferência das fases do plano mestre. O plano vai da FASE 0 à FASE 7; não há FASE 8 registrada no plano mestre usado nesta execução.

## Matriz de fases

| Fase | Escopo | Status | Evidência principal |
| --- | --- | --- | --- |
| FASE 0 | Auditoria e diagnóstico inicial | Concluída | `docs/DIAGNOSTICO_COMPLETO_ESTADO_ATUAL.md` |
| FASE 1 | Segurança multiempresa/área, menu e consolidação | Concluída | Commit `7b70b25` |
| FASE 2 | Fluxo indicador -> desvio -> tratativa -> ação -> eficácia | Concluída | Commit `fe12323` |
| FASE 3 | Estratégia, mapa executivo e drill-down | Concluída | Commits `97e6e1a`, `4e82ecb` |
| FASE 4 | PMO e portfólio de projetos | Concluída | Commit `591529b` |
| FASE 5 | Reuniões/IA, comunicação, integrações e experiência | Concluída no escopo executado | Commits `f56b356` e predecessores de comunicação/integrações |
| FASE 6 | Módulos corporativos: riscos, NCs, documentos, auditorias, processos e formulários | Concluída no código | Commits `9ebefb3`, `8d5b367`, `cb25b4e`, `3ced176`, `08ae5c7`, `e86ac5c` |
| FASE 7 | Documentação final, checklist de produção e E2E smoke | Concluída no escopo possível sem migrar Neon | Commits `99a128e`, `3e38363`, `c1481fe` e esta consolidação |

## Validações registradas

| Gate | Resultado |
| --- | --- |
| `pnpm --filter @g360/api exec prisma validate` | Verde na FASE 7 |
| `pnpm --filter @g360/api exec tsc --noEmit --pretty false` | Verde |
| `pnpm --filter @g360/web exec tsc --noEmit` | Verde |
| `pnpm --filter @g360/api test` | 184 testes passando |
| `pnpm test:e2e -- --reporter=list` | 4 smoke tests passando |
| `pnpm --filter @g360/api exec prisma migrate status` | 34 migrations no repo; 3 pendentes no Neon |
| `pnpm build` | Tentado; excedeu 5 minutos no ambiente local e foi interrompido |

## Pendências reais

- Aplicar no Neon as migrations `audit_compliance`, `process_sipoc` e `forms_checklists` somente após autorização.
- Expandir E2E para fluxos operacionais completos em banco de teste já migrado.
- Reexecutar `pnpm build` em ambiente com tempo/recursos suficientes antes do deploy.
- Fazer deploy/push apenas quando autorizado.

## Não são fases novas do plano mestre

As memórias locais também citam roadmaps paralelos de UI/OKR, Portal Admin e Database Admin. Eles podem ter fases próprias, mas não ampliam o plano mestre FASE 0-7 desta consolidação. Pontos como E2E Docker do Database Admin e validações visuais de UI seguem como backlog paralelo, não como FASE 8.
