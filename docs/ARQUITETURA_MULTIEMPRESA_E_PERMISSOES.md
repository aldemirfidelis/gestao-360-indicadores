# Arquitetura Multiempresa e Permissões por Área — Gestão 360

> Status: Fases A, B e C entregues e verificadas. Itens marcados _(follow-up)_ seguem o
> mesmo padrão já estabelecido e podem ser estendidos incrementalmente.

## 1. Visão geral
O Gestão 360 é **SaaS multiempresa**: cada empresa é um ambiente isolado. O isolamento
**entre empresas** já existia no modelo de dados (todo registro operacional tem `companyId`
no agregado pai; filhos herdam via relação). Sobre isso foi adicionado o **controle de
visibilidade por área** (matriz + exceções + atribuições) com enforcement no backend.

Dois eixos de acesso, independentes:
1. **Empresa** (`companyId`) — derivado SEMPRE da sessão autenticada, nunca do corpo da requisição.
2. **Área** (`OrgNode`) — resolvido pelo `AccessService` a partir das áreas do usuário + matriz + exceções.

## 2. Isolamento entre empresas
- `companyId` em todos os agregados (`Indicator`, `ActionPlan`, `Deviation`, `Meeting`, `Project`,
  `OrgNode`, `Notification`, `AuditLog`, …). Registros-folha (resultados, tarefas, mensagens)
  herdam a empresa pelo pai — **não denormalizamos** `companyId` nessas tabelas.
- O backend obtém `companyId` da sessão (`AuthPayload.companyId`); o frontend nunca é fonte confiável.
  Exceção: `SUPER_ADMIN` pode passar `companyId` explicitamente (impersonação auditável).
- **Suspensão de empresa**: `Company.status` (`ACTIVE|SUSPENDED|INACTIVE`). `auth.service.login`,
  `auth.service.refresh` e `JwtStrategy.validate` recusam usuários cuja empresa não esteja `ACTIVE`
  (efeito na próxima requisição, sem esperar o token expirar).

## 3. Modelo de dados (novo)
Áreas/setores = `OrgNode` (já existente). Área principal do usuário = `User.defaultNodeId`.

| Tabela | Papel |
|---|---|
| `Company.status` + campos cadastrais + `areaAccessEnabled` | status/suspensão e flag de restrição por área (default `true`) |
| `UserAreaAssignment` | vínculos usuário↔área (PRIMARY/SECONDARY/TEMPORARY/VIEWER, com validade) |
| `AreaVisibilityRule` | matriz: origem→destino por módulo, nível + flags can{View,Create,Edit,Delete,Approve,Export} |
| `UserVisibilityException` | exceção individual ALLOW/DENY por área/módulo, com validade e justificativa |

Migrations: `20260603100000_company_status_fields`, `20260603110000_area_visibility` (aditivas).
Backfill idempotente: `apps/api/prisma/backfill-area-access.ts` (cria "Área não classificada" por
empresa, dá área principal a quem não tinha, registra atribuições PRIMARY).

## 4. Perfis e bypass
- `SUPER_ADMIN`, `COMPANY_ADMIN` → **companyWide** (enxergam/editam toda a empresa; bypass de área).
- `DIRECTOR` → vê toda a empresa em **leitura/exportação**, mas escreve só na própria área (salvo regra/exceção).
- `MANAGER`/`ANALYST`/`COLLABORATOR`/`VIEWER` → restritos por área (própria área + o que a matriz/exceção liberar).
- As **chaves de permissão** existentes (`module:action`, ex. `indicators:create`) continuam definindo
  QUAIS ações; o **escopo de área** (próprio/permitido) é resolvido em separado pelo `AccessService`.

## 5. AccessService (`apps/api/src/modules/access/`)
- `access.logic.ts` (puro, testado): `resolveAreaScope` e `levelForArea`. **Ordem de prioridade**:
  `(1) DENY exceção > (2) ALLOW exceção > (3) regra de perfil _(follow-up)_ > (4) matriz de área > (5) própria área`.
  Conflito ⇒ mais restritivo, salvo ALLOW explícito.
- `access.service.ts`: `getContext` (cache 10s), `permittedAreaIds(userId, module, action)` (`string[] | 'ALL'`),
  `listAreaFilter` (expande com **descendentes** na árvore de OrgNode), `canWriteArea`/`assertCanWrite`,
  `assertSameCompany`, `visibilityLevel`. Negações geram `AuditLog` `result=DENIED`.
- `companyWide` ou `areaAccessEnabled=false` ⇒ `'ALL'` (sem restrição) — não quebra empresas que não usam áreas.

## 6. Enforcement aplicado
- **Indicadores** (`indicators.service`): `list` filtra por área; `getById` bloqueia área não permitida e
  retorna **projeção RESUMIDA** quando o nível é `SUMMARY` (nome/status/meta/realizado/farol/tendência/nº ações/%);
  `create/update/remove` exigem permissão de escrita na área.
