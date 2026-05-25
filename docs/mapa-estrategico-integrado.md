# Mapa Estratégico Integrado

O Mapa Estratégico passou a ser uma área administrativa e visual do Gestão 360 para conectar estratégia, estrutura organizacional, indicadores, análises, reuniões e planos de ação.

## Visão geral

A tela `Mapa Estratégico` permite criar mapas por ciclo, editar seus dados gerais, inativar mapas e abrir um canvas visual para manutenção do conteúdo estratégico.

No detalhe do mapa, o usuário autorizado consegue:

- alternar entre modo visualização e modo edição;
- criar, editar, reordenar e inativar perspectivas;
- criar, editar, mover e inativar objetivos estratégicos;
- arrastar objetivos entre perspectivas;
- criar ligacoes visuais entre objetivos;
- remover ligacoes;
- vincular indicadores existentes;
- vincular áreas, setores, processos ou outras estruturas;
- ver status agregado do objetivo com base nos indicadores vinculados;
- abrir indicador, análise, reunião, plano de ação e Arvore Organizacional;
- criar versões de trabalho;
- publicar uma versão do mapa.

As perspectivas sao configuraveis pela interface. O sistema pode sugerir uma estrutura inicial de Balanced Scorecard, mas os nomes, cores, descrições, ordem e objetivos sao mantidos no banco de dados e podem ser alterados sem mudanca de código.

## Estrutura de dados

As principais entidades sao:

- `StrategicMap`: ciclo estratégico, período, descrição, status e versão publicada.
- `Perspective`: perspectiva visual do mapa, com nome, descrição, cor, icone, ordem e status.
- `StrategicObjective`: objetivo estratégico com status, prioridade, peso, responsável, área/setor, posição visual e perspectiva.
- `StrategicObjectiveIndicator`: vínculo real muitos-para-muitos entre objetivos e indicadores.
- `StrategicObjectiveOrgNode`: vínculos adicionais com áreas, setores, processos e demais estruturas.
- `ObjectiveRelation`: ligacoes de causa, impacto ou dependência entre objetivos.
- `StrategicMapVersion`: snapshot versionado do mapa para publicação e histórico.
- `AuditLog`: registro automático das alterações relevantes.

O campo legado `Indicator.strategicObjectiveId` foi mantido para compatibilidade, mas novos vínculos sao gravados também em `StrategicObjectiveIndicator`.

## Integração com a Arvore Organizacional

O Mapa Estratégico sincroniza a origem estratégica dos indicadores com a Arvore Organizacional.

O fluxo exibido passa a considerar:

```text
Empresa
> Mapa Estratégico
> Perspectiva
> Objetivo Estratégico
> Área / Setor / Processo
> Indicador
> Desvio / Tratativa
> Reunião
> Plano de Ação
> Acompanhamento
```

Quando um objetivo possui indicadores vinculados, o sistema preserva a conexão real `Objetivo Estratégico -> Indicador` e o indicador segue vinculado ao seu no da Arvore Organizacional.

## Permissões

As permissões granulares foram adicionadas ao catalogo administrativo:

- `strategy:view`
- `strategy:manage`
- `strategy:maps:create`
- `strategy:maps:update`
- `strategy:maps:delete`
- `strategy:perspectives:create`
- `strategy:perspectives:update`
- `strategy:perspectives:delete`
- `strategy:objectives:create`
- `strategy:objectives:update`
- `strategy:objectives:delete`
- `strategy:indicators:link`
- `strategy:links:manage`
- `strategy:publish`
- `strategy:history:view`

O `Super Admin` sempre possui acesso total. Perfis que tenham `strategy:manage` também conseguem operar as permissões específicas de estratégia, mantendo compatibilidade com perfis administrativos existentes.

## Auditoria

As operações sensiveis registram auditoria com usuário, empresa, módulo, entidade, registro, valor anterior, valor novo e resultado:

- criação, edição e inativação de mapa;
- criação, edição, reordenacao e inativação de perspectiva;
- criação, edição, movimentação, layout e inativação de objetivo;
- criação e remocao de ligacao entre objetivos;
- vínculo e remocao de indicadores;
- vínculo e remocao de áreas/setores/processos;
- criação e publicação de versões.

## Regras de operação

- Registros estratégicos importantes usam exclusão lógica.
- Perspectivas com objetivos ativos nao podem ser inativadas diretamente.
- Objetivos inativados preservam histórico, vínculos e auditoria.
- Objetivos podem mudar de perspectiva pelo painel lateral ou por arrastar e soltar.
- Indicadores vinculados ao objetivo alimentam o status visual agregado: verde, amarelo, vermelho ou cinza.
- A versão publicada cria um snapshot JSON do mapa naquele momento.

## APIs principais

- `GET /api/strategy/maps`
- `POST /api/strategy/maps`
- `PATCH /api/strategy/maps/:id`
- `DELETE /api/strategy/maps/:id`
- `GET /api/strategy/maps/:id`
- `GET /api/strategy/options`
- `POST /api/strategy/maps/:id/perspectives`
- `PATCH /api/strategy/perspectives/:id`
- `DELETE /api/strategy/perspectives/:id`
- `PATCH /api/strategy/maps/:id/perspectives/reorder`
- `POST /api/strategy/maps/:id/objectives`
- `PATCH /api/strategy/objectives/:objId`
- `DELETE /api/strategy/objectives/:objId`
- `PATCH /api/strategy/maps/:id/layout`
- `POST /api/strategy/relations`
- `PATCH /api/strategy/relations/:id`
- `DELETE /api/strategy/relations/:id`
- `POST /api/strategy/objectives/:objId/indicators/:indicatorId`
- `DELETE /api/strategy/objectives/:objId/indicators/:indicatorId`
- `POST /api/strategy/objectives/:objId/orgnodes/:orgNodeId`
- `DELETE /api/strategy/objectives/:objId/orgnodes/:orgNodeId`
- `GET /api/strategy/maps/:id/versions`
- `POST /api/strategy/maps/:id/versions`

## Validação recomendada

Antes de publicar em produção, validar:

- criação e edição de mapa;
- criação, edição, reordenacao e inativação de perspectivas;
- criação, edição, movimentação e inativação de objetivos;
- arrastar objetivo entre perspectivas;
- criar e remover ligacoes entre objetivos;
- vincular e remover indicadores;
- vincular áreas, setores e processos;
- abrir origem na Arvore Organizacional;
- publicar versão;
- consultar auditoria;
- testar usuário sem permissão de edição.
