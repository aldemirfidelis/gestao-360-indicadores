# Seguranca Patrimonial e Portarias

## Cenario anterior

O Gestao 360 ja possuia multiempresa, filiais, arvore organizacional, permissoes, Portal Admin, auditoria, Meu Dia, formularios/checklists, documentos, dashboards e menu corporativo. Nao havia, porem, um modulo especifico para a rotina de portarias, visitantes, prestadores, veiculos, materiais, rondas, ocorrencias e troca de turno.

O controle de acesso fisico dependeria de cadastros paralelos, planilhas, livros fisicos ou adaptacoes de outros modulos, sem uma trilha operacional unica para responder quem esta dentro da unidade, quem deveria ter saido, quais documentos estao vencidos, quais rondas atrasaram e quais itens ficaram pendentes.

## Cenario final

Foi criada a base corporativa do modulo `asset-security` com:

- pacote comercial ativavel por empresa/unidade no catalogo do Portal Admin;
- permissoes granulares `asset-security:*` vinculadas aos perfis existentes;
- item unico "Seguranca Patrimonial" dentro do menu Gestao, com abas internas para operacao, pessoas/veiculos, autorizacoes, rondas, ativos e configuracoes;
- modelo de dados proprio para portarias, postos, pessoas, prestadores, veiculos, documentos obrigatorios, autorizacoes, movimentos, materiais, chaves/crachas, correspondencias, bloqueios, ocorrencias, rondas, troca de turno, livro eletronico, QR Codes, sincronizacao offline e auditoria;
- API NestJS protegida por `PortalGate`, `@RequirePermissions` e escopo multiempresa;
- tela operacional em `/seguranca-patrimonial`;
- portal externo publico em `/portal-seguranca/[token]` para pre-cadastro de convidados/prestadores;
- exportacao CSV e relatorios operacionais basicos;
- integracao com Meu Dia por pendencias de autorizacao, saida prevista, devolucao de chave/cracha, rondas e ocorrencias;
- trilha de auditoria no log especifico do modulo e no `AuditLog` corporativo.

## Integracoes reutilizadas

- `Company`, `Branch` e `OrgNode` para multiempresa, filiais, unidades e areas.
- `User` e `permission-catalog` para perfis e autorizacoes.
- `Portal Admin` para ativacao comercial, feature flags e bloqueio por modulo.
- `FormTemplate` como base de formularios/checklists aplicaveis.
- `WorkItemIndex` para Meu Dia e pendencias operacionais.
- `AuditLog` para historico corporativo.
- componentes web existentes (`PageHeader`, `MetricCard`, `Card`, `Button`, `Dialog`, `Input`, `NativeSelect`, `Textarea`).

## Principais rotas

Base protegida: `/api/asset-security`

- `GET /summary`, `GET /options`, `GET/PATCH /package`
- `GET/POST/PATCH /gates`
- `GET/POST/PATCH /posts`
- `GET/POST/PATCH /people`
- `GET/POST/PATCH /contractor-companies`
- `GET/POST/PATCH /vehicles`
- `GET/POST/PATCH /document-requirements`
- `GET/POST/PATCH /authorizations`
- `POST /authorizations/:id/approve`
- `POST /authorizations/:id/reject`
- `POST /authorizations/:id/external-invite`
- `GET /movements`, `GET /present`, `GET /pending-exits`
- `POST /movements/entry`, `POST /movements/exit`
- `GET /emergency-report`
- `GET/POST/PATCH /materials`
- `GET/POST/PATCH /custody-items`
- `POST /custody-items/:id/loan`, `POST /custody-items/:id/return`
- `GET/POST/PATCH /correspondences`
- `POST /correspondences/:id/pickup`
- `GET/POST/PATCH /blocklist`
- `GET/POST/PATCH /incidents`, `POST /incidents/:id/close`
- `GET/POST/PATCH /round-routes`
- `POST /round-routes/:id/checkpoints`
- `GET/POST/PATCH /round-executions`
- `POST /round-executions/:id/checkpoints/:checkpointId/visit`
- `POST /round-executions/:id/finish`
- `GET/POST/PATCH /shift-handovers`, `POST /shift-handovers/:id/complete`
- `GET/POST /logbook`
- `POST /qrcodes`, `POST /qrcodes/:token/validate`
- `GET/POST /offline-sync`
- `GET /assistant-insights`, `GET /export`

Base publica:

- `GET /api/asset-security/external/:token`
- `PATCH /api/asset-security/external/:token`

## Banco de dados

Migration criada: `apps/api/prisma/migrations/20260610100000_asset_security_portarias/migration.sql`.

A migration e aditiva: cria enums, tabelas, indices e chaves estrangeiras sem remover tabelas ou colunas existentes. O schema Prisma tambem recebeu os modelos correspondentes. Para reduzir interferencia em modelos centrais grandes, os novos modelos usam chaves escalares no Prisma e a integridade referencial principal fica na migration SQL.

## Riscos e impactos

- O build web conclui compilacao, tipos e geracao de paginas, mas no Windows local falhou no passo final de `output: 'standalone'` por `EPERM` ao criar symlinks em `.next/standalone`. Isso depende de permissao de symlink/Developer Mode do ambiente.
- `prisma migrate deploy` foi tentado no banco configurado em `.env`, mas foi bloqueado antes da migration deste modulo por drift preexistente em `20260608180000_vision360_automations` (`RelationshipLink` ja existe). A migration `20260610100000_asset_security_portarias` segue pendente para aplicacao apos resolver o historico anterior.
- A migration deve ser aplicada em ambiente de homologacao antes de producao, com backup do banco e validacao de volume em `SecurityAccessMovement`.
- O portal externo registra dados estruturados do convite, mas anexos binarios reais devem ser conectados ao storage corporativo em uma proxima etapa.
- O modo offline possui endpoint de sincronizacao e rastreio de conflitos; PWA/mobile dedicado ainda depende da frente mobile/offline do produto.
- Workflows avancados, templates de alerta e integracoes fisicas com catracas/cameras ficam preparados no modelo, mas exigem conectores especificos por cliente.

## Validacoes executadas

- `pnpm --filter @g360/api exec prisma validate`
- `pnpm --filter @g360/api prisma:generate`
- `pnpm --filter @g360/api test -- src/modules/asset-security/asset-security.service.spec.ts`
- `pnpm --filter @g360/api build`
- `pnpm --filter @g360/web exec tsc --noEmit`
- `pnpm --filter @g360/web build` compilou e gerou paginas, mas falhou no empacotamento standalone por `EPERM` de symlink no Windows.
- `pnpm --filter @g360/api prisma:deploy` bloqueado por drift preexistente em migration anterior, antes de aplicar `asset_security_portarias`.
