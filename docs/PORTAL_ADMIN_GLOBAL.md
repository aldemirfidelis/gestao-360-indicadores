# Portal Admin Global

O Portal Admin Global e o ambiente interno da plataforma Gestao 360. Ele fica separado do portal operacional das empresas e usa rota, login, sessao, RBAC e auditoria proprios.

## Rotas

- Frontend: `/platform-admin`
- Login interno: `/platform-admin/login`
- API base: `/api/platform-admin`
- Login API: `POST /api/platform-admin/auth/login`

As telas operacionais continuam no shell normal em `app/(app)/*`. O portal global nao usa o menu operacional nem o token `g360.accessToken`; ele usa os tokens `g360.platformAdmin.accessToken` e `g360.platformAdmin.refreshToken`.

## Login de desenvolvimento

O seed cria um usuario interno:

- E-mail: `platform@demo.com`
- Senha: `admin123`
- Papel: `PLATFORM_OWNER`

Este usuario existe em `PlatformAdminUser`, separado da tabela operacional `User`.

## Acesso em producao (bootstrap automatico)

Em producao o deploy roda apenas `prisma migrate deploy` (o seed e destrutivo e
NAO roda). Para o login separado funcionar mesmo sem seed, a API executa um
bootstrap idempotente no boot (`PlatformAdminBootstrapService`) que:

- cria/reconcilia o catalogo de permissoes internas;
- cria os papeis de sistema que ainda nao existem (sem sobrescrever customizacoes);
- cria um `PLATFORM_OWNER` inicial somente quando nao ha nenhum usuario interno.

As credenciais iniciais vem das variaveis de ambiente:

- `PLATFORM_ADMIN_BOOTSTRAP_EMAIL` (padrao `platform@gestao360.org`)
- `PLATFORM_ADMIN_BOOTSTRAP_PASSWORD` (se vazio, gera senha forte e imprime uma vez no log)
- `PLATFORM_ADMIN_BOOTSTRAP_NAME` (padrao `Platform Owner`)
- `PLATFORM_ADMIN_BOOTSTRAP_DISABLED=1` desliga o bootstrap

Apos o primeiro acesso, troque a senha e crie usuarios internos adicionais pela
propria administracao. Tokens internos usam `JWT_ACCESS_SECRET` com a claim
`kind: 'platform-admin'`, isolados por tabela e sessao dos tokens operacionais.

## Fundacao criada

A migration `20260606193000_platform_admin_global` adiciona tabelas para:

- Usuarios internos, papeis, permissoes e sessoes: `PlatformAdminUser`, `PlatformAdminRole`, `PlatformAdminPermission`, `PlatformAdminSession`.
- Auditoria e acessos internos: `PlatformAuditLog`, `PlatformAccessLog`.
- Empresas, perfis, historico, contratos e planos: `PlatformCompanyProfile`, `PlatformCompanyStatusHistory`, `PlatformPlan`, `PlatformContract`.
- Catalogo e matriz de modulos: `PlatformModuleCatalog`, `PlatformCompanyModule`, `PlatformCompanyModuleHistory`.
- Suporte, feature flags, ambientes, releases, backups, integracoes, jobs e health checks.

## Permissoes internas

As permissoes seguem o padrao solicitado, por exemplo:

- `platform.companies.view`
- `platform.companies.create`
- `platform.companies.edit`
- `platform.companies.suspend`
- `platform.modules.view`
- `platform.modules.manage`
- `platform.users.view`
- `platform.users.manage`
- `platform.audit_logs.view`
- `platform.database.health`
- `platform.support_mode.start`
- `platform.feature_flags.manage`
- `platform.maintenance.manage`
- `platform.internal_users.manage`

O wildcard `platform.*` existe apenas para `PLATFORM_OWNER`.

## Bloqueio real de modulos

A matriz de modulos por empresa grava estados em `PlatformCompanyModule`.

Estados bloqueantes como `BLOQUEADO` e `SUSPENSO`:

- Nao apagam dados ja cadastrados.
- Removem o item do menu via `PortalConfigService`.
- Bloqueiam acesso direto a rotas/API pelo `PortalGateGuard`.
- Mantem historico em `PlatformCompanyModuleHistory`.
- Permitem reativacao futura.

`SOMENTE_LEITURA` permite `GET` e bloqueia operacoes de escrita.

## Auditoria

Toda acao sensivel do portal global registra:

- Usuario interno.
- Papeis.
- Permissao associada.
- Empresa e modulo afetados, quando aplicavel.
- Valor anterior e novo valor.
- Justificativa.
- Sessao, ambiente e correlacao.

Os logs criticos sao append-only pela interface: nao ha rota de exclusao para `PlatformAuditLog`.

## Decisoes arquiteturais

- O portal global foi criado como novo modulo NestJS (`platform-admin`) para nao misturar autenticacao interna com usuarios de empresa.
- A administracao existente em `/settings/portal` foi preservada como central do portal operacional.
- O projeto ja usa PostgreSQL; a nova camada segue o mesmo Prisma/migrations.
- O isolamento multiempresa operacional continua baseado em `companyId`; a matriz de modulos adiciona uma camada contratual por empresa.
- O modo de suporte cria sessoes controladas e somente leitura por padrao, sem usar senha de cliente.

## Validacoes executadas

- `pnpm --filter @g360/api prisma:generate`
- `pnpm --filter @g360/api build`
- `pnpm --filter @g360/web exec tsc --noEmit`
- `pnpm --filter @g360/api exec vitest run src/modules/platform-admin/platform-admin.access.spec.ts`

O build completo do Next (`pnpm --filter @g360/web build`) nao retornou erro, mas excedeu o timeout local de 5 minutos neste ambiente; a validacao de tipos do frontend passou.
