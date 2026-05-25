# Módulo avançado de Plano de Ação

Está documentação descreve a evolucao do módulo de Plano de Ação do Gestão 360 para uma ferramenta de gestão, análise, execucao, evidencias, eficacia e rastreabilidade.

## Objetivo

Cada plano de ação deve mostrar claramente por que foi criado, qual indicador ou problema o gerou, qual ferramenta de análise foi usada, quem e responsável, qual o prazo, quais evidencias existem e se a ação foi eficaz.

O fluxo suportado e:

```text
Diretriz / Objetivo estratégico
> Área / Setor / Processo
> Indicador
> Resultado fora da meta
> Desvio ou nao conformidade
> Análise de causa
> Ferramenta utilizada
> Reunião
> Plano de ação
> Execucao
> Evidencias
> Verificação de eficacia
> Histórico e auditoria
```

## Tela principal

A rota `/actions` possui:

- Cards de resumo para total, abertos, atrasados, concluidos fora do prazo, sem responsável, críticos e eficacia pendente.
- Filtros por busca, status, indicador e eficacia.
- Visão Kanban por status.
- Lista tabular com origem, responsável, prazo, ferramenta, eficacia e progresso.
- Cronograma por prazo.
- Modal de novo plano com origem, objetivo estratégico, área/setor, indicador, resultado, desvio, reunião, ferramenta, responsável, prioridade, criticidade, problema, ação e criterio de eficacia.

## Detalhe do plano

A rota `/actions/:id` possui abas:

- **Visão geral**: problema, causa raiz, ação proposta, resultado esperado, responsável e prontidao.
- **Origem**: trilha completa ate o plano de ação.
- **Análise de causa**: ferramentas 5 Porques, Ishikawa, MASP, PDCA e outras.
- **5W2H**: what, why, where, when, who, how e how much.
- **Execucao**: tarefas, progresso e status.
- **Evidencias**: evidencias e comentarios.
- **Eficacia**: verificação se a ação resolveu a causa raiz, com possibilidade de reabrir.
- **IA**: sugestões pendentes, aceitas ou rejeitadas.
- **Histórico**: eventos do plano.

## Ferramentas de análise

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
- Análise de causa raiz.
- Checklist de eficacia.

Tabelas principais:

- `ActionAnalysisSession`
- `ActionFiveWhy`
- `ActionIshikawaCause`
- `ActionMaspStep`
- `ActionPdcaStep`
- `ActionFiveW2H`

## IA assistente

A IA assistente funciona como facilitadora de gestão. Ela considera o contexto do plano, indicador, objetivo, área, status, prazo, causa raiz e evidencias para gerar sugestões.

As sugestões ficam gravadas em `ActionAiSuggestion` e precisam ser aceitas ou rejeitadas pelo usuário. O sistema registra:

- Uso da IA.
- Sugestão gerada.
- Aceite ou rejeicao.
- Usuário e data da decisão.

## Eficacia

A verificação de eficacia pergunta se a ação resolveu a causa raiz, se houve resultado alcançado, qual evidencia confirma a melhoria e se o plano precisa ser reaberto.

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

## Auditoria e histórico

O módulo registra eventos em:

- `ActionHistory`: histórico específico do plano.
- `AuditLog`: auditoria corporativa.
- `TraceabilityEvent`: linha do tempo de rastreabilidade.

Eventos registrados:

- Criação e edição.
- Mudanca de status.
- Tarefas criadas ou concluidas.
- Análise de causa salva.
- Evidencias.
- Comentarios.
- Uso da IA.
- Aceite ou rejeicao de sugestões.
- Validação de eficacia.
- Cancelamento ou reabertura.

## Arvore Organizacional e Mapa Estratégico

O vínculo do plano agora fica concentrado na Arvore Organizacional e no Mapa Estratégico, exibindo:

- Objetivo estratégico.
- Área macro e área micro.
- Indicador.
- Resultado do indicador.
- Desvio.
- Tratativa.
- Reunião.
- Ferramenta de análise.
- Plano de ação.
- Evidencias.
- Conclusão de eficacia.

Ao clicar no plano de ação, o usuário abre `/actions/:id`. A rota legada `/tree` redireciona para `/org`.

## Permissões

Permissões novas:

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

`actions:manage` continua funcionando como permissão ampla do módulo.

## Migration

A migration `20260522213000_action_plan_management_suite` adiciona:

- Novos status de plano.
- Novas origens.
- Enums de ferramenta, etapa, eficacia e sugestão de IA.
- Campos ampliados em `ActionPlan`.
- Tabelas de participantes, evidencias, comentarios, histórico, análises, ferramentas e sugestões de IA.

## Validação recomendada

1. Criar plano a partir de indicador, desvio, reunião e origem manual.
2. Salvar 5 Porques.
3. Salvar Ishikawa.
4. Salvar MASP.
5. Salvar PDCA.
6. Salvar 5W2H.
7. Gerar sugestões de IA e aceitar/rejeitar.
8. Adicionar tarefas.
9. Adicionar evidencia e comentario.
10. Concluir e validar eficacia.
11. Reabrir plano ineficaz.
12. Conferir Arvore Organizacional, Mapa Estratégico e linha de rastreabilidade.
13. Conferir Auditoria e Histórico.

## Deploy

Aplicar migration no Neon com `prisma migrate deploy` no ambiente de produção e executar build apenas no Droplet DigitalOcean.