- **Planos de ação** (`actions.service`): `list` filtra por área; `create/update/remove` exigem escrita na área.
- _(follow-up)_ Desvios/Análise de causa, Mapa Estratégico, Reuniões, Projetos, Relatórios: aplicar o
  mesmo par `access.listAreaFilter(...)` (leitura) + `access.assertCanWrite(...)` (escrita) usando o campo de
  área de cada agregado (deviation→indicator.ownerNodeId, objetivo→ownerNodeId, etc.).

## 7. APIs
- **Plataforma (Super Admin)** `@Roles(SUPER_ADMIN)`: `GET /platform/overview`, `GET/POST /platform/companies`,
  `GET/PATCH /platform/companies/:id`, `PATCH /platform/companies/:id/status`.
- **Acesso (Admin da Empresa)** `@Roles(COMPANY_ADMIN, SUPER_ADMIN)` + `users:manage`, escopo = empresa da sessão:
  `GET /access/areas|modules`, `GET/POST/DELETE /access/matrix`, `GET/POST/DELETE /access/exceptions`,
  `GET/POST/DELETE /access/users/:id/areas`, `PATCH /access/users/:id/primary-area`,
  `GET /access/simulate/:userId` (mostra view/edit por módulo + contexto).

## 8. Frontend
- `/plataforma` (Super Admin): dashboard global + empresas (CRUD/status). Menu "Administração Geral"
  (perm `platform:admin`, nunca concedida ⇒ só Super Admin).
- `/settings/visibilidade` (Admin): **Matriz de Visibilidade** (regras com legenda de cores),
  **Simular acesso** (por usuário, por módulo) e **gestão de áreas** do usuário. Gate `users:manage`.
- Esconder botões é só UX — toda regra é validada no backend.

## 9. Rotas protegidas (resumo)
`ROUTE_PERMISSIONS` em `apps/web/components/shell/navigation.ts`: `/plataforma`→`platform:admin`,
`/settings/visibilidade`→`users:manage`. Backend: guards globais `JwtAuthGuard`+`RolesGuard` +
`AccessService` nos serviços do núcleo.

## 10. Auditoria
`AuditLog` registra mudanças (empresa, matriz, atribuições, exceções, indicadores/ações) com
`beforeValue`/`afterValue`/`module`/`entity`/`result`, **incluindo tentativas negadas** (`result=DENIED`).

## 11. Migração e compatibilidade
Migrations aditivas (nada apagado). Empresa atual = padrão (dados já com `companyId`). Backfill cria
"Área não classificada" e atribui áreas. `areaAccessEnabled` nasce `true`; `SUPER_ADMIN/COMPANY_ADMIN`
fazem bypass — a empresa atual não trava. Para desligar a restrição numa empresa, basta
`areaAccessEnabled=false` (tela de empresas).

## 12. Como testar
- Unitário: `pnpm -C apps/api test` (inclui `access.logic.spec.ts`).
- Cenários do spec: 2 empresas isoladas (login/queries não cruzam); RH edita só RH e vê Segurança só com
  regra na matriz; nível `SUMMARY` ⇒ cards sem causa/evidência; diretor vê tudo e não edita; exceção
  temporária expira por `validUntil`; usuário/empresa inativos bloqueiam login.
- Verificação contínua: `tsc`, `nest build`, ESLint, smoke read-only na Neon.

## 13. Decisões técnicas
- Enforcement na **camada de serviço** (AccessService), não em RLS — funciona com o pool da Neon/Prisma.
  **RLS = evolução futura** (exigiria `SET` de contexto por requisição).
- Reuso de `OrgNode` como área (sem tabelas `areas/sectors` novas) e do RBAC existente.
- FKs escalares nas tabelas de visibilidade (integridade na camada de serviço) para isolar a mudança.

## 14. Arquivos principais alterados/criados
- API: `prisma/schema.prisma` (+enums/tabelas), migrations `20260603100000`/`20260603110000`,
  `prisma/backfill-area-access.ts`, `modules/platform/*`, `modules/access/*`,
  `modules/auth/{auth.service,jwt.strategy}.ts`, `modules/indicators/indicators.{service,controller}.ts`,
  `modules/actions/actions.{service,controller}.ts`, `app.module.ts`.
- Web: `app/(app)/plataforma/page.tsx`, `app/(app)/settings/visibilidade/page.tsx`,
  `components/shell/navigation.ts`.

## 15. Pendências (follow-up)
- Estender enforcement a desvios/estratégia/reuniões/projetos/relatórios (mesmo padrão).
- Regras de matriz por **perfil** (hoje: por área + exceções por usuário).
- Assistente de onboarding de empresa (9 etapas).
- RLS no Postgres como camada complementar.
- Testes e2e dos 6 cenários em banco isolado.
