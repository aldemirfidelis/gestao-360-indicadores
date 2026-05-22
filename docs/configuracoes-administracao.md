# Central administrativa de Configuracoes

Esta documentacao descreve a area de Configuracoes do Gestao 360, criada para que o Super Admin administre a estrutura base do sistema pela propria interface, sem depender de alteracoes diretas no codigo.

## Objetivo

A aba **Configuracoes** concentra os cadastros e regras estruturais usados por empresas com varias unidades, filiais, gestores, setores, indicadores, planos de acao e necessidade de rastreabilidade.

Os modulos disponiveis sao:

- **Usuarios**: cadastro, perfil, status, senha, vinculo organizacional e permissoes.
- **Auditoria**: rastreio de acoes sensiveis, filtros, detalhe e exportacao.
- **Parametros**: empresas, filiais, estrutura, categorias e itens parametrizaveis.
- **Seguranca**: perfis de acesso e permissoes por modulo.
- **Sistema**: parametros gerais, notificacoes, aprovacoes e regras globais.

## Acesso e seguranca

A area administrativa exige usuario autenticado e perfil administrativo.

Perfis minimos:

- **Super Admin**: acesso total ao sistema e a todas as empresas.
- **Admin**: acesso administrativo conforme permissoes.
- **Gestor**: acesso a indicadores, planos e acompanhamentos da sua estrutura.
- **Usuario**: acesso operacional.
- **Visualizador**: acesso somente leitura.

As permissoes ficam gravadas no banco em `Permission`, `AccessProfile`, `ProfilePermission` e `UserPermission`. O sistema valida permissao no backend usando `@RequirePermissions(...)`, alem dos papeis administrativos.

Permissoes principais:

- `settings:view`: visualizar Configuracoes.
- `settings:manage`: criar, editar, inativar e excluir logicamente parametros.
- `users:manage`: manipular usuarios, perfis e permissoes.
- `audit:view`: visualizar auditoria.
- `audit:export`: exportar auditoria.
- Permissoes operacionais para indicadores, resultados, planos, reunioes, estrategia, OKRs, importacao e notificacoes.

Usuarios sem permissao nao devem acessar Configuracoes, Usuarios, Auditoria, Parametros ou Seguranca.

## Usuarios

O modulo de Usuarios permite:

- Listar todos os usuarios da empresa.
- Pesquisar por nome, e-mail, perfil, filial, setor ou status.
- Criar e editar usuarios.
- Alterar senha ou marcar redefinicao obrigatoria.
- Ativar, inativar, bloquear ou deixar pendente.
- Vincular empresa, filial, area, setor, cargo e perfil de acesso.
- Definir permissoes diretas por usuario.
- Consultar ultimo acesso e status.
- Excluir logicamente usuarios quando necessario.

Campos relevantes no banco:

- `User.status`: `ACTIVE`, `INACTIVE`, `BLOCKED` ou `PENDING`.
- `User.active`: usado para bloqueio operacional rapido.
- `User.branchId`: vinculo com filial.
- `User.defaultNodeId`: vinculo com area/setor/processo.
- `User.accessProfileId`: perfil administrativo ou operacional.
- `User.passwordResetRequired`: exige troca de senha no proximo fluxo de acesso.
- `User.deletedAt`: exclusao logica.

## Auditoria

A auditoria registra automaticamente acoes sensiveis no backend.

Eventos registrados:

- Criacao, edicao, exclusao logica e alteracao de permissao.
- Login e logout.
- Alteracao de parametros, perfis, usuarios e cadastros estruturais.
- Resultado da acao: sucesso ou erro.

Campos principais:

- Usuario que realizou a acao.
- Data e hora.
- Tipo da acao.
- Modulo afetado.
- Entidade e registro afetado.
- Valor anterior e valor novo quando disponivel.
- Payload resumido e dados de sessao.
- IP e user-agent quando disponiveis.
- Resultado da operacao.

Na interface e possivel filtrar por usuario, periodo, modulo, tipo de acao e texto livre. Tambem e possivel abrir o detalhe completo e exportar CSV. A impressao em PDF fica disponivel pelo navegador.

## Parametros

O modulo de Parametros remove cadastros fixos do codigo e os centraliza no banco.

Categorias suportadas:

