# Arvore Organizacional: detalhes e responsabilidades

## Comportamento funcional

- A tela `/org` continua sendo a experiencia principal da arvore.
- Clicar em um item da arvore abre um painel flutuante do lado esquerdo com dados do setor, responsavel, hierarquia, contadores e responsabilidades.
- A edicao do item organizacional fica separada no botao `Editar`; o clique no nome nao abre mais o formulario.
- Usuarios com permissao de gestao podem cadastrar blocos de responsabilidades e topicos diretamente no painel.
- Usuarios sem permissao de gestao visualizam os dados e as responsabilidades sem botoes de manutencao.

## Modelo de dados

As responsabilidades ficam em tabelas reutilizaveis por qualquer unidade organizacional:

- `organizational_unit_activities`: bloco de atividade/responsabilidade vinculado a `OrgNode`.
- `organizational_unit_activity_items`: topicos ou subatividades do bloco.

Ambas as tabelas usam soft delete por `deleted_at`, ordenacao por `order_index` e trilha de usuario criador/atualizador.

## APIs

- `GET /orgnodes/:id`: detalhe completo do setor, incluindo breadcrumb, contadores e responsabilidades.
- `POST /orgnodes/:id/activities`
- `PATCH /orgnodes/:id/activities/:activityId`
- `DELETE /orgnodes/:id/activities/:activityId`
- `POST /orgnodes/:id/activities/:activityId/items`
- `PATCH /orgnodes/:id/activities/:activityId/items/:itemId`
- `DELETE /orgnodes/:id/activities/:activityId/items/:itemId`

As mutacoes exigem `org:manage`, perfil administrativo e validacao de escrita via `AccessService`.

## Dados iniciais

A migration `20260610120000_org_unit_activities_details` cria as tabelas, carrega responsabilidades padrao para unidades de Remuneracao existentes e tenta limpar, de forma auditavel, o no invalido da GOIASA "Area nao classificada" e o filho "Setor - Victor Rafael de Assis Claudino" quando nao ha dependencias bloqueantes.
