# Mapa Estratégico v2 — Notas Técnicas

Documento descreve a evolução do Mapa Estratégico (rota `/strategy/[id]`) entregue
nesta rodada. Preserva a arquitetura existente baseada em ReactFlow + Prisma
sem quebrar compatibilidade com versões e ligações já cadastradas.

## Resumo da rodada

| Tema | Onde | Status |
|---|---|---|
| Ligações manuais tipadas (drag-to-connect) | UI + `ObjectiveRelation` (já existia) | Implementado |
| Edição/exclusão de ligação pela linha | Diálogo + `PATCH/DELETE /strategy/relations/:id` | Implementado |
| Cores por tipo de relação | `RELATION_KINDS` | Implementado |
| Resize manual dos cards | `StrategicObjective.width/height` + `NodeResizer` | Implementado |
| Modo tela cheia (Fullscreen API) | Botão no canvas | Implementado |
| Modo apresentação | Esconde page header e filtros | Implementado |
| Hover card moderno com contadores | `ObjectiveHoverCard` | Implementado |
| Drawer lateral com links de drill-down | `ObjectiveDrawerContent` | Implementado |
| Propagação de status (bubble worst) | `getMap` no `StrategyService` | Implementado |
| Filtros: críticos / com tratativa / sem vínculo | Toolbar | Implementado |
| Camadas (indicador/ações no overlay) | Toggles na toolbar (flags para evolução futura) | Implementado |
| Busca centraliza no item | `useReactFlow().fitView` | Implementado |
| Mini-mapa colorido por farol | `MiniMap.nodeColor` | Implementado |
| Auto-layout por perspectiva | Botão "Organizar" | Implementado |
| Versionamento (criar/publicar) | Já existia | Mantido |

## Atualizacao FASE 3 - 2026-06-04

Incremento focado em leitura executiva e drill-down, sem criar telas paralelas:

- `StrategyService.getMap` passou a devolver, por objetivo estrategico:
  - `openActionCount`;
  - `lateActionCount`;
  - `projectCount`;
  - alem dos contadores ja existentes de acoes, tratativas e desvios.
- A contagem de projetos e explicitamente escopada por `companyId` do mapa, preservando isolamento multiempresa mesmo em agregados executivos.
- O no do objetivo no React Flow ganhou hover executivo com:
  - objetivo, perspectiva e farol agregado;
  - responsavel e area/setor;
  - quantidade de indicadores e atingimento agregado;
  - indicador em foco (mais critico), meta, realizado e atingimento;
  - acoes abertas, acoes atrasadas, desvios e projetos.
- O drawer lateral do objetivo passou a mostrar a mesma leitura operacional e adicionou atalho para projetos.
- O filtro "Com acao" foi refinado para usar acoes abertas (`openActionCount`) em vez da contagem historica total de acoes.
- A pagina `/visualization` ganhou drill-down adicional:
  - card "Desempenho geral" abre `/indicators`;
  - barras do ranking de areas abrem `/indicators?ownerNodeId=...`.
- A pagina `/reports` ganhou cards superiores clicaveis para indicadores, visualizacao executiva e acoes. O botao "Salvar filtro" foi desabilitado enquanto nao ha persistencia real, evitando botao ativo sem funcao.
- Teste unitario novo: `apps/api/src/modules/strategy/strategy.service.spec.ts`, cobrindo os agregados executivos do mapa.

Fora do escopo desta rodada (deferidos):

- Diff visual entre versões + restauração.
- Mini gráficos dentro de cada card (item 11 — pesado, coberto pelo hover).
- Ligações livres `MapNode <-> MapNode` (modelo escolhido foi manter
  `ObjectiveRelation` + vínculos tipados existentes).
- Testes E2E automatizados (item 25).

## Arquivos alterados

### Backend

- `apps/api/prisma/schema.prisma` — adiciona `width` e `height` em
  `StrategicObjective`.
- `apps/api/prisma/migrations/20260525210000_strategic_objective_size/migration.sql`
  — `ALTER TABLE` com defaults `260`/`150`.