- Empresas, filiais, unidades, setores, areas, subareas, cargos e departamentos.
- Centros de custo, processos e macroprocessos.
- Diretrizes e pilares estrategicos.
- Tipos e categorias de indicadores.
- Periodicidades, unidades de medida e tipos de metas.
- Status de indicadores e planos de acao.
- Criticidades, prioridades e tipos de reuniao.
- Tipos e metodos de analise de causa, como 5 Porques, Ishikawa, Pareto, PDCA, FCA, MASP e DMAIC.
- Modelos de plano de acao e tipos de evidencia.
- Parametros de notificacao, aprovacao e parametros gerais.

Cada categoria e item possui:

- Codigo unico.
- Nome.
- Descricao.
- Status ativo, inativo ou arquivado.
- Data e usuario de criacao.
- Data e usuario da ultima alteracao.
- Exclusao logica.
- Historico por auditoria.

Tabelas principais:

- `ParameterCategory`: agrupa um tipo de parametro.
- `ParameterItem`: armazena os itens cadastrados pelo Super Admin.
- `AppSetting`: guarda regras e parametros gerais do sistema.

## Hierarquia organizacional

A estrutura organizacional usa empresas, filiais e nos organizacionais.

Hierarquia esperada:

```text
Empresa
> Filial
> Unidade
> Area
> Setor
> Subsetor
> Processo
> Indicadores
> Analise de causa
> Reuniao
> Plano de acao
> Execucao
> Acompanhamento
```

O cadastro de estrutura usa `OrgNode` com tipos como `UNIT`, `AREA`, `SUBAREA`, `SECTOR`, `SUBSECTOR`, `DEPARTMENT`, `COST_CENTER`, `MACROPROCESS` e `PROCESS`.

Regras importantes:

- Uma empresa pode ter varias filiais.
- Uma filial pode ter varias unidades.
- Uma unidade pode ter varias areas.
- Uma area pode ter varios setores.
- Um setor pode ter indicadores.
- Indicadores podem gerar analises, reunioes e planos de acao.
- Planos podem ter responsaveis, prazos, evidencias e acompanhamento.

Itens em uso nao devem ser excluidos fisicamente. Quando houver dependencias, o sistema deve impedir a exclusao e orientar inativacao ou remocao dos vinculos.

## APIs administrativas

Principais rotas:

- `GET /admin/bootstrap`: carrega dados iniciais da central administrativa.
- `GET /admin/permissions`: lista catalogo de permissoes.
- `POST/PATCH/DELETE /admin/companies`: CRUD logico de empresas.
- `POST/PATCH/DELETE /admin/branches`: CRUD logico de filiais.
- `POST/PATCH/DELETE /admin/parameters/categories`: categorias de parametros.
- `POST/PATCH/DELETE /admin/parameters/items`: itens de parametros.
- `POST/PATCH/DELETE /admin/security/profiles`: perfis de acesso.
- `PATCH /admin/security/profiles/:id/permissions`: permissoes do perfil.
- `PUT /admin/system/settings`: parametros gerais.
- `GET /audit`: consulta de auditoria com filtros.
- `GET /audit/entries/:id`: detalhe da acao auditada.
- `GET /audit/exports/csv`: exportacao CSV.
- `GET/POST/PATCH/DELETE /users`: administracao de usuarios.

## Migrations

A migration `20260522143000_admin_settings_parameters` adiciona:

- Status de acesso de usuario.
- Status administrativo de cadastros.
- Novos tipos de no organizacional.
- Perfis de acesso e permissoes por perfil.
- Categorias e itens parametrizaveis.
- Campos ampliados de auditoria.
- Campos ampliados de parametros do sistema.
- Vinculos de usuario com filial e perfil de acesso.

## Operacao recomendada

1. Acessar como Super Admin ou Admin com permissoes.
2. Abrir **Configuracoes**.
3. Conferir ou criar empresas e filiais.
4. Montar a estrutura organizacional em Parametros.
5. Criar perfis em Seguranca e atribuir permissoes.
6. Criar usuarios e vincular empresa, filial, setor e perfil.
7. Validar a auditoria apos criacoes, edicoes, inativacoes e alteracoes de permissao.
8. Manter parametros de negocio no banco para evitar novas alteracoes de codigo em cadastros basicos.

## Observacoes de manutencao

- A exclusao fisica deve ser evitada para cadastros estruturais.
- A exclusao logica usa `deletedAt` ou status `ARCHIVED`.
- Duplicidades sao bloqueadas por chaves unicas e validacoes de servico.
- Novas categorias podem ser criadas pela interface sem alteracao de codigo.
- O catalogo padrao e criado automaticamente no primeiro acesso ao bootstrap administrativo.
- O build de producao deve ser feito no Droplet DigitalOcean, conforme fluxo de deploy do projeto.
