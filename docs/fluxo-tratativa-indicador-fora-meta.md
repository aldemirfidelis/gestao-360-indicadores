# Fluxo de tratativa de indicador fora da meta

Este documento registra a decisao atual de produto: a tratativa existe tecnicamente como `TreatmentCase`, mas a experiencia do usuario foi incorporada ao modulo de Plano de Acao.

## Decisao vigente

- `/treatments` nao e mais uma area operacional propria.
- Rotas antigas de tratativa devem redirecionar para `/actions` ou para o detalhe operacional relacionado.
- O usuario trata indicador vermelho criando ou acompanhando acoes, analises, evidencias, reunioes e reavaliacoes dentro de Plano de Acao.
- `TreatmentCase` continua util no backend para rastrear ciclo, status, historico, notificacoes, convites e reavaliacao do indicador.

Em termos de produto, leia o fluxo como `/treatments -> /actions`.

## Jornada

Indicador fora da meta -> alerta -> desvio/analise de causa -> plano de acao -> reuniao quando necessario -> evidencias -> execucao -> novo resultado -> reavaliacao -> resolucao ou reabertura.

## Como o fluxo inicia

1. O usuario lanca resultado em `/results`.
2. O backend calcula o farol com `calcStatus`.
3. Quando o farol e `RED`, o `ResultsService` cria ou atualiza uma `TreatmentCase` unica por `indicatorId + periodRef`.
4. A tela de lancamentos mostra o alerta "Indicador fora da meta detectado".
5. O usuario segue para `/actions` para tratar o problema com analise, responsavel, prazo, evidencia e acompanhamento.

## Experiencia em Plano de Acao

O Plano de Acao concentra:

- Contexto do indicador, meta, resultado e desvio.
- Problema, causa provavel, causa raiz, metodo de analise e evidencias.
- Responsavel, prazo, prioridade, custo e resultado esperado.
- Participantes e comentarios.
- Subtarefas e progresso.
- Evidencias de execucao.
- Reavaliacao do indicador depois da acao.

Metodos de analise disponiveis: FCA, 5 Porques, Ishikawa, Pareto, PDCA, MASP, DMAIC, CAPA e analise simples.

## Reuniao de tratativa

A reuniao e opcional e fica em `/meetings/:id`. Ela formaliza decisoes e pode gerar ou complementar acoes.

Quando vinculada ao fluxo, a reuniao concentra:

- Contexto do indicador.
- Resultado atual, meta esperada e desvio.
- Analise de causa vinculada.
- Pauta sugerida automaticamente.
- Participantes internos.
- Convidados externos com nome, e-mail, cargo, area e papel.
- Decisoes e encaminhamentos.
- Acoes vinculadas.
- Logs de envio de e-mail.
- Convite de calendario no formato ICS.

## Convite por e-mail e calendario

Endpoint: `POST /api/meetings/:id/invitations/send`.

O sistema:

1. Coleta participantes internos e convidados externos com e-mail valido.
2. Gera um ICS no padrao iCalendar.
3. Cria ou atualiza `CalendarInvite`.
4. Envia e-mail via SMTP quando configurado.
5. Cria um `EmailLog` por destinatario.
6. Registra eventos de rastreabilidade para convite criado, enviado, pendente ou com erro.

```env
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM="Gestao 360 <nao-responder@seudominio.com>"
```

Sem SMTP, o envio fica como `PENDING`, mas historico, log e ICS continuam registrados.

## Status tecnico da tratativa

Principais status mantidos no backend:

- `AWAITING_CAUSE_ANALYSIS`
- `CAUSE_ANALYSIS_CREATED`
- `MEETING_SCHEDULED`
- `MEETING_COMPLETED`
- `ACTION_PLAN_CREATED`
- `ACTIONS_IN_PROGRESS`
- `ACTIONS_OVERDUE`
- `AWAITING_EVIDENCE`
- `AWAITING_REEVALUATION`
- `RESOLVED`
- `UNRESOLVED`
- `REOPENED`
- `CONCLUDED`
- `IGNORED_TEMPORARILY`

Acoes vinculadas atualizam automaticamente a tratativa para em andamento, atrasada ou aguardando reavaliacao. Novo resultado verde resolve o caso; novo resultado vermelho mantem ou reabre a tratativa.

## Banco de dados

Tabelas do fluxo:

- `TreatmentCase`
- `MeetingGuest`
- `EmailLog`
- `CalendarInvite`

Tabelas relacionadas:

- `Meeting`: vinculos para indicador, desvio, analise e tratativa; responsavel; formato; status; objetivo.
- `MeetingParticipant`: papel e observacoes.
- `ActionPlan`: vinculos para indicador, reuniao, analise e tratativa; e-mail do responsavel; evidencia obrigatoria; resultado esperado; resultado alcancado.
- `TraceabilityEvent`: eventos para tratativa, convites, participantes, reuniao concluida e reavaliacao.

## Como testar

1. Crie ou escolha um indicador com meta cadastrada.
2. Lance um resultado vermelho em `/results`.
3. Confirme o alerta e siga para `/actions`.
4. Crie ou abra a acao vinculada ao indicador.
5. Registre analise de causa, responsavel, prazo e evidencia esperada.
6. Se houver reuniao, crie em `/meetings` e vincule a acao/indicador.
7. Envie convite e confira logs em `/meetings/:id`.
8. Mude o status da acao no Kanban.
9. Lance um novo resultado verde.
10. Reavalie o indicador e confira rastreabilidade.