- `apps/api/src/modules/strategy/strategy.service.ts`
  - `ObjectiveBody` aceita `width` / `height`.
  - `addObjective` salva o tamanho inicial.
  - `updateObjective` propaga as alterações de tamanho.
  - `saveLayout` aceita opcionalmente `width` / `height` em cada item.
  - `getMap` agora calcula `baseLight` por objetivo e roda
    **propagação iterativa**: para cada `outRelation`, o `aggregateLight`
    do destino assume o pior entre o próprio e o do nó de origem
    (`worstLight`). Itera até estabilizar (limite = nº de objetivos para
    evitar loops em ciclos).
  - Helpers novos: `LIGHT_ORDER`, `worstLight`.

### Frontend

- `apps/web/app/(app)/strategy/[id]/page.tsx` — reescrita extensiva:
  - Página envelopada em `ReactFlowProvider`, instância obtida via
    `useReactFlow` para `fitView` programático.
  - Tipos: `Objective.width/height/baseLight` opcionais.
  - Constante `RELATION_KINDS` com 7 tipos (`contribui`, `impacta`,
    `depende`, `medido_por`, `gera_acao`, `vinculado`, `responsável`),
    cada um com `label`, `color` e `description`.
  - `ObjectiveNode` agora respeita `width/height` da `data`, exibe
    `NodeResizer` quando selecionado em modo edição, pulsa quando
    crítico e marca "Impacto herdado" quando o farol foi propagado.
  - Novo `StrategyEdge` (registrado em `edgeTypes`): renderiza linha
    estilizada pela cor do tipo, com tracejado quando `depende`, marker
    customizado `g360-arrow`, label clicável que abre o editor de
    ligação.
  - Drag-to-connect agora **não cria a relação direto** — abre o diálogo
    "Nova ligação estratégica" para escolher o tipo e o rótulo.
  - Clique na label da linha abre o diálogo "Editar ligação" com:
    seleção de tipo, rótulo livre, botão de remover.
  - Hover sobre o nó renderiza `ObjectiveHoverCard` (posição
    floatante absoluta), com contadores, indicadores fora da meta e
    responsável.
  - Click no nó preenche `setDrawerObjective`, que abre um drawer
    lateral fixo (`ObjectiveDrawerContent`) com:
    - Status, prioridade, peso.
    - Responsável e área/setor.
    - Lista de indicadores como `Link` clicável para
      `/indicators/:id`.
    - Atalhos rápidos para `/actions`, `/meetings`, `/treatments`,
      `/deviations` (filtrando pelo primeiro indicador).
    - Lista de ligações estratégicas com cor por tipo.
  - Toolbar com:
    - Busca (centraliza no match via `reactFlow.fitView`).
    - Filtros: status, perspectiva, somente críticos, com tratativa,
      sem vínculo, limpar.
    - Toggles de camadas (indicadores/ações — preparados para evolução).
    - Botões adicionados ao `PageHeader`:
      - `Organizar` (autoLayout): persiste posições alinhadas por
        perspectiva via `PATCH /strategy/maps/:id/layout`.
      - `Apresentar`: esconde page header + toolbar; o canvas vai
        ocupar `h-screen`.
  - Botão `Maximize2/Minimize2` flutuante usa
    `requestFullscreen`/`exitFullscreen` no container do canvas.
  - `MiniMap.nodeColor` pinta cada nó pela cor do farol agregado.
  - SVG `<defs>` define o marker `g360-arrow` usado pelas edges.

### Documentação

- `docs/mapa-estratégico-v2.md` — este arquivo.

## Modelo conceitual

```
Empresa
  └─ StrategicMap
       ├─ Perspective[] (lanes verticais)
       │    └─ StrategicObjective[] (cards)
       │         ├─ positionX, positionY, width, height
       │         ├─ indicators (StrategicObjectiveIndicator)
       │         ├─ orgNodeLinks (StrategicObjectiveOrgNode)
       │         ├─ outRelations → ObjectiveRelation
       │         └─ inRelations → ObjectiveRelation
       └─ versions (StrategicMapVersion)
```

