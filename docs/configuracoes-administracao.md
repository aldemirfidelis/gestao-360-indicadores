# Central administrativa de Configurações

Está documentação descreve a área de Configurações do Gestão 360, criada para que o Super Admin administre a estrutura base do sistema pela propria interface, sem depender de alterações diretas no código.

## Objetivo

A aba **Configurações** concentra os cadastros e regras estruturais usados por empresas com varias unidades, filiais, gestores, setores, indicadores, planos de ação e necessidade de rastreabilidade.

Os módulos disponíveis sao:

- **Usuários**: cadastro, perfil, status, senha, vínculo organizacional e permissões.
- **Auditoria**: rastreio de ações sensiveis, filtros, detalhe e exportação.
- **Parametros**: empresas, filiais, estrutura, categorias e itens parametrizaveis.
- **Seguranca**: perfis de acesso e permissões por módulo.
- **Sistema**: parametros gerais, notificações, aprovações e regras globais.

## Acesso e seguranca

A área administrativa exige usuário autenticado e perfil administrativo.

Perfis minimos:

- **Super Admin**: acesso total ao sistema e a todas as empresas.
- **Admin**: acesso administrativo conforme permissões.
- **Gestor**: acesso a indicadores, planos e acompanhamentos da sua estrutura.
- **Usuário**: acesso operacional.
- **Visualizador**: acesso somente leitura.

As permissões ficam gravadas no banco em `Permission`, `AccessProfile`, `ProfilePermission` e `UserPermission`. O sistema válida permissão no backend usando `@RequirePermissions(...)`, alem dos papeis administrativos.

Permissões principais:

- `settings:view`: visualizar Configurações.
- `settings:manage`: criar, editar, inativar e excluir logicamente parametros.
- `users:manage`: manipular usuários, perfis e permissões.
- `audit:view`: visualizar auditoria.
- `audit:export`: exportar auditoria.
- Permissões operacionais para indicadores, resultados, planos, reuniões, estratégia, OKRs, importação e notificações.

Usuários sem permissão nao devem acessar Configurações, Usuários, Auditoria, Parametros ou Seguranca.

## Usuários

O módulo de Usuários permite:

- Listar todos os usuários da empresa.
- Pesquisar por nome, e-mail, perfil, filial, setor ou status.
- Criar e editar usuários.
- Alterar senha ou marcar redefinicao obrigatoria.
- Ativar, inativar, bloquear ou deixar pendente.
- Vincular empresa, filial, área, setor, cargo e perfil de acesso.
- Definir permissões diretas por usuário.
- Consultar último acesso e status.
- Excluir logicamente usuários quando necessário.

Campos relevantes no banco:

- `User.status`: `ACTIVE`, `INACTIVE`, `BLOCKED` ou `PENDING`.
- `User.active`: usado para bloqueio operacional rapido.
- `User.branchId`: vínculo com filial.
- `User.defaultNodeId`: vínculo com área/setor/processo.
- `User.accessProfileId`: perfil administrativo ou operacional.
- `User.passwordResetRequired`: exige troca de senha no próximo fluxo de acesso.
- `User.deletedAt`: exclusão lógica.

## Auditoria

A auditoria registra automaticamente ações sensiveis no backend.

Eventos registrados:

- Criação, edição, exclusão lógica e alteração de permissão.
- Login e logout.
- Alteração de parametros, perfis, usuários e cadastros estruturais.
- Resultado da ação: sucesso ou erro.

Campos principais:

- Usuário que realizou a ação.
- Data e hora.
- Tipo da ação.
- Módulo afetado.
- Entidade e registro afetado.
- Valor anterior e valor novo quando disponível.
- Payload resumido e dados de sessão.
- IP e user-agent quando disponíveis.
- Resultado da operação.

Na interface e possível filtrar por usuário, período, módulo, tipo de ação e texto livre. Também e possível abrir o detalhe completo e exportar CSV. A impressao em PDF fica disponível pelo navegador.

## Parametros

O módulo de Parametros remove cadastros fixos do código e os centraliza no banco.

Categorias suportadas:

