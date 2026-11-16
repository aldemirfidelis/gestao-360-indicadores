# Projetos e curva S — 16/11/2026

## Diagnóstico

O módulo continuava no código e na API. O commit
[`6003cf1`](https://github.com/aldemirfidelis/gestao-360-indicadores/commit/6003cf189b439dc31f3bffbb8e70d68475b314a1)
transformou `/projects` na Ata da Reunião e preservou o portfólio em
`/projects/cronograma`, fora do menu. A curva S existente pertencia às ações
da Ata, não ao cadastro de projetos. O PMO foi implementado em
[`591529b`](https://github.com/aldemirfidelis/gestao-360-indicadores/commit/591529b0625c62694067eb5b51af45d3b21ace42).
O histórico foi conferido localmente e pelo conector do GitHub.

## Alterações preparadas

- Menu principal **Projetos**, separado da Ata; portfólio, orçamento, filtros,
  Gantt, marcos, tarefas e vínculo com indicador reutilizam o módulo existente.
- Curva S no detalhe `/projects/[id]`: planejado, realizado, diferença em
  pontos percentuais e exportação CSV.
- O planejado considera avanço linear no período de cada tarefa e o prazo de
  cada marco. Datas ausentes nas tarefas usam as datas do projeto. Sem tarefas
  e marcos, usa-se o período do projeto. Cronograma incompleto não gera um
  planejado fictício. O PMO usa a mesma regra do gráfico.
- O critério do realizado foi preservado: média das tarefas e proporção dos
  marcos concluídos; se existem os dois grupos, cada grupo pesa 50%.
- Medições diárias no fuso `America/Sao_Paulo`, na mesma transação da mudança
  de avanço, inclusive quando uma tarefa é concluída pelo quadro de Tarefas.
  Um bloqueio do projeto serializa escritores simultâneos. A última atualização
  do dia substitui a medição desse dia; dias anteriores permanecem preservados.
- O histórico começa na ativação da migração para projetos existentes e na
  criação via API para novos projetos. O realizado anterior não é inventado;
  não há realizado futuro. Alterar o cronograma recalcula o planejado, sem
  mudar as medições passadas do realizado.
- Edição respeita `projects:update`; demonstração e consulta têm controles
  desabilitados. O serviço mantém o isolamento por empresa e área e restringe
  campos editáveis. Dependências precisam pertencer ao mesmo projeto e não
  podem criar ciclos. O atalho do Meu Dia agora abre o detalhe correto.

## Banco e publicação

A migração aditiva `20261116120000_project_progress_snapshots` cria apenas
`ProjectProgressSnapshot` e sua primeira medição. Não exclui nem modifica
projetos, tarefas ou marcos existentes. É necessário backup antes de publicá-la.
Não executar seeds para ativar o módulo.

Publicado com autorização do usuário em 16/11/2026: commit `b120801`, versão
`0.1.0+b120801a`, com a migração aplicada e 155 migrations em dia. API, web e
Postgres saudáveis. Backup validado e detalhes registrados na memória
operacional. A base atual não tem projetos cadastrados; a lista vazia é
esperada. Alterações locais anteriores foram preservadas.

## Validação

- Shared: 31 testes; API, serviços de projetos/Tarefas/Meu Dia: 31 testes;
  web: 113 testes. Lint dos arquivos web alterados sem avisos ou erros.
- Prisma gerado e schema validado. Builds Docker de API e web executados
  sequencialmente em cópia isolada na Vultr; checagem de tipos incluída.
- As 155 migrações aplicaram em Postgres 17 vazio e descartável. O ensaio
  `scripts/check-projects.cjs` usa apenas dados fictícios e valida medição
  inicial, avanço, marcos, empresa, concorrência, dependências, quadro de
  Tarefas e rollback da transação quando a medição falha.
- Sem teste em navegador ou typecheck local da API, conforme a preferência
  registrada na memória. O banco descartável usa tmpfs e é removido ao final;
  nenhum volume de produção é usado.

O script de integração só aceita o banco `g360_projects_review` em `localhost`,
com `PROJECTS_REVIEW_ISOLATED=1`; executa dentro da imagem de revisão na rede
do Postgres descartável. Ele cria fixtures e não deve ser usado em outro alvo.
