# Mapa Estrategico Integrado

O Mapa Estrategico passou a ser uma area administrativa e visual do Gestao 360 para conectar estrategia, estrutura organizacional, indicadores, analises, reunioes e planos de acao.

## Visao geral

A tela `Mapa Estrategico` permite criar mapas por ciclo, editar seus dados gerais, inativar mapas e abrir um canvas visual para manutencao do conteudo estrategico.

No detalhe do mapa, o usuario autorizado consegue:

- alternar entre modo visualizacao e modo edicao;
- criar, editar, reordenar e inativar perspectivas;
- criar, editar, mover e inativar objetivos estrategicos;
- arrastar objetivos entre perspectivas;
- criar ligacoes visuais entre objetivos;
- remover ligacoes;
- vincular indicadores existentes;
- vincular areas, setores, processos ou outras estruturas;
- ver status agregado do objetivo com base nos indicadores vinculados;
- abrir indicador, analise, reuniao, plano de acao e Arvore Organizacional;
- criar versoes de trabalho;
- publicar uma versao do mapa.

As perspectivas sao configuraveis pela interface. O sistema pode sugerir uma estrutura inicial de Balanced Scorecard, mas os nomes, cores, descricoes, ordem e objetivos sao mantidos no banco de dados e podem ser alterados sem mudanca de codigo.

## Estrutura de dados

As principais entidades sao:

- `StrategicMap`: ciclo estrategico, periodo, descricao, status e versao publicada.
- `Perspective`: perspectiva visual do mapa, com nome, descricao, cor, icone, ordem e status.
- `StrategicObjective`: objetivo estrategico com status, prioridade, peso, responsavel, area/setor, posicao visual e perspectiva.
- `StrategicObjectiveIndicator`: vinculo real muitos-para-muitos entre objetivos e indicadores.
- `StrategicObjectiveOrgNode`: vinculos adicionais com areas, setores, processos e demais estruturas.
- `ObjectiveRelation`: ligacoes de causa, impacto ou dependencia entre objetivos.
- `StrategicMapVersion`: snapshot versionado do mapa para publicacao e historico.
- `AuditLog`: registro automatico das alteracoes relevantes.

O campo legado `Indicator.strategicObjectiveId` foi mantido para compatibilidade, mas novos vinculos sao gravados tambem em `StrategicObjectiveIndicator`.

## Integracao com a Arvore Organizacional

O Mapa Estrategico sincroniza a origem estrategica dos indicadores com a Arvore Organizacional.

O fluxo exibido passa a considerar:

```text
Empresa
> Mapa Estrategico
> Perspectiva
> Objetivo Estrategico
> Area / Setor / Processo
> Indicador
> Desvio / Tratativa
> Reuniao
> Plano de Acao
> Acompanhamento
```

Quando um objetivo possui indicadores vinculados, o sistema preserva a conexao real `Objetivo Estrategico -> Indicador` e o indicador segue vinculado ao seu no da Arvore Organizacional.

## Permissoes

As permissoes granulares foram adicionadas ao catalogo administrativo:

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

O `Super Admin` sempre possui acesso total. Perfis que tenham `strategy:manage` tambem conseguem operar as permissoes especificas de estrategia, mantendo compatibilidade com perfis administrativos existentes.

## Auditoria

As operacoes sensiveis registram auditoria com usuario, empresa, modulo, entidade, registro, valor anterior, valor novo e resultado:

- criacao, edicao e inativacao de mapa;
- criacao, edicao, reordenacao e inativacao de perspectiva;
- criacao, edicao, movimentacao, layout e inativacao de objetivo;
- criacao e remocao de ligacao entre objetivos;
- vinculo e remocao de indicadores;
- vinculo e remocao de areas/setores/processos;
- criacao e publicacao de versoes.

## Regras de operacao

- Registros estrategicos importantes usam exclusao logica.
- Perspectivas com objetivos ativos nao podem ser inativadas diretamente.
- Objetivos inativados preservam historico, vinculos e auditoria.
- Objetivos podem mudar de perspectiva pelo painel lateral ou por arrastar e soltar.
- Indicadores vinculados ao objetivo alimentam o status visual agregado: verde, amarelo, vermelho ou cinza.
- A versao publicada cria um snapshot JSON do mapa naquele momento.

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

## Validacao recomendada

Antes de publicar em producao, validar:

- criacao e edicao de mapa;
- criacao, edicao, reordenacao e inativacao de perspectivas;
- criacao, edicao, movimentacao e inativacao de objetivos;
- arrastar objetivo entre perspectivas;
- criar e remover ligacoes entre objetivos;
- vincular e remover indicadores;
- vincular areas, setores e processos;
- abrir origem na Arvore Organizacional;
- publicar versao;
- consultar auditoria;
- testar usuario sem permissao de edicao.