- Empresas, filiais, unidades, setores, áreas, subareas, cargos e departamentos.
- Centros de custo, processos e macroprocessos.
- Diretrizes e pilares estratégicos.
- Tipos e categorias de indicadores.
- Periodicidades, unidades de medida e tipos de metas.
- Status de indicadores e planos de ação.
- Criticidades, prioridades e tipos de reunião.
- Tipos e metodos de análise de causa, como 5 Porques, Ishikawa, Pareto, PDCA, FCA, MASP e DMAIC.
- Modelos de plano de ação e tipos de evidencia.
- Parametros de notificação, aprovação e parametros gerais.

Cada categoria e item possui:

- Código unico.
- Nome.
- Descrição.
- Status ativo, inativo ou arquivado.
- Data e usuário de criação.
- Data e usuário da última alteração.
- Exclusão lógica.
- Histórico por auditoria.

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
> Área
> Setor
> Subsetor
> Processo
> Indicadores
> Análise de causa
> Reunião
> Plano de ação
> Execucao
> Acompanhamento
```

O cadastro de estrutura usa `OrgNode` com tipos como `UNIT`, `AREA`, `SUBAREA`, `SECTOR`, `SUBSECTOR`, `DEPARTMENT`, `COST_CENTER`, `MACROPROCESS` e `PROCESS`.

Regras importantes:

- Uma empresa pode ter varias filiais.
- Uma filial pode ter varias unidades.
- Uma unidade pode ter varias áreas.
- Uma área pode ter varios setores.
- Um setor pode ter indicadores.
- Indicadores podem gerar análises, reuniões e planos de ação.
- Planos podem ter responsáveis, prazos, evidencias e acompanhamento.

Itens em uso nao devem ser excluidos fisicamente. Quando houver dependências, o sistema deve impedir a exclusão e orientar inativação ou remocao dos vínculos.

## APIs administrativas

Principais rotas:

- `GET /admin/bootstrap`: carrega dados iniciais da central administrativa.
- `GET /admin/permissions`: lista catalogo de permissões.
- `POST/PATCH/DELETE /admin/companies`: CRUD lógico de empresas.
- `POST/PATCH/DELETE /admin/branches`: CRUD lógico de filiais.
- `POST/PATCH/DELETE /admin/parameters/categories`: categorias de parametros.
- `POST/PATCH/DELETE /admin/parameters/items`: itens de parametros.
- `POST/PATCH/DELETE /admin/security/profiles`: perfis de acesso.
- `PATCH /admin/security/profiles/:id/permissions`: permissões do perfil.
- `PUT /admin/system/settings`: parametros gerais.
- `GET /audit`: consulta de auditoria com filtros.
- `GET /audit/entries/:id`: detalhe da ação auditada.
- `GET /audit/exports/csv`: exportação CSV.
- `GET/POST/PATCH/DELETE /users`: administracao de usuários.

## Migrations

A migration `20260522143000_admin_settings_parameters` adiciona:

- Status de acesso de usuário.
- Status administrativo de cadastros.
- Novos tipos de no organizacional.
- Perfis de acesso e permissões por perfil.
- Categorias e itens parametrizaveis.
- Campos ampliados de auditoria.
- Campos ampliados de parametros do sistema.
- Vínculos de usuário com filial e perfil de acesso.

## Operação recomendada

1. Acessar como Super Admin ou Admin com permissões.
2. Abrir **Configurações**.
3. Conferir ou criar empresas e filiais.
4. Montar a estrutura organizacional em Parametros.
5. Criar perfis em Seguranca e atribuir permissões.
6. Criar usuários e vincular empresa, filial, setor e perfil.
7. Validar a auditoria após criacoes, edicoes, inativacoes e alterações de permissão.
8. Manter parametros de negócio no banco para evitar novas alterações de código em cadastros basicos.

## Observacoes de manutenção

- A exclusão fisica deve ser evitada para cadastros estruturais.
- A exclusão lógica usa `deletedAt` ou status `ARCHIVED`.
- Duplicidades sao bloqueadas por chaves unicas e validações de serviço.
- Novas categorias podem ser criadas pela interface sem alteração de código.
- O catalogo padrão e criado automaticamente no primeiro acesso ao bootstrap administrativo.
- O build de produção deve ser feito no Droplet DigitalOcean, conforme fluxo de deploy do projeto.
