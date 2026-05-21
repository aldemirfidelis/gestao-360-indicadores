# Arquitetura Gestão 360

## Objetivo

O Gestão 360 organiza a jornada completa da gestão empresarial:

Empresa -> Diretrizes -> Setores/Áreas/Processos -> Indicadores -> Metas -> Resultados -> Desvios -> Análise de causa -> Reuniões -> Planos de ação -> Execução -> Evidências -> Acompanhamento -> Conclusão -> Histórico.

## Módulos

- Cadastros: empresas, unidades, estrutura organizacional, usuários, responsáveis, indicadores, metas e parâmetros.
- Indicadores: cadastro, metas, resultados, farol, evolução e histórico mensal.
- Análise de causa: desvios, causas, método de análise, causa raiz e ação gerada.
- Reuniões: agenda, participantes, decisões e ações originadas da reunião.
- Planos de ação: kanban, lista, cronograma, tarefas, status, responsável e prazo.
- Mapa de relações: canvas persistente com blocos e conexões entre estrutura, indicadores, desvios, reuniões e ações.
- Rastreabilidade: linha do tempo por indicador e eventos por entidade.
- Auditoria: registro técnico de criação, atualização, status, conexões e ações relevantes.
- Busca global: consulta rápida de indicadores, estrutura, ações, desvios, reuniões, usuários e objetivos.
- Relatórios: exportações e visões executivas por tema.

## Banco de dados

Além das entidades operacionais já existentes, a arquitetura passou a ter entidades transversais:

- `TraceabilityEvent`: evento de negócio rastreável com usuário, entidade, indicador relacionado, status anterior/novo e metadados.
- `StatusHistory`: histórico normalizado de mudança de status.
- `RelationshipMap`: mapa persistente por empresa.
- `MapNode`: bloco do mapa, podendo apontar para indicador, desvio, reunião, ação ou bloco livre.
- `MapEdge`: conexão entre blocos.
- `MapLayout`: layout salvo por modo de visualização.

## Fluxo do indicador

1. O indicador é cadastrado e vinculado à estrutura organizacional e, quando aplicável, ao objetivo estratégico.
2. Metas e resultados são lançados por período.
3. Resultado fora da meta gera evento `OFF_TARGET_ALERT`.
4. O gestor cria um desvio/análise de causa.
5. Causas, análises e causa raiz são registradas.
6. Uma reunião pode formalizar decisões.
7. O desvio ou reunião pode gerar plano de ação.
8. A execução atualiza status, tarefas, evidências e progresso.
9. O indicador é reavaliado.
10. A linha de rastreabilidade preserva todo o histórico para gestão e auditoria.

## APIs principais

- `GET /api/search?q=...`: busca global.
- `GET /api/traceability/indicators/:id`: histórico completo do indicador.
- `GET /api/traceability`: eventos filtrados por indicador ou entidade.
- `GET /api/relationship-map/default`: mapa 360 sincronizado com os dados da empresa.
- `POST /api/relationship-map/nodes`: cria bloco livre no mapa.
- `POST /api/relationship-map/edges`: cria conexão entre blocos.
- `POST /api/relationship-map/:id/layout`: salva posições do canvas.

## Diretrizes de evolução

- Qualquer criação, alteração de status, geração de ação, análise, decisão ou conexão relevante deve registrar `TraceabilityEvent`.
- Telas operacionais devem continuar objetivas e focadas em cadastro/execução.
- Telas executivas devem consumir dados consolidados, com filtros e navegação para o detalhe.
- O mapa deve ser tratado como ferramenta central de compreensão, não apenas visualização decorativa.
- Antes de criar novas tabelas específicas, verificar se `TraceabilityEvent`, `Attachment`, `Comment`, `StatusHistory` e `RelationshipMap` já resolvem o caso.

## Validação recomendada

- Build da API e web.
- Testes do pacote shared.
- Teste manual de: lançar resultado fora da meta, criar desvio, registrar causa, gerar ação, mudar status, abrir histórico do indicador e verificar o mapa.
