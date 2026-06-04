# FASE 6 - Registro de riscos

Esta entrega inicia a FASE 6 com o registro corporativo de riscos. O escopo cobre cadastro, listagem, edicao, exclusao logica, resumo executivo e vinculos com areas/processos, indicadores, projetos e planos de acao.

## Backend

Modelo criado:

- `RiskRegister`
- `RiskCategory`
- `RiskStatus`

Rotas:

- `GET /risks`
- `GET /risks/summary`
- `GET /risks/options`
- `GET /risks/:id`
- `POST /risks`
- `PATCH /risks/:id`
- `DELETE /risks/:id`

Permissoes:

- `risks:view`
- `risks:create`
- `risks:update`
- `risks:delete`
- `risks:manage`

## Regras de acesso

O modulo usa `AccessService` com a chave `risks`.

- Riscos sem area, KPI, projeto ou acao sao tratados como registros gerais da empresa.
- Riscos vinculados a uma area/processo usam `orgNodeId` como area de escopo.
- Riscos vinculados a KPI usam a area proprietaria do indicador.
- Riscos vinculados a projeto usam a area do KPI do projeto, quando houver.
- Riscos vinculados a plano de acao usam `ownerNodeId` do plano ou a area do KPI do plano.
- Vinculos que apontam para areas diferentes sao recusados para evitar ambiguidade de visibilidade.

## Frontend

A rota `/risks` foi adicionada ao menu de Gestao e protegida por `risks:view`.

A tela inclui:

- Metricas de riscos abertos, criticos, mitigacoes vencidas e score medio.
- Lista de riscos prioritarios.
- Filtros por busca, status e categoria.
- Cadastro e edicao em dialogo.
- Exclusao logica quando o usuario possui `risks:delete`.

## Validacoes

Foram adicionados testes unitarios para:

- Escopo por empresa.
- Filtro de visibilidade por area.
- Recusa de vinculos de outra empresa.
- Recusa de vinculos em areas diferentes.
- Calculo do resumo executivo.
- Fechamento de risco com `closedAt`.