`ObjectiveRelation.kind` é livre (string) e o frontend mapeia para um
dos 7 tipos predefinidos via `RELATION_KIND_MAP`. Valores fora da lista
caem no fallback `impacta` (cor azul). Backend não restringe — clientes
existentes continuam compatíveis.

## Propagação de farol

Algoritmo (backend, `strategy.service.ts > getMap`):

1. Calcula `baseLight[obj] = aggregateTrafficLight(lights dos
   indicadores do obj)`. GRAY se sem indicador.
2. `propagated[obj] = baseLight[obj]`.
3. Para cada `[from, to]` em `outRelations`:
   - `propagated[to] = worstLight(propagated[from], propagated[to])`
4. Repetir até nenhuma alteração ocorrer (no máximo N iterações).
5. `aggregateLight = propagated[obj]`; `baseLight` é retornado
   separadamente para o frontend exibir o badge "Impacto herdado".

Ordem de severidade: `GRAY < GREEN < YELLOW < RED`.

## Como criar uma ligação manual

1. Entre no modo edição (`Pencil` na page header).
2. Passe o mouse sobre a borda direita ou inferior do card de origem
   até aparecer um ponto azul (Handle).
3. Arraste até o card de destino e solte.
4. O diálogo "Nova ligação estratégica" abre: escolha o tipo (7 opções
   com cor + descrição), opcionalmente edite o rótulo, clique em
   "Conectar".
5. A relação é persistida via `POST /strategy/relations`.

## Como editar/excluir uma ligação

1. Clique na pílula colorida no meio da linha.
2. Abre o diálogo "Editar ligação".
3. Trocar tipo/rótulo e clicar "Salvar ligação" → `PATCH
   /strategy/relations/:id`.
4. Ou clicar "Remover" (confirmação) → `DELETE /strategy/relations/:id`.

## Como redimensionar um card

1. Entre em modo edição.
2. Selecione o card (clique).
3. Aparecem 8 alças (`NodeResizer`) nas bordas e cantos. Arraste para
   ajustar.
4. Salvar via botão "Salvar layout" no header.

## Tela cheia e apresentação

- **Tela cheia**: botão flutuante no canto superior direito do canvas.
  Usa `Element.requestFullscreen()` no container do canvas. ESC sai.
- **Modo apresentação**: botão "Apresentar" no header esconde page
  header e toolbar, deixando o canvas em altura `h-screen`. O botão
  com o ícone `Monitor` no canto superior direito sai do modo.

Ambos coexistem: pode usar Tela cheia dentro do modo apresentação.

## Auto-layout

Botão "Organizar" salva uma distribuição alinhada por perspectiva: cada
faixa de perspectiva recebe seus objetivos em colunas de 4 com altura
calculada. Usa o endpoint existente `PATCH /strategy/maps/:id/layout`.

## Pontos de extensão futuros

1. **Versão diff/restauração** — `StrategicMapVersion.snapshot` já é
   `Json`. Basta consumir e renderizar.
2. **Mini-gráfico no card** — adicionar SVG sparkline no
   `ObjectiveNode` com os últimos N resultados do `indicators[0]`.
   Performance pode ser problema com >100 cards.
3. **Layouts adicionais** — integrar `dagre`/`elkjs` para hierárquico
   real. O botão "Organizar" já chama uma função `autoLayout`
   parametrizável.
4. **Permissões finas** — os endpoints já têm `@RequirePermissions`
   por ação (`strategy:objectives:update`, `strategy:links:manage`,
   `strategy:publish`, etc). A UI pode esconder botões com base em
   `me.permissions`.
5. **Ligações livres entre qualquer objeto** — modelo `MapNode/MapEdge`
   já existe no schema (`RelationshipMap`). Pode ser exposto como
   uma rota separada `/strategy/free-graph/:id` sem afetar este mapa.

## Como rodar local

```bash
cd apps/api && npx prisma migrate dev
cd apps/web && pnpm dev
# Acesse http://localhost:3000/strategy e abra um mapa.
```

## Deploy

Migration `20260525210000_strategic_objective_size` é aplicada
automaticamente pelo CMD da API no container (deploy.sh já roda
`prisma migrate deploy`). Nada manual é necessário.
