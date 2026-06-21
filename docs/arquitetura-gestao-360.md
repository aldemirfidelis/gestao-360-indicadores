# Arquitetura Gestao 360

## Objetivo

O Gestao 360 organiza a jornada completa da gestao empresarial:

Empresa -> Diretrizes -> Setores/Areas/Processos -> Indicadores -> Metas -> Resultados -> Desvios -> Analise de causa -> Reunioes -> Planos de acao -> Execucao -> Evidencias -> Acompanhamento -> Conclusao -> Historico.

## Modulos

- Cadastros: empresas, unidades, estrutura organizacional, usuarios, responsaveis, indicadores, metas e parametros.
- Indicadores: cadastro, metas, resultados, farol, evolucao e historico mensal.
- Analise de causa: desvios, causas, metodo de analise, causa raiz e acao gerada.
- Reunioes: agenda, participantes, decisoes e acoes originadas da reuniao.
- Planos de acao: kanban, lista, cronograma, tarefas, status, responsavel, prazo, evidencias e eficacia.
- Estrategia: mapas estrategicos, perspectivas, objetivos, indicadores, relacoes e versoes.
- Rastreabilidade: linha do tempo por indicador e eventos por entidade.
- Auditoria: registro tecnico de criacao, atualizacao, status, conexoes e acoes relevantes.
- Busca global: consulta rapida de indicadores, estrutura, acoes, desvios, reunioes, usuarios e objetivos.
- Relatorios: exportacoes e visoes executivas por tema.

## Decisao sobre mapa de relacoes

O mapa de relacoes e uma capacidade dentro de Estrategia/Mapa Estrategico, nao um modulo de produto separado.

Isso significa:

- A navegacao principal deve levar o usuario para `strategy` quando o assunto for mapa, objetivos e relacoes.
- Relacoes entre objetivo, indicador, desvio, reuniao, acao e estrutura organizacional pertencem ao contexto estrategico.
- APIs ou tabelas internas de mapa podem existir como suporte tecnico, mas nao definem um modulo independente para o usuario.
- Antes de criar um novo menu ou modulo chamado "relationship map", reaproveite a experiencia de Estrategia e os detalhes das entidades.

## Banco de dados

Entidades transversais da arquitetura:

- `TraceabilityEvent`: evento de negocio rastreavel com usuario, entidade, indicador relacionado, status anterior/novo e metadados.
- `StatusHistory`: historico normalizado de mudanca de status.
- `RelationshipMap`: suporte tecnico para visualizacoes de relacao por empresa.
- `MapNode`: bloco tecnico do mapa, podendo apontar para indicador, desvio, reuniao, acao ou bloco livre.
- `MapEdge`: conexao entre blocos.
- `MapLayout`: layout salvo por modo de visualizacao.

Mesmo quando essas entidades aparecem no schema, a decisao de produto continua sendo: a experiencia vive dentro de `strategy`.

## Fluxo do indicador

1. O indicador e cadastrado e vinculado a estrutura organizacional e, quando aplicavel, ao objetivo estrategico.
2. Metas e resultados sao lancados por periodo.
3. Resultado fora da meta gera evento `OFF_TARGET_ALERT`.
4. O gestor cria ou acompanha desvio e analise de causa.
5. Causas, analises e causa raiz sao registradas.
6. Uma reuniao pode formalizar decisoes.
7. O desvio, reuniao ou indicador gera plano de acao.
8. A execucao atualiza status, tarefas, evidencias e progresso.
9. O indicador e reavaliado.
10. A linha de rastreabilidade preserva todo o historico para gestao e auditoria.

## APIs principais

- `GET /api/search?q=...`: busca global.
- `GET /api/traceability/indicators/:id`: historico completo do indicador.
- `GET /api/traceability`: eventos filtrados por indicador ou entidade.
- `strategy/*`: endpoints de mapas, perspectivas, objetivos, vinculos, relacoes e versoes.

Endpoints historicos de `relationship-map/*`, se presentes, devem ser entendidos como suporte interno/legado para visualizacao estrategica, nao como contrato para um modulo separado.

## Diretrizes de evolucao

- Qualquer criacao, alteracao de status, geracao de acao, analise, decisao ou conexao relevante deve registrar `TraceabilityEvent`.
- Telas operacionais devem continuar objetivas e focadas em cadastro/execucao.
- Telas executivas devem consumir dados consolidados, com filtros e navegacao para o detalhe.
- O mapa deve ajudar a explicar estrategia, causa, impacto e acao dentro do fluxo de gestao.
- Antes de criar novas tabelas especificas, verificar se `TraceabilityEvent`, `Attachment`, `Comment`, `StatusHistory` e as entidades de estrategia ja resolvem o caso.

## Validacao recomendada

- Build da API e web.
- Testes do pacote shared.
- Teste manual de: lancar resultado fora da meta, criar desvio, registrar causa, gerar acao, mudar status, abrir historico do indicador e verificar relacoes no contexto estrategico.
