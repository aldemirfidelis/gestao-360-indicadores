# Fluxo de Tratativa de Indicador Fora da Meta

Este documento descreve o fluxo inteligente criado para impedir que indicadores fora da meta fiquem sem tratativa.

## Jornada

Indicador fora da meta -> Analise de causa -> Reuniao de tratativa -> Participantes -> Convite por e-mail/ICS -> Plano de acao -> Execucao -> Reavaliacao -> Resolucao ou reabertura.

## Como o fluxo inicia

1. O usuario lanca resultado em `/results`.
2. O backend calcula o farol com `calcStatus`.
3. Quando o farol e `RED`, o `ResultsService` cria ou atualiza uma `TreatmentCase` unica por `indicatorId + periodRef`.
4. A tela de lancamentos mostra o alerta "Indicador fora da meta detectado".
5. O usuario pode abrir o fluxo guiado, ver o historico ou ignorar temporariamente com justificativa.

## Fluxo guiado

A tela `/treatments/:id` conduz o usuario por quatro blocos:

1. Analise de causa: problema, causa provavel, causa raiz, metodo, evidencias e observacoes.
2. Reuniao de tratativa: data, horario, local/link, formato e participantes.
3. Plano de acao: titulo, descricao, responsavel, e-mail, prazo, prioridade, evidencia obrigatoria e resultado esperado.
4. Acompanhamento: reavaliacao do indicador depois da execucao das acoes.

Metodos de analise disponiveis: FCA, 5 Porques, Ishikawa, Pareto, PDCA, MASP, DMAIC, CAPA e analise simples.

## Reuniao de tratativa

A reuniao criada pela tratativa fica em `/meetings/:id` e concentra:

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
3. Cria/atualiza `CalendarInvite`.
4. Envia e-mail via SMTP quando configurado.
5. Cria um `EmailLog` por destinatario.
6. Registra eventos de rastreabilidade para convite criado, enviado, pendente ou com erro.

Variaveis:

```env
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM="Gestao 360 <nao-responder@seudominio.com>"
```

Sem SMTP, o envio fica como `PENDING`, mas o historico, o log e o ICS continuam registrados.

## Status da tratativa

Principais status:

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

As acoes vinculadas atualizam automaticamente a tratativa para em andamento, atrasada ou aguardando reavaliacao. Novo resultado verde resolve a tratativa.

## Banco de dados

Tabelas novas:

- `TreatmentCase`
- `MeetingGuest`
- `EmailLog`
- `CalendarInvite`

Tabelas alteradas:

- `Meeting`: vinculos para indicador, desvio, analise e tratativa; responsavel; formato; status; objetivo.
- `MeetingParticipant`: papel e observacoes.
- `ActionPlan`: vinculos para indicador, reuniao, analise e tratativa; e-mail do responsavel; evidencia obrigatoria; resultado esperado; resultado alcancado.
- `TraceabilityEvent`: novos eventos para tratativa, convites, participantes, reuniao concluida e reavaliacao.

## Como testar

1. Crie ou escolha um indicador com meta cadastrada.
2. Lance um resultado vermelho em `/results`.
3. Abra a tratativa pelo alerta.
4. Salve uma analise de causa.
5. Agende uma reuniao de tratativa.
6. Adicione participante externo com e-mail valido.
7. Envie convite e confira logs em `/meetings/:id`.
8. Crie uma acao vinculada pela reuniao.
9. Mude o status da acao no Kanban.
10. Lance um novo resultado verde.
11. Reavalie a tratativa.
12. Confira a linha de rastreabilidade do indicador e o Mapa de Relacoes.
