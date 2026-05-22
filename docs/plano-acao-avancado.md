# Modulo avancado de Plano de Acao

Esta documentacao descreve a evolucao do modulo de Plano de Acao do Gestao 360 para uma ferramenta de gestao, analise, execucao, evidencias, eficacia e rastreabilidade.

## Objetivo

Cada plano de acao deve mostrar claramente por que foi criado, qual indicador ou problema o gerou, qual ferramenta de analise foi usada, quem e responsavel, qual o prazo, quais evidencias existem e se a acao foi eficaz.

O fluxo suportado e:

```text
Diretriz / Objetivo estrategico
> Area / Setor / Processo
> Indicador
> Resultado fora da meta
> Desvio ou nao conformidade
> Analise de causa
> Ferramenta utilizada
> Reuniao
> Plano de acao
> Execucao
> Evidencias
> Verificacao de eficacia
> Historico e auditoria
```

## Tela principal

A rota `/actions` possui:

- Cards de resumo para total, abertos, atrasados, concluidos fora do prazo, sem responsavel, criticos e eficacia pendente.
- Filtros por busca, status, indicador e eficacia.
- Visao Kanban por status.
- Lista tabular com origem, responsavel, prazo, ferramenta, eficacia e progresso.
- Cronograma por prazo.
- Modal de novo plano com origem, objetivo estrategico, area/setor, indicador, resultado, desvio, reuniao, ferramenta, responsavel, prioridade, criticidade, problema, acao e criterio de eficacia.

## Detalhe do plano

A rota `/actions/:id` possui abas:

- **Visao geral**: problema, causa raiz, acao proposta, resultado esperado, responsavel e prontidao.
- **Origem**: trilha completa ate o plano de acao.
- **Analise de causa**: ferramentas 5 Porques, Ishikawa, MASP, PDCA e outras.
- **5W2H**: what, why, where, when, who, how e how much.
- **Execucao**: tarefas, progresso e status.
- **Evidencias**: evidencias e comentarios.
- **Eficacia**: verificacao se a acao resolveu a causa raiz, com possibilidade de reabrir.
- **IA**: sugestoes pendentes, aceitas ou rejeitadas.
- **Historico**: eventos do plano.

## Ferramentas de analise

As ferramentas salvam dados reais no banco, nao apenas texto visual.

Ferramentas suportadas:

- 5 Porques.
- Ishikawa.
- MASP.
- PDCA.
- 5W2H.
- Pareto.
- FCA.
- Matriz GUT.
- Matriz de priorizacao.
- Brainstorming orientado.
- Analise de causa raiz.
- Checklist de eficacia.

Tabelas principais:

- `ActionAnalysisSession`
- `ActionFiveWhy`
- `ActionIshikawaCause`
- `ActionMaspStep`
- `ActionPdcaStep`
- `ActionFiveW2H`

## IA assistente

A IA assistente funciona como facilitadora de gestao. Ela considera o contexto do plano, indicador, objetivo, area, status, prazo, causa raiz e evidencias para gerar sugestoes.

As sugestoes ficam gravadas em `ActionAiSuggestion` e precisam ser aceitas ou rejeitadas pelo usuario. O sistema registra:

- Uso da IA.
- Sugestao gerada.
- Aceite ou rejeicao.
- Usuario e data da decisao.

## Eficacia

A verificacao de eficacia pergunta se a acao resolveu a causa raiz, se houve resultado alcançado, qual evidencia confirma a melhoria e se o plano precisa ser reaberto.

Campos principais:

- `effectivenessStatus`
- `effectivenessChecklist`
- `effectivenessSummary`
- `effectivenessEvidence`
- `effectivenessValidatedById`
- `effectivenessValidatedAt`

Status possiveis:

- `NOT_STARTED`
- `PENDING`
- `IN_REVIEW`
- `EFFECTIVE`
- `INEFFECTIVE`
- `REOPENED`
- `NOT_APPLICABLE`

## Auditoria e historico

O modulo registra eventos em:

- `ActionHistory`: historico especifico do plano.
- `AuditLog`: auditoria corporativa.
- `TraceabilityEvent`: linha do tempo de rastreabilidade.

Eventos registrados:

- Criacao e edicao.
- Mudanca de status.
- Tarefas criadas ou concluidas.
- Analise de causa salva.
- Evidencias.
- Comentarios.
- Uso da IA.
- Aceite ou rejeicao de sugestoes.
- Validacao de eficacia.
- Cancelamento ou reabertura.

## Mapa de Relacoes

O Mapa de Relacoes exibe os vinculos do plano com:

- Objetivo estrategico.
- Indicador.
- Resultado do indicador.
- Desvio.
- Tratativa.
- Reuniao.
- Ferramenta de analise.
- Plano de acao.
- Evidencias.
- Conclusao de eficacia.

Ao clicar no plano de acao, o usuario abre `/actions/:id`.

## Permissoes

Permissoes novas:

- `actions:create`
- `actions:update`
- `actions:delete`
- `actions:complete`
- `actions:effectiveness`
- `actions:reopen`
- `actions:extension:approve`
- `actions:analysis`
- `actions:ai`
- `actions:export`
- `actions:view_all`
- `actions:manage_all`

`actions:manage` continua funcionando como permissao ampla do modulo.

## Migration

A migration `20260522213000_action_plan_management_suite` adiciona:

- Novos status de plano.
- Novas origens.
- Enums de ferramenta, etapa, eficacia e sugestao de IA.
- Campos ampliados em `ActionPlan`.
- Tabelas de participantes, evidencias, comentarios, historico, analises, ferramentas e sugestoes de IA.

## Validacao recomendada

1. Criar plano a partir de indicador, desvio, reuniao e origem manual.
2. Salvar 5 Porques.
3. Salvar Ishikawa.
4. Salvar MASP.
5. Salvar PDCA.
6. Salvar 5W2H.
7. Gerar sugestoes de IA e aceitar/rejeitar.
8. Adicionar tarefas.
9. Adicionar evidencia e comentario.
10. Concluir e validar eficacia.
11. Reabrir plano ineficaz.
12. Conferir Mapa de Relacoes.
13. Conferir Auditoria e Historico.

## Deploy

Aplicar migration no Neon com `prisma migrate deploy` no ambiente de producao e executar build apenas no Droplet DigitalOcean.
