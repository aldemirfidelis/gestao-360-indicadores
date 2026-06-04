# Projetos e PMO - FASE 4

Nota tecnica da FASE 4 do plano de evolucao Gestao 360. A entrega usa o
modelo de projetos que ja existia (`Project`, `ProjectMilestone` e
`ProjectTask`) e nao exige migracao de banco.

## Objetivo da rodada

Transformar `/projects` em uma visao de portfolio PMO, conectada aos KPIs e
ao mapa estrategico, sem criar uma tela paralela:

- filtros executivos por busca, status e indicador;
- resumo consolidado do portfolio autorizado;
- identificacao automatica de projetos criticos ou em risco;
- drill-down a partir do mapa estrategico para projetos do indicador;
- detalhe do projeto com status PMO calculado.

## Backend

### Endpoints

- `GET /projects`
  - aceita `search`, `status` e `indicatorId`;
  - retorna cada projeto enriquecido com campos PMO.
- `GET /projects/portfolio`
  - aceita os mesmos filtros da lista;
  - consolida total, ativos, orcamento, progresso medio, marcos/tarefas
    vencidas e projetos criticos.
- `GET /projects/indicators`
  - retorna apenas indicadores visiveis para a area do usuario.

### Campos calculados

Cada projeto listado ou aberto no detalhe passa a incluir:

- `progressOverall`: progresso combinado de tarefas e marcos;
- `expectedProgress`: progresso esperado pela janela `startsAt`/`endsAt`;
- `scheduleVariance`: diferenca entre realizado e planejado;
- `pmoStatus`: `ON_TRACK`, `AT_RISK`, `CRITICAL` ou `FINALIZED`;
- `milestonesDone`;
- `milestonesOverdue`;
- `tasksOverdue`.

### Regra de status PMO

- `FINALIZED`: projeto finalizado ou cancelado.
- `CRITICAL`: fim previsto vencido, marco vencido ou tarefa vencida.
- `AT_RISK`: atraso maior que 15 pontos percentuais contra o planejado.
- `ON_TRACK`: demais casos.

### Seguranca

Projetos continuam isolados por `companyId`. Como o projeto nao possui area
propria, a area e herdada do indicador vinculado:

- projeto sem indicador e tratado como geral da empresa;
- projeto com indicador so aparece para areas autorizadas;
- opcoes de KPI em projetos tambem respeitam a area visivel;
- operacoes de escrita continuam usando `assertCanWrite` sobre a area do KPI.

## Frontend

### `/projects`

A pagina agora tem:

- cards PMO de ativos, marcos vencidos, orcamento ativo e progresso medio;
- painel lateral com projetos criticos/em risco;
- filtros por busca, status e indicador;
- URL sincronizada com filtros (`/projects?indicatorId=...`);
- cards com status do projeto, status PMO, marcos, tarefas vencidas e variacao
  contra o planejado.

### `/projects/[id]`

O detalhe ganhou um bloco "Status PMO" com:

- classificacao PMO;
- progresso planejado;
- variacao;
- marcos vencidos;
- tarefas vencidas.

### Mapa estrategico

O drawer lateral do objetivo estrategico agora abre projetos com contexto de
indicador quando houver KPI vinculado:

```text
/projects?indicatorId=<id>
```

Com isso, o executivo pode sair do objetivo, ver o KPI relacionado e abrir
diretamente o recorte PMO de iniciativas daquele indicador.

## Testes

Cobertura focada em `ProjectsService`:

- filtro por area preservando projetos gerais;
- filtros por indicador, status e busca;
- portfolio consolidado e projeto critico;
- portfolio respeitando filtros;
- opcoes de KPI restritas por area;
- isolamento multiempresa no detalhe, update, criacao e operacoes de
  marcos/tarefas.

Comando focado:

```bash
pnpm --filter @g360/api exec vitest run src/modules/projects
```
