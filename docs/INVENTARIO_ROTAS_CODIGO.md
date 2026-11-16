# Inventário extraído do código

Referência: 16/11/2026, árvore local da implementação SIPOC/BPMN/RACI. Gerado por `node scripts/generate-functional-inventory.cjs`.

Foram encontrados **61 diretórios de módulos**, **1747 operações HTTP decoradas**, **201 páginas**, **544 modelos Prisma** e **156 migrations**. Contagens descrevem fonte, não recursos licenciados ou publicados.

A coluna Suspensa compara o caminho com `product-scope.json`. Além disso, dependem de carregamento do módulo, licença, PortalGate, JWT, permissões, escopo de área e estado do registro. Prefixos/decoradores calculados exigem consulta ao arquivo. APIs internas de infraestrutura podem continuar carregadas em módulos parcialmente suspensos. Não é uma prova de que cada endpoint foi testado.

## API por módulo

Todos os caminhos recebem `/api` no servidor. Permissões múltiplas do decorator usam OR; as verificações específicas dos serviços continuam aplicáveis.

### access

Fonte: [diretório](../apps/api/src/modules/access). 13 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/access/modules` | 'users:manage' | Não | [controller](../apps/api/src/modules/access/access-admin.controller.ts#L20) |
| GET | `/access/areas` | 'users:manage' | Não | [controller](../apps/api/src/modules/access/access-admin.controller.ts#L25) |
| GET | `/access/users/:userId/areas` | 'users:manage' | Não | [controller](../apps/api/src/modules/access/access-admin.controller.ts#L30) |
| POST | `/access/users/:userId/areas` | 'users:manage' | Não | [controller](../apps/api/src/modules/access/access-admin.controller.ts#L35) |
| DELETE | `/access/users/:userId/areas/:orgNodeId` | 'users:manage' | Não | [controller](../apps/api/src/modules/access/access-admin.controller.ts#L40) |
| PATCH | `/access/users/:userId/primary-area` | 'users:manage' | Não | [controller](../apps/api/src/modules/access/access-admin.controller.ts#L45) |
| GET | `/access/matrix` | 'users:manage' | Não | [controller](../apps/api/src/modules/access/access-admin.controller.ts#L50) |
| POST | `/access/matrix` | 'users:manage' | Não | [controller](../apps/api/src/modules/access/access-admin.controller.ts#L55) |
| DELETE | `/access/matrix/:id` | 'users:manage' | Não | [controller](../apps/api/src/modules/access/access-admin.controller.ts#L60) |
| GET | `/access/exceptions` | 'users:manage' | Não | [controller](../apps/api/src/modules/access/access-admin.controller.ts#L65) |
| POST | `/access/exceptions` | 'users:manage' | Não | [controller](../apps/api/src/modules/access/access-admin.controller.ts#L70) |
| DELETE | `/access/exceptions/:id` | 'users:manage' | Não | [controller](../apps/api/src/modules/access/access-admin.controller.ts#L75) |
| GET | `/access/simulate/:userId` | 'users:manage' | Não | [controller](../apps/api/src/modules/access/access-admin.controller.ts#L80) |

### actions

Fonte: [diretório](../apps/api/src/modules/actions). 30 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/actions` | 'actions:view' | Não | [controller](../apps/api/src/modules/actions/actions.controller.ts#L14) |
| GET | `/actions/options` | 'actions:view' | Não | [controller](../apps/api/src/modules/actions/actions.controller.ts#L45) |
| GET | `/actions/general-approvals` | 'actions:view', 'actions:delete', 'actions:approve', 'actions:manage' | Sim | [controller](../apps/api/src/modules/actions/actions.controller.ts#L51) |
| GET | `/actions/evidences/:evidenceId` | 'actions:view' | Não | [controller](../apps/api/src/modules/actions/actions.controller.ts#L60) |
| GET | `/actions/:id` | 'actions:view' | Não | [controller](../apps/api/src/modules/actions/actions.controller.ts#L66) |
| POST | `/actions` | 'actions:create' | Não | [controller](../apps/api/src/modules/actions/actions.controller.ts#L72) |
| PATCH | `/actions/:id` | 'actions:update' | Não | [controller](../apps/api/src/modules/actions/actions.controller.ts#L81) |
| PATCH | `/actions/:id/status` | 'actions:update' | Não | [controller](../apps/api/src/modules/actions/actions.controller.ts#L87) |
| POST | `/actions/:id/meeting` | 'meetings:create', 'actions:update' | Não | [controller](../apps/api/src/modules/actions/actions.controller.ts#L97) |
| POST | `/actions/:id/tasks` | 'actions:update' | Não | [controller](../apps/api/src/modules/actions/actions.controller.ts#L107) |
| PATCH | `/actions/tasks/:taskId` | 'actions:update' | Não | [controller](../apps/api/src/modules/actions/actions.controller.ts#L129) |
| DELETE | `/actions/tasks/:taskId` | 'actions:update' | Não | [controller](../apps/api/src/modules/actions/actions.controller.ts#L148) |
| POST | `/actions/:id/delete-request` | 'actions:update', 'actions:delete' | Não | [controller](../apps/api/src/modules/actions/actions.controller.ts#L154) |
| PATCH | `/actions/general-approvals/:requestId/decision` | 'actions:delete', 'actions:approve', 'actions:manage' | Sim | [controller](../apps/api/src/modules/actions/actions.controller.ts#L160) |
| POST | `/actions/:id/analysis` | 'actions:analysis' | Não | [controller](../apps/api/src/modules/actions/actions.controller.ts#L170) |
| POST | `/actions/:id/analysis/ishikawa/ai-suggestions` | 'actions:ai' | Não | [controller](../apps/api/src/modules/actions/actions.controller.ts#L176) |
| POST | `/actions/:id/analysis/ishikawa/causes/:causeId/convert-to-action` | 'actions:update', 'actions:analysis' | Não | [controller](../apps/api/src/modules/actions/actions.controller.ts#L182) |
| POST | `/actions/:id/analysis/pdca/ai-suggestions` | 'actions:ai' | Não | [controller](../apps/api/src/modules/actions/actions.controller.ts#L193) |
| POST | `/actions/:id/analysis/pdca/stages/:stageId/convert-to-action` | 'actions:update', 'actions:analysis' | Não | [controller](../apps/api/src/modules/actions/actions.controller.ts#L199) |
| POST | `/actions/:id/analysis/5w2h/ai-suggestions` | 'actions:ai' | Não | [controller](../apps/api/src/modules/actions/actions.controller.ts#L210) |
| POST | `/actions/:id/analysis/5w2h/items/:itemType/convert-to-action` | 'actions:update', 'actions:analysis' | Não | [controller](../apps/api/src/modules/actions/actions.controller.ts#L216) |
| POST | `/actions/:id/analysis/five-whys/ai-suggestions` | 'actions:ai' | Não | [controller](../apps/api/src/modules/actions/actions.controller.ts#L227) |
| POST | `/actions/:id/analysis/five-whys/items/:level/convert-to-action` | 'actions:update', 'actions:analysis' | Não | [controller](../apps/api/src/modules/actions/actions.controller.ts#L233) |
| POST | `/actions/:id/evidences` | 'actions:update' | Não | [controller](../apps/api/src/modules/actions/actions.controller.ts#L244) |
| POST | `/actions/:id/comments` | 'actions:update' | Não | [controller](../apps/api/src/modules/actions/actions.controller.ts#L250) |
| POST | `/actions/:id/effectiveness/request` | 'actions:update' | Não | [controller](../apps/api/src/modules/actions/actions.controller.ts#L256) |
| POST | `/actions/:id/effectiveness` | 'actions:effectiveness' | Não | [controller](../apps/api/src/modules/actions/actions.controller.ts#L262) |
| POST | `/actions/:id/ai-assist` | 'actions:ai' | Não | [controller](../apps/api/src/modules/actions/actions.controller.ts#L268) |
| PATCH | `/actions/ai-suggestions/:id` | 'actions:ai' | Não | [controller](../apps/api/src/modules/actions/actions.controller.ts#L274) |
| DELETE | `/actions/:id` | 'actions:delete' | Não | [controller](../apps/api/src/modules/actions/actions.controller.ts#L280) |

### admin

Fonte: [diretório](../apps/api/src/modules/admin). 19 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/admin/bootstrap` | 'settings:view', 'settings:manage', 'users:view', 'users:profiles', 'users:manage', 'audit:view' | Não | [controller](../apps/api/src/modules/admin/admin.controller.ts#L15) |
| GET | `/admin/permissions` | 'users:permissions', 'users:profiles', 'users:manage' | Não | [controller](../apps/api/src/modules/admin/admin.controller.ts#L21) |
| POST | `/admin/companies` | 'settings:manage' | Não | [controller](../apps/api/src/modules/admin/admin.controller.ts#L27) |
| PATCH | `/admin/companies/:id` | 'settings:manage' | Não | [controller](../apps/api/src/modules/admin/admin.controller.ts#L32) |
| DELETE | `/admin/companies/:id` | 'settings:manage' | Não | [controller](../apps/api/src/modules/admin/admin.controller.ts#L37) |
| POST | `/admin/branches` | 'settings:manage' | Não | [controller](../apps/api/src/modules/admin/admin.controller.ts#L42) |
| PATCH | `/admin/branches/:id` | 'settings:manage' | Não | [controller](../apps/api/src/modules/admin/admin.controller.ts#L47) |
| DELETE | `/admin/branches/:id` | 'settings:manage' | Não | [controller](../apps/api/src/modules/admin/admin.controller.ts#L52) |
| POST | `/admin/parameters/categories` | 'settings:manage' | Não | [controller](../apps/api/src/modules/admin/admin.controller.ts#L57) |
| PATCH | `/admin/parameters/categories/:id` | 'settings:manage' | Não | [controller](../apps/api/src/modules/admin/admin.controller.ts#L62) |
| DELETE | `/admin/parameters/categories/:id` | 'settings:manage' | Não | [controller](../apps/api/src/modules/admin/admin.controller.ts#L67) |
| POST | `/admin/parameters/items` | 'settings:manage' | Não | [controller](../apps/api/src/modules/admin/admin.controller.ts#L72) |
| PATCH | `/admin/parameters/items/:id` | 'settings:manage' | Não | [controller](../apps/api/src/modules/admin/admin.controller.ts#L77) |
| DELETE | `/admin/parameters/items/:id` | 'settings:manage' | Não | [controller](../apps/api/src/modules/admin/admin.controller.ts#L82) |
| POST | `/admin/security/profiles` | 'users:profiles', 'users:manage' | Não | [controller](../apps/api/src/modules/admin/admin.controller.ts#L87) |
| PATCH | `/admin/security/profiles/:id` | 'users:profiles', 'users:manage' | Não | [controller](../apps/api/src/modules/admin/admin.controller.ts#L93) |
| PATCH | `/admin/security/profiles/:id/permissions` | 'users:profiles', 'users:manage' | Não | [controller](../apps/api/src/modules/admin/admin.controller.ts#L99) |
| DELETE | `/admin/security/profiles/:id` | 'users:profiles', 'users:manage' | Não | [controller](../apps/api/src/modules/admin/admin.controller.ts#L105) |
| PUT | `/admin/system/settings` | 'settings:manage' | Não | [controller](../apps/api/src/modules/admin/admin.controller.ts#L111) |

### ai

Fonte: [diretório](../apps/api/src/modules/ai). 3 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/ai/status` | 'ai:status' | Não | [controller](../apps/api/src/modules/ai/ai.controller.ts#L15) |
| GET | `/ai/indicators/:id/context` | 'ai:use' | Não | [controller](../apps/api/src/modules/ai/ai.controller.ts#L21) |
| POST | `/assistant/help` | 'ai:use' | Não | [controller](../apps/api/src/modules/ai/assistant.controller.ts#L60) |

### asset-security

Fonte: [diretório](../apps/api/src/modules/asset-security). 83 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| POST | `/asset-security/hardware/access-request` | 'asset-security:edit' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L14) |
| POST | `/asset-security/hardware/event-log` | 'asset-security:edit' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L20) |
| GET | `/asset-security/roll-call` | 'asset-security:view' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L26) |
| GET | `/asset-security/summary` | 'asset-security:view' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L32) |
| GET | `/asset-security/options` | 'asset-security:view' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L38) |
| GET | `/asset-security/package` | 'asset-security:manage' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L44) |
| PATCH | `/asset-security/package` | 'asset-security:manage' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L50) |
| GET | `/asset-security/gates` | 'asset-security:view' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L56) |
| POST | `/asset-security/gates` | 'asset-security:create' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L62) |
| PATCH | `/asset-security/gates/:id` | 'asset-security:update' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L68) |
| GET | `/asset-security/posts` | 'asset-security:view' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L74) |
| POST | `/asset-security/posts` | 'asset-security:create' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L80) |
| PATCH | `/asset-security/posts/:id` | 'asset-security:update' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L86) |
| GET | `/asset-security/people` | 'asset-security:view' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L92) |
| GET | `/asset-security/people/lookup` | 'asset-security:view' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L98) |
| POST | `/asset-security/people` | 'asset-security:create' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L104) |
| POST | `/asset-security/people/import` | 'asset-security:create' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L110) |
| PATCH | `/asset-security/people/:id` | 'asset-security:update' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L116) |
| GET | `/asset-security/contractor-companies` | 'asset-security:view' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L122) |
| POST | `/asset-security/contractor-companies` | 'asset-security:create' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L128) |
| PATCH | `/asset-security/contractor-companies/:id` | 'asset-security:update' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L134) |
| GET | `/asset-security/vehicles` | 'asset-security:view' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L140) |
| POST | `/asset-security/vehicles` | 'asset-security:create' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L146) |
| PATCH | `/asset-security/vehicles/:id` | 'asset-security:update' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L152) |
| GET | `/asset-security/document-requirements` | 'asset-security:view' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L158) |
| POST | `/asset-security/document-requirements` | 'asset-security:manage' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L164) |
| PATCH | `/asset-security/document-requirements/:id` | 'asset-security:manage' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L170) |
| GET | `/asset-security/authorizations` | 'asset-security:view' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L176) |
| POST | `/asset-security/authorizations` | 'asset-security:authorize' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L182) |
| PATCH | `/asset-security/authorizations/:id` | 'asset-security:authorize' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L188) |
| POST | `/asset-security/authorizations/:id/approve` | 'asset-security:approve' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L194) |
| POST | `/asset-security/authorizations/:id/reject` | 'asset-security:approve' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L200) |
| POST | `/asset-security/authorizations/:id/external-invite` | 'asset-security:authorize' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L206) |
| GET | `/asset-security/movements` | 'asset-security:view' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L212) |
| GET | `/asset-security/present` | 'asset-security:view' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L218) |
| GET | `/asset-security/pending-exits` | 'asset-security:view' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L224) |
| POST | `/asset-security/movements/entry` | 'asset-security:entry' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L230) |
| POST | `/asset-security/movements/exit` | 'asset-security:exit' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L236) |
| GET | `/asset-security/materials` | 'asset-security:view' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L242) |
| POST | `/asset-security/materials` | 'asset-security:update' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L248) |
| PATCH | `/asset-security/materials/:id` | 'asset-security:update' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L254) |
| GET | `/asset-security/custody-items` | 'asset-security:view' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L260) |
| POST | `/asset-security/custody-items` | 'asset-security:update' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L266) |
| PATCH | `/asset-security/custody-items/:id` | 'asset-security:update' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L272) |
| POST | `/asset-security/custody-items/:id/loan` | 'asset-security:update' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L278) |
| POST | `/asset-security/custody-items/:id/return` | 'asset-security:update' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L284) |
| GET | `/asset-security/correspondences` | 'asset-security:view' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L290) |
| POST | `/asset-security/correspondences` | 'asset-security:update' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L296) |
| PATCH | `/asset-security/correspondences/:id` | 'asset-security:update' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L302) |
| POST | `/asset-security/correspondences/:id/pickup` | 'asset-security:update' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L308) |
| GET | `/asset-security/blocklist` | 'asset-security:view' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L314) |
| POST | `/asset-security/blocklist` | 'asset-security:block' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L320) |
| PATCH | `/asset-security/blocklist/:id` | 'asset-security:block' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L326) |
| GET | `/asset-security/incidents` | 'asset-security:view' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L332) |
| POST | `/asset-security/incidents` | 'asset-security:incident' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L338) |
| PATCH | `/asset-security/incidents/:id` | 'asset-security:incident' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L344) |
| POST | `/asset-security/incidents/:id/close` | 'asset-security:incident' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L350) |
| GET | `/asset-security/round-routes` | 'asset-security:view' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L356) |
| POST | `/asset-security/round-routes` | 'asset-security:rounds' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L362) |
| PATCH | `/asset-security/round-routes/:id` | 'asset-security:rounds' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L368) |
| POST | `/asset-security/round-routes/:id/checkpoints` | 'asset-security:rounds' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L374) |
| PATCH | `/asset-security/round-checkpoints/:checkpointId` | 'asset-security:rounds' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L380) |
| GET | `/asset-security/round-executions` | 'asset-security:view' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L386) |
| POST | `/asset-security/round-executions` | 'asset-security:rounds' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L392) |
| PATCH | `/asset-security/round-executions/:id` | 'asset-security:rounds' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L398) |
| POST | `/asset-security/round-executions/:id/visit` | 'asset-security:rounds' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L404) |
| POST | `/asset-security/round-executions/:id/finish` | 'asset-security:rounds' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L410) |
| POST | `/asset-security/round-checkpoints/:checkpointId/scan` | 'asset-security:rounds' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L417) |
| GET | `/asset-security/shift-handovers` | 'asset-security:view' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L423) |
| POST | `/asset-security/shift-handovers` | 'asset-security:handover' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L429) |
| PATCH | `/asset-security/shift-handovers/:id` | 'asset-security:handover' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L435) |
| POST | `/asset-security/shift-handovers/:id/complete` | 'asset-security:handover' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L441) |
| GET | `/asset-security/logbook` | 'asset-security:view' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L447) |
| POST | `/asset-security/logbook` | 'asset-security:update' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L453) |
| GET | `/asset-security/qrcodes/validate/:token` | 'asset-security:qrcode' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L459) |
| POST | `/asset-security/qrcodes` | 'asset-security:qrcode' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L465) |
| GET | `/asset-security/offline-sync` | 'asset-security:offline' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L471) |
| POST | `/asset-security/offline-sync` | 'asset-security:offline' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L477) |
| GET | `/asset-security/assistant-insights` | 'asset-security:view' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L483) |
| GET | `/asset-security/audit-logs` | 'asset-security:manage' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L489) |
| GET | `/asset-security/export` | 'asset-security:export' | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L495) |
| GET | `/asset-security/external/:token` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L501) |
| PATCH | `/asset-security/external/:token` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/asset-security/asset-security.controller.ts#L507) |

### audit

Fonte: [diretório](../apps/api/src/modules/audit). 0 operações encontradas.

Serviços/infraestrutura sem controller HTTP direto neste diretório.

### audits

Fonte: [diretório](../apps/api/src/modules/audits). 49 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/audits` | 'audits:view' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L11) |
| GET | `/audits/summary` | 'audits:view', 'audits:dashboard' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L26) |
| GET | `/audits/dashboard` | 'audits:view', 'audits:dashboard' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L32) |
| GET | `/audits/options` | 'audits:view' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L38) |
| GET | `/audits/programs` | 'audits:view', 'audits:programs' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L44) |
| POST | `/audits/programs` | 'audits:programs', 'audits:create' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L50) |
| PATCH | `/audits/programs/:programId` | 'audits:programs', 'audits:update' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L56) |
| GET | `/audits/universe` | 'audits:view', 'audits:universe' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L62) |
| POST | `/audits/universe` | 'audits:universe', 'audits:create' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L68) |
| PATCH | `/audits/universe/:itemId` | 'audits:universe', 'audits:update' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L74) |
| GET | `/audits/risk-criteria` | 'audits:view', 'audits:universe' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L80) |
| POST | `/audits/risk-criteria` | 'audits:universe', 'audits:manage' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L86) |
| PATCH | `/audits/risk-criteria/:criterionId` | 'audits:universe', 'audits:manage' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L92) |
| GET | `/audits/types` | 'audits:view', 'audits:types' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L98) |
| POST | `/audits/types` | 'audits:types', 'audits:manage' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L104) |
| PATCH | `/audits/types/:typeId` | 'audits:types', 'audits:manage' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L110) |
| GET | `/audits/auditors` | 'audits:view', 'audits:auditors' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L116) |
| POST | `/audits/auditors` | 'audits:auditors', 'audits:manage' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L122) |
| PATCH | `/audits/auditors/:auditorId` | 'audits:auditors', 'audits:manage' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L128) |
| POST | `/audits/auditors/suggest` | 'audits:view', 'audits:auditors' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L134) |
| GET | `/audits/standards` | 'audits:view', 'audits:standards' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L140) |
| POST | `/audits/standards` | 'audits:standards', 'audits:manage' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L146) |
| PATCH | `/audits/standards/:standardId` | 'audits:standards', 'audits:manage' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L152) |
| GET | `/audits/checklist-templates` | 'audits:view', 'audits:checklists' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L158) |
| POST | `/audits/checklist-templates` | 'audits:checklists', 'audits:manage' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L164) |
| PATCH | `/audits/checklist-templates/:templateId` | 'audits:checklists', 'audits:manage' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L170) |
| POST | `/audits/checklist-executions/:executionId/responses` | 'audits:execute', 'audits:update' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L176) |
| POST | `/audits/checklist-executions/:executionId/complete` | 'audits:execute', 'audits:update' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L182) |
| PATCH | `/audits/reports/:reportId/decision` | 'audits:approve', 'audits:update' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L188) |
| PATCH | `/audits/follow-ups/:followUpId` | 'audits:followup', 'audits:update' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L194) |
| PATCH | `/audits/ai/suggestions/:suggestionId/decision` | 'audits:ai', 'audits:update' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L200) |
| POST | `/audits` | 'audits:create' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L206) |
| GET | `/audits/:id` | 'audits:view' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L212) |
| PATCH | `/audits/:id` | 'audits:update' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L218) |
| DELETE | `/audits/:id` | 'audits:delete' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L224) |
| POST | `/audits/:id/transition` | 'audits:update' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L230) |
| POST | `/audits/:id/start` | 'audits:execute', 'audits:update' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L236) |
| POST | `/audits/:id/complete` | 'audits:close', 'audits:update' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L242) |
| POST | `/audits/:id/reopen` | 'audits:reopen', 'audits:update' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L248) |
| POST | `/audits/:id/checklists` | 'audits:execute', 'audits:update' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L254) |
| GET | `/audits/:id/evidence` | 'audits:view', 'audits:evidence' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L260) |
| POST | `/audits/:id/evidence` | 'audits:evidence', 'audits:update' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L266) |
| POST | `/audits/:id/report` | 'audits:reports', 'audits:update' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L272) |
| POST | `/audits/:id/follow-ups` | 'audits:followup', 'audits:update' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L278) |
| POST | `/audits/:id/ai/suggestions` | 'audits:ai', 'audits:update' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L284) |
| POST | `/audits/:id/findings` | 'audits:findings', 'audits:update' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L290) |
| PATCH | `/audits/findings/:findingId` | 'audits:findings', 'audits:update' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L296) |
| DELETE | `/audits/findings/:findingId` | 'audits:findings', 'audits:update' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L302) |
| POST | `/audits/findings/:findingId/nonconformity` | 'audits:findings', 'audits:update' | Sim | [controller](../apps/api/src/modules/audits/audits.controller.ts#L308) |

### auth

Fonte: [diretório](../apps/api/src/modules/auth). 6 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| POST | `/auth/login` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/auth/auth.controller.ts#L43) |
| POST | `/auth/refresh` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/auth/auth.controller.ts#L57) |
| POST | `/auth/demo` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/auth/auth.controller.ts#L64) |
| POST | `/auth/logout` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/auth/auth.controller.ts#L71) |
| GET | `/auth/me` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/auth/auth.controller.ts#L82) |
| PATCH | `/auth/me/password` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/auth/auth.controller.ts#L88) |

### automations

Fonte: [diretório](../apps/api/src/modules/automations). 32 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/automations/workflows` | 'automations:view' | Sim | [controller](../apps/api/src/modules/automations/automations.controller.ts#L29) |
| GET | `/automations/workflows/:id` | 'automations:view' | Sim | [controller](../apps/api/src/modules/automations/automations.controller.ts#L49) |
| POST | `/automations/workflows` | 'automations:manage' | Sim | [controller](../apps/api/src/modules/automations/automations.controller.ts#L62) |
| PUT | `/automations/workflows/:id` | 'automations:manage' | Sim | [controller](../apps/api/src/modules/automations/automations.controller.ts#L82) |
| DELETE | `/automations/workflows/:id` | 'automations:manage' | Sim | [controller](../apps/api/src/modules/automations/automations.controller.ts#L100) |
| POST | `/automations/workflows/:id/duplicate` | 'automations:manage' | Sim | [controller](../apps/api/src/modules/automations/automations.controller.ts#L109) |
| GET | `/automations/workflows/:id/versions` | 'automations:view' | Sim | [controller](../apps/api/src/modules/automations/automations.controller.ts#L153) |
| POST | `/automations/workflows/:id/versions` | 'automations:manage' | Sim | [controller](../apps/api/src/modules/automations/automations.controller.ts#L166) |
| GET | `/automations/workflow-versions/:id` | 'automations:view' | Sim | [controller](../apps/api/src/modules/automations/automations.controller.ts#L194) |
| POST | `/automations/workflow-versions/:id/validate` | 'automations:manage' | Sim | [controller](../apps/api/src/modules/automations/automations.controller.ts#L203) |
| POST | `/automations/workflow-versions/:id/simulate` | 'automations:manage' | Sim | [controller](../apps/api/src/modules/automations/automations.controller.ts#L216) |
| POST | `/automations/workflow-versions/:id/publish` | 'automations:publish' | Sim | [controller](../apps/api/src/modules/automations/automations.controller.ts#L235) |
| GET | `/automations/workflow-instances` | 'automations:view' | Sim | [controller](../apps/api/src/modules/automations/automations.controller.ts#L315) |
| GET | `/automations/workflow-instances/:id` | 'automations:view' | Sim | [controller](../apps/api/src/modules/automations/automations.controller.ts#L336) |
| POST | `/automations/workflow-instances/:id/retry` | 'automations:execute' | Sim | [controller](../apps/api/src/modules/automations/automations.controller.ts#L350) |
| POST | `/automations/workflow-instances/:id/cancel` | 'automations:execute' | Sim | [controller](../apps/api/src/modules/automations/automations.controller.ts#L376) |
| GET | `/automations/workflow-approvals` | 'automations:view' | Sim | [controller](../apps/api/src/modules/automations/automations.controller.ts#L389) |
| POST | `/automations/workflow-approvals/:id/approve` | 'automations:approve' | Sim | [controller](../apps/api/src/modules/automations/automations.controller.ts#L407) |
| POST | `/automations/workflow-approvals/:id/reject` | 'automations:approve' | Sim | [controller](../apps/api/src/modules/automations/automations.controller.ts#L437) |
| GET | `/automations/workflow-tasks` | 'automations:view' | Sim | [controller](../apps/api/src/modules/automations/automations.controller.ts#L471) |
| POST | `/automations/workflow-tasks/:id/complete` | 'automations:execute' | Sim | [controller](../apps/api/src/modules/automations/automations.controller.ts#L489) |
| GET | `/automations/dead-letters` | 'automations:admin' | Sim | [controller](../apps/api/src/modules/automations/automations.controller.ts#L527) |
| POST | `/automations/dead-letters/:id/resolve` | 'automations:admin' | Sim | [controller](../apps/api/src/modules/automations/automations.controller.ts#L541) |
| GET | `/automations/workflow-templates` | 'automations:view' | Sim | [controller](../apps/api/src/modules/automations/automations.controller.ts#L576) |
| POST | `/automations/workflow-templates/:id/use` | 'automations:manage' | Sim | [controller](../apps/api/src/modules/automations/automations.controller.ts#L592) |
| GET | `/automations/history` | 'automations:view' | Sim | [controller](../apps/api/src/modules/automations/automations.controller.ts#L638) |
| GET | `/automations/sla-policies` | 'automations:view' | Sim | [controller](../apps/api/src/modules/automations/automations.controller.ts#L748) |
| POST | `/automations/sla-policies` | 'automations:manage' | Sim | [controller](../apps/api/src/modules/automations/automations.controller.ts#L771) |
| PUT | `/automations/sla-policies/:id` | 'automations:manage' | Sim | [controller](../apps/api/src/modules/automations/automations.controller.ts#L793) |
| DELETE | `/automations/sla-policies/:id` | 'automations:manage' | Sim | [controller](../apps/api/src/modules/automations/automations.controller.ts#L814) |
| GET | `/automations/escalations` | 'automations:view' | Sim | [controller](../apps/api/src/modules/automations/automations.controller.ts#L821) |
| POST | `/automations/escalations/:taskId/extend` | 'automations:manage' | Sim | [controller](../apps/api/src/modules/automations/automations.controller.ts#L865) |

### closed-months

Fonte: [diretório](../apps/api/src/modules/closed-months). 3 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/closed-months` | 'settings:view' | Não | [controller](../apps/api/src/modules/closed-months/closed-months.controller.ts#L11) |
| POST | `/closed-months` | 'settings:manage' | Não | [controller](../apps/api/src/modules/closed-months/closed-months.controller.ts#L17) |
| DELETE | `/closed-months/:id` | 'settings:manage' | Não | [controller](../apps/api/src/modules/closed-months/closed-months.controller.ts#L23) |

### communication

Fonte: [diretório](../apps/api/src/modules/communication). 49 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/communication/conversations` | JWT/guardas de classe; conferir fonte | Sim | [controller](../apps/api/src/modules/communication/conversations/conversations.controller.ts#L15) |
| POST | `/communication/conversations/direct` | JWT/guardas de classe; conferir fonte | Sim | [controller](../apps/api/src/modules/communication/conversations/conversations.controller.ts#L20) |
| GET | `/communication/conversations/:id` | JWT/guardas de classe; conferir fonte | Sim | [controller](../apps/api/src/modules/communication/conversations/conversations.controller.ts#L25) |
| GET | `/communication/conversations/:id/messages` | JWT/guardas de classe; conferir fonte | Sim | [controller](../apps/api/src/modules/communication/conversations/conversations.controller.ts#L30) |
| POST | `/communication/conversations/:id/messages` | JWT/guardas de classe; conferir fonte | Sim | [controller](../apps/api/src/modules/communication/conversations/conversations.controller.ts#L40) |
| GET | `/communication/message-attachments/:id` | JWT/guardas de classe; conferir fonte | Sim | [controller](../apps/api/src/modules/communication/conversations/conversations.controller.ts#L45) |
| POST | `/communication/conversations/:id/read` | JWT/guardas de classe; conferir fonte | Sim | [controller](../apps/api/src/modules/communication/conversations/conversations.controller.ts#L50) |
| POST | `/communication/conversations/:id/mute` | JWT/guardas de classe; conferir fonte | Sim | [controller](../apps/api/src/modules/communication/conversations/conversations.controller.ts#L55) |
| POST | `/communication/conversations/:id/pin` | JWT/guardas de classe; conferir fonte | Sim | [controller](../apps/api/src/modules/communication/conversations/conversations.controller.ts#L60) |
| PATCH | `/communication/messages/:id` | JWT/guardas de classe; conferir fonte | Sim | [controller](../apps/api/src/modules/communication/conversations/conversations.controller.ts#L65) |
| DELETE | `/communication/messages/:id` | JWT/guardas de classe; conferir fonte | Sim | [controller](../apps/api/src/modules/communication/conversations/conversations.controller.ts#L70) |
| POST | `/communication/messages/:id/reactions` | JWT/guardas de classe; conferir fonte | Sim | [controller](../apps/api/src/modules/communication/conversations/conversations.controller.ts#L75) |
| DELETE | `/communication/messages/:id/reactions/:emoji` | JWT/guardas de classe; conferir fonte | Sim | [controller](../apps/api/src/modules/communication/conversations/conversations.controller.ts#L80) |
| GET | `/communication/directory` | 'directory:view' | Sim | [controller](../apps/api/src/modules/communication/directory/directory.controller.ts#L17) |
| GET | `/communication/directory/online` | 'directory:view' | Sim | [controller](../apps/api/src/modules/communication/directory/directory.controller.ts#L39) |
| GET | `/communication/users/:id/profile` | 'communication:view' | Sim | [controller](../apps/api/src/modules/communication/profile/profile.controller.ts#L13) |
| GET | `/communication/me/preferences` | 'communication:view' | Sim | [controller](../apps/api/src/modules/communication/profile/profile.controller.ts#L18) |
| PATCH | `/communication/me/profile` | 'communication:update' | Sim | [controller](../apps/api/src/modules/communication/profile/profile.controller.ts#L23) |
| PATCH | `/communication/me/status` | 'communication:update' | Sim | [controller](../apps/api/src/modules/communication/profile/profile.controller.ts#L29) |
| PATCH | `/communication/me/preferences` | 'communication:update' | Sim | [controller](../apps/api/src/modules/communication/profile/profile.controller.ts#L35) |
| GET | `/profile/me` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/communication/profile-infrastructure.controller.ts#L11) |
| PATCH | `/profile/me` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/communication/profile-infrastructure.controller.ts#L15) |
| GET | `/communication/feed` | 'communication:view' | Sim | [controller](../apps/api/src/modules/communication/publications/employee-feed.controller.ts#L17) |
| GET | `/communication/feed/pending` | 'communication:view' | Sim | [controller](../apps/api/src/modules/communication/publications/employee-feed.controller.ts#L23) |
| POST | `/communication/feed/:id/open` | 'communication:view' | Sim | [controller](../apps/api/src/modules/communication/publications/employee-feed.controller.ts#L30) |
| POST | `/communication/feed/:id/confirm` | 'communication:view' | Sim | [controller](../apps/api/src/modules/communication/publications/employee-feed.controller.ts#L36) |
| GET | `/communication/media` | 'communication:view' | Sim | [controller](../apps/api/src/modules/communication/publications/media-library.controller.ts#L12) |
| POST | `/communication/media` | 'communication:media', 'communication:manage' | Sim | [controller](../apps/api/src/modules/communication/publications/media-library.controller.ts#L18) |
| POST | `/communication/media/:id/replace` | 'communication:media', 'communication:manage' | Sim | [controller](../apps/api/src/modules/communication/publications/media-library.controller.ts#L24) |
| PATCH | `/communication/media/:id` | 'communication:media', 'communication:manage' | Sim | [controller](../apps/api/src/modules/communication/publications/media-library.controller.ts#L30) |
| DELETE | `/communication/media/:id` | 'communication:media', 'communication:manage' | Sim | [controller](../apps/api/src/modules/communication/publications/media-library.controller.ts#L36) |
| GET | `/communication/publications/overview` | 'communication:view' | Sim | [controller](../apps/api/src/modules/communication/publications/publications.controller.ts#L21) |
| GET | `/communication/publications` | 'communication:view' | Sim | [controller](../apps/api/src/modules/communication/publications/publications.controller.ts#L27) |
| GET | `/communication/publications/audience/options` | 'communication:view' | Sim | [controller](../apps/api/src/modules/communication/publications/publications.controller.ts#L34) |
| POST | `/communication/publications/audience/estimate` | 'communication:view' | Sim | [controller](../apps/api/src/modules/communication/publications/publications.controller.ts#L40) |
| GET | `/communication/publications/:id` | 'communication:view' | Sim | [controller](../apps/api/src/modules/communication/publications/publications.controller.ts#L46) |
| GET | `/communication/publications/:id/metrics` | 'communication:reports', 'communication:manage' | Sim | [controller](../apps/api/src/modules/communication/publications/publications.controller.ts#L52) |
| GET | `/communication/publications/:id/metrics.csv` | 'communication:export', 'communication:manage' | Sim | [controller](../apps/api/src/modules/communication/publications/publications.controller.ts#L58) |
| POST | `/communication/publications` | 'communication:create', 'communication:manage' | Sim | [controller](../apps/api/src/modules/communication/publications/publications.controller.ts#L67) |
| PATCH | `/communication/publications/:id` | 'communication:update', 'communication:update:any', 'communication:manage' | Sim | [controller](../apps/api/src/modules/communication/publications/publications.controller.ts#L73) |
| POST | `/communication/publications/:id/duplicate` | 'communication:create', 'communication:manage' | Sim | [controller](../apps/api/src/modules/communication/publications/publications.controller.ts#L79) |
| POST | `/communication/publications/:id/status` | 'communication:publish', 'communication:approve', 'communication:manage' | Sim | [controller](../apps/api/src/modules/communication/publications/publications.controller.ts#L86) |
| DELETE | `/communication/publications/:id` | 'communication:delete', 'communication:manage' | Sim | [controller](../apps/api/src/modules/communication/publications/publications.controller.ts#L92) |
| GET | `/communication/settings` | 'communication:view' | Sim | [controller](../apps/api/src/modules/communication/publications/publications.controller.ts#L104) |
| GET | `/communication/settings/categories` | 'communication:view' | Sim | [controller](../apps/api/src/modules/communication/publications/publications.controller.ts#L114) |
| PATCH | `/communication/settings` | 'communication:manage' | Sim | [controller](../apps/api/src/modules/communication/publications/publications.controller.ts#L120) |
| POST | `/communication/settings/categories` | 'communication:categories', 'communication:manage' | Sim | [controller](../apps/api/src/modules/communication/publications/publications.controller.ts#L126) |
| PATCH | `/communication/settings/categories/:id` | 'communication:categories', 'communication:manage' | Sim | [controller](../apps/api/src/modules/communication/publications/publications.controller.ts#L132) |
| DELETE | `/communication/settings/categories/:id` | 'communication:categories', 'communication:manage' | Sim | [controller](../apps/api/src/modules/communication/publications/publications.controller.ts#L138) |

### companies

Fonte: [diretório](../apps/api/src/modules/companies). 5 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/companies/me` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/companies/companies.controller.ts#L13) |
| GET | `/companies/me/branding` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/companies/companies.controller.ts#L22) |
| PATCH | `/companies/me/branding` | 'settings:manage' | Não | [controller](../apps/api/src/modules/companies/companies.controller.ts#L27) |
| GET | `/companies/me/branches` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/companies/companies.controller.ts#L36) |
| GET | `/companies/:id` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/companies/companies.controller.ts#L41) |

### company-admin

Fonte: [diretório](../apps/api/src/modules/company-admin). 4 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/company-admin/overview` | 'settings:view', 'settings:manage', 'users:view', 'users:profiles', 'users:manage', 'integrations:view', 'integrations:manage', 'company-data:view', 'company-data:export', 'audit:view', 'audit:export' | Não | [controller](../apps/api/src/modules/company-admin/company-admin.controller.ts#L12) |
| GET | `/company-admin/data` | 'company-data:view', 'company-data:export' | Não | [controller](../apps/api/src/modules/company-admin/company-admin.controller.ts#L18) |
| GET | `/company-admin/data/:dataset/export` | 'company-data:export' | Não | [controller](../apps/api/src/modules/company-admin/company-admin.controller.ts#L24) |
| GET | `/company-admin/data/:dataset` | 'company-data:view', 'company-data:export' | Não | [controller](../apps/api/src/modules/company-admin/company-admin.controller.ts#L32) |

### compensation

Fonte: [diretório](../apps/api/src/modules/compensation). 51 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/cargos-salarios/options` | ...VIEW | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L16) |
| GET | `/cargos-salarios/overview` | ...VIEW | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L22) |
| GET | `/cargos-salarios/estrutura-quadro` | ...VIEW | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L28) |
| POST | `/cargos-salarios/estrutura-quadro/solicitar-vaga` | ...MANAGE | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L34) |
| GET | `/cargos-salarios/hierarquia` | ...VIEW | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L40) |
| PATCH | `/cargos-salarios/hierarquia/:employeeId` | ...MANAGE | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L46) |
| GET | `/cargos-salarios/jobs` | ...VIEW | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L52) |
| POST | `/cargos-salarios/jobs` | 'compensation:jobs:create', ...MANAGE | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L58) |
| PATCH | `/cargos-salarios/jobs/:id` | 'compensation:jobs:update', ...MANAGE | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L64) |
| POST | `/cargos-salarios/jobs/:id/duplicate` | 'compensation:jobs:create', ...MANAGE | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L70) |
| POST | `/cargos-salarios/jobs/:id/version` | 'compensation:jobs:update', ...MANAGE | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L76) |
| PATCH | `/cargos-salarios/jobs/:id/inactivate` | 'compensation:jobs:update', ...MANAGE | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L82) |
| PATCH | `/cargos-salarios/jobs/:id/reactivate` | 'compensation:jobs:update', ...MANAGE | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L88) |
| GET | `/cargos-salarios/descriptions` | 'compensation:descriptions:view', ...VIEW | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L94) |
| POST | `/cargos-salarios/descriptions` | 'compensation:descriptions:update', ...MANAGE | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L100) |
| PATCH | `/cargos-salarios/descriptions/:id` | 'compensation:descriptions:update', ...MANAGE | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L106) |
| PATCH | `/cargos-salarios/descriptions/:id/status` | 'compensation:descriptions:approve', ...MANAGE | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L112) |
| GET | `/cargos-salarios/descriptions/:id/docx` | 'compensation:descriptions:view', ...VIEW | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L118) |
| POST | `/cargos-salarios/descriptions/:id/document` | 'compensation:descriptions:update', ...MANAGE | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L129) |
| GET | `/cargos-salarios/salary-tables` | 'compensation:salary-table:view', ...VIEW | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L135) |
| POST | `/cargos-salarios/salary-tables` | 'compensation:salary-table:update', ...MANAGE | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L141) |
| PATCH | `/cargos-salarios/salary-tables/:id` | 'compensation:salary-table:update', ...MANAGE | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L147) |
| POST | `/cargos-salarios/salary-tables/:id/ranges` | 'compensation:salary-table:update', ...MANAGE | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L153) |
| DELETE | `/cargos-salarios/salary-tables/:id` | 'compensation:salary-table:update', ...MANAGE | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L159) |
| GET | `/cargos-salarios/salary-lookup` | 'compensation:salary-table:view', ...VIEW | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L165) |
| POST | `/cargos-salarios/salary-tables/:id/publish` | 'compensation:salary-table:approve', ...MANAGE | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L171) |
| POST | `/cargos-salarios/salary-tables/:id/revision` | 'compensation:salary-table:update', ...MANAGE | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L177) |
| GET | `/cargos-salarios/enquadramento` | 'compensation:salary-fit:view', ...VIEW | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L183) |
| GET | `/cargos-salarios/equidade` | 'compensation:salary-fit:view', ...VIEW | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L189) |
| PATCH | `/cargos-salarios/employees/:id/profile` | ...MANAGE | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L195) |
| POST | `/cargos-salarios/employees/profile-import` | ...MANAGE | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L201) |
| GET | `/cargos-salarios/movements` | 'compensation:movements:view', ...VIEW | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L207) |
| POST | `/cargos-salarios/movements` | 'compensation:movements:request', ...MANAGE | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L213) |
| PATCH | `/cargos-salarios/movements/:id/approve` | 'compensation:movements:approve', ...MANAGE | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L219) |
| PATCH | `/cargos-salarios/movements/:id/reject` | 'compensation:movements:approve', ...MANAGE | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L225) |
| PATCH | `/cargos-salarios/movements/:id/apply` | 'compensation:movements:execute', ...MANAGE | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L231) |
| GET | `/cargos-salarios/cycles` | ...VIEW | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L237) |
| POST | `/cargos-salarios/cycles` | ...MANAGE | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L243) |
| PATCH | `/cargos-salarios/cycles/:id` | ...MANAGE | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L249) |
| GET | `/cargos-salarios/budgets` | ...VIEW | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L255) |
| POST | `/cargos-salarios/budgets` | ...MANAGE | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L261) |
| GET | `/cargos-salarios/salary-surveys` | ...VIEW | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L267) |
| POST | `/cargos-salarios/salary-surveys` | ...MANAGE | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L273) |
| GET | `/cargos-salarios/simulations` | ...VIEW | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L279) |
| POST | `/cargos-salarios/simulations` | ...MANAGE | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L285) |
| PATCH | `/cargos-salarios/simulations/:id/approve` | ...MANAGE | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L291) |
| GET | `/cargos-salarios/approvals` | ...VIEW | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L297) |
| GET | `/cargos-salarios/settings` | ...VIEW | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L303) |
| PATCH | `/cargos-salarios/settings` | ...MANAGE | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L309) |
| GET | `/cargos-salarios/reports` | 'compensation:reports:view', ...VIEW | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L315) |
| GET | `/cargos-salarios/audit` | 'compensation:audit:view', 'audit:view' | Sim | [controller](../apps/api/src/modules/compensation/compensation.controller.ts#L321) |

### dashboard

Fonte: [diretório](../apps/api/src/modules/dashboard). 9 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/dashboard/overview` | 'dashboard:view' | Não | [controller](../apps/api/src/modules/dashboard/dashboard.controller.ts#L12) |
| GET | `/dashboard/areas` | 'dashboard:view' | Não | [controller](../apps/api/src/modules/dashboard/dashboard.controller.ts#L17) |
| GET | `/dashboard/area-indicators` | 'dashboard:view' | Não | [controller](../apps/api/src/modules/dashboard/dashboard.controller.ts#L22) |
| GET | `/dashboard/area-conclusion` | 'dashboard:view' | Não | [controller](../apps/api/src/modules/dashboard/dashboard.controller.ts#L35) |
| PATCH | `/dashboard/area-conclusion` | 'dashboard:view' | Não | [controller](../apps/api/src/modules/dashboard/dashboard.controller.ts#L40) |
| GET | `/dashboard/ranking` | 'dashboard:view' | Não | [controller](../apps/api/src/modules/dashboard/dashboard.controller.ts#L49) |
| GET | `/dashboard/evolution` | 'dashboard:view' | Não | [controller](../apps/api/src/modules/dashboard/dashboard.controller.ts#L54) |
| GET | `/dashboard/worst` | 'dashboard:view' | Não | [controller](../apps/api/src/modules/dashboard/dashboard.controller.ts#L59) |
| GET | `/dashboard/pending` | 'dashboard:view' | Não | [controller](../apps/api/src/modules/dashboard/dashboard.controller.ts#L64) |

### database-admin

Fonte: [diretório](../apps/api/src/modules/database-admin). 34 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/admin/database/backups` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/database-admin/controllers/backup.controller.ts#L28) |
| POST | `/admin/database/backups` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/database-admin/controllers/backup.controller.ts#L34) |
| GET | `/admin/database/backups/:id/download` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/database-admin/controllers/backup.controller.ts#L48) |
| POST | `/admin/database/backups/:id/verify` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/database-admin/controllers/backup.controller.ts#L55) |
| POST | `/admin/database/backups/:id/important` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/database-admin/controllers/backup.controller.ts#L60) |
| DELETE | `/admin/database/backups/:id` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/database-admin/controllers/backup.controller.ts#L65) |
| POST | `/admin/database/backups/:id/restore` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/database-admin/controllers/backup.controller.ts#L74) |
| GET | `/admin/database/audit` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/database-admin/controllers/db-audit.controller.ts#L17) |
| GET | `/admin/database/settings` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/database-admin/controllers/db-settings.controller.ts#L17) |
| PUT | `/admin/database/settings` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/database-admin/controllers/db-settings.controller.ts#L22) |
| GET | `/admin/database/diagnostics` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/database-admin/controllers/diagnostics.controller.ts#L15) |
| POST | `/admin/database/diagnostics/run` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/database-admin/controllers/diagnostics.controller.ts#L20) |
| POST | `/admin/database/export` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/database-admin/controllers/import-export.controller.ts#L26) |
| POST | `/admin/database/import/preview` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/database-admin/controllers/import-export.controller.ts#L36) |
| POST | `/admin/database/import/commit` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/database-admin/controllers/import-export.controller.ts#L41) |
| GET | `/admin/database/overview` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/database-admin/controllers/overview.controller.ts#L17) |
| POST | `/admin/database/query/validate` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/database-admin/controllers/query.controller.ts#L18) |
| POST | `/admin/database/query/execute` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/database-admin/controllers/query.controller.ts#L23) |
| POST | `/admin/database/query/explain` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/database-admin/controllers/query.controller.ts#L35) |
| GET | `/admin/database/query/history` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/database-admin/controllers/query.controller.ts#L41) |
| GET | `/admin/database/query/favorites` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/database-admin/controllers/query.controller.ts#L47) |
| POST | `/admin/database/query/favorites` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/database-admin/controllers/query.controller.ts#L53) |
| DELETE | `/admin/database/query/favorites/:id` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/database-admin/controllers/query.controller.ts#L60) |
| GET | `/admin/database/tables/:table/rows` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/database-admin/controllers/records.controller.ts#L23) |
| POST | `/admin/database/tables/:table/rows` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/database-admin/controllers/records.controller.ts#L53) |
| PATCH | `/admin/database/tables/:table/rows` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/database-admin/controllers/records.controller.ts#L63) |
| POST | `/admin/database/tables/:table/rows/delete` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/database-admin/controllers/records.controller.ts#L73) |
| GET | `/admin/database/schema` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/database-admin/controllers/schema.controller.ts#L17) |
| GET | `/admin/database/relationships` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/database-admin/controllers/schema.controller.ts#L27) |
| GET | `/admin/database/indexes` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/database-admin/controllers/schema.controller.ts#L33) |
| POST | `/admin/database/structure/preview` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/database-admin/controllers/structure.controller.ts#L16) |
| POST | `/admin/database/structure/execute` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/database-admin/controllers/structure.controller.ts#L22) |
| GET | `/admin/database/tables` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/database-admin/controllers/tables.controller.ts#L18) |
| GET | `/admin/database/tables/:table/schema` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/database-admin/controllers/tables.controller.ts#L23) |

### deviations

Fonte: [diretório](../apps/api/src/modules/deviations). 10 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/deviations` | 'deviations:view' | Não | [controller](../apps/api/src/modules/deviations/deviations.controller.ts#L20) |
| GET | `/deviations/:id` | 'deviations:view' | Não | [controller](../apps/api/src/modules/deviations/deviations.controller.ts#L30) |
| POST | `/deviations` | 'deviations:create' | Não | [controller](../apps/api/src/modules/deviations/deviations.controller.ts#L36) |
| PATCH | `/deviations/:id` | 'deviations:update' | Não | [controller](../apps/api/src/modules/deviations/deviations.controller.ts#L68) |
| DELETE | `/deviations/:id` | 'deviations:manage' | Não | [controller](../apps/api/src/modules/deviations/deviations.controller.ts#L75) |
| POST | `/deviations/:id/causes` | 'deviations:update' | Não | [controller](../apps/api/src/modules/deviations/deviations.controller.ts#L81) |
| DELETE | `/deviations/causes/:causeId` | 'deviations:update' | Não | [controller](../apps/api/src/modules/deviations/deviations.controller.ts#L91) |
| POST | `/deviations/:id/analyses` | 'deviations:update' | Não | [controller](../apps/api/src/modules/deviations/deviations.controller.ts#L97) |
| POST | `/deviations/:id/actions` | 'actions:create' | Não | [controller](../apps/api/src/modules/deviations/deviations.controller.ts#L107) |
| POST | `/deviations/:id/close` | 'deviations:close' | Não | [controller](../apps/api/src/modules/deviations/deviations.controller.ts#L127) |

### documents

Fonte: [diretório](../apps/api/src/modules/documents). 58 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/documents` | 'doc:view' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L15) |
| GET | `/documents/summary` | 'doc:view' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L31) |
| GET | `/documents/dashboard` | 'doc:view' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L37) |
| GET | `/documents/matrix` | 'doc:view' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L43) |
| GET | `/documents/options` | 'doc:view' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L57) |
| GET | `/documents/types` | 'doc:view' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L63) |
| POST | `/documents/types` | 'doc:manage' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L69) |
| PATCH | `/documents/types/:id` | 'doc:manage' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L75) |
| GET | `/documents/templates` | 'doc:view' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L81) |
| POST | `/documents/templates` | 'doc:manage' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L87) |
| GET | `/documents/templates/library` | 'doc:manage' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L93) |
| POST | `/documents/templates/library/install` | 'doc:manage' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L99) |
| POST | `/documents/templates/import` | 'doc:manage' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L105) |
| PATCH | `/documents/templates/:templateId` | 'doc:manage' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L111) |
| DELETE | `/documents/templates/:templateId` | 'doc:manage' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L117) |
| POST | `/documents/templates/:templateId/duplicate` | 'doc:manage' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L123) |
| GET | `/documents/templates/:templateId/download` | 'doc:view' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L129) |
| POST | `/documents/generate-code` | 'doc:create' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L142) |
| GET | `/documents/editor/status` | 'doc:view' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L148) |
| POST | `/documents/edit-requests/:requestId/approve` | 'doc:view' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L154) |
| POST | `/documents/edit-requests/:requestId/reject` | 'doc:view' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L160) |
| POST | `/documents/edit-requests/:requestId/complete` | 'doc:view' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L166) |
| POST | `/documents/jobs/expiration` | 'doc:manage' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L172) |
| GET | `/documents/diagnostics` | 'doc:manage' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L178) |
| GET | `/documents/:id` | 'doc:view' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L184) |
| POST | `/documents` | 'doc:create' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L190) |
| PATCH | `/documents/:id` | 'doc:update' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L196) |
| DELETE | `/documents/:id` | 'doc:delete' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L202) |
| POST | `/documents/:id/editor/open` | 'doc:view' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L208) |
| POST | `/documents/:id/viewer/open` | 'doc:view' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L214) |
| POST | `/documents/:id/editor/open-word` | 'doc:view' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L220) |
| POST | `/documents/:id/edit-requests/grant` | 'doc:view' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L226) |
| POST | `/documents/:id/edit-requests` | 'doc:view' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L232) |
| POST | `/documents/:id/autosave` | 'doc:update' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L238) |
| POST | `/documents/:id/files` | 'doc:update' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L244) |
| GET | `/documents/:id/files/:fileId/download` | 'doc:view' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L250) |
| POST | `/documents/:id/comments` | 'doc:view' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L265) |
| POST | `/documents/:id/read-confirmations` | 'doc:view' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L271) |
| POST | `/documents/:id/new-revision` | 'doc:update' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L277) |
| POST | `/documents/:id/submit-review` | 'doc:update' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L283) |
| POST | `/documents/:id/start-review` | 'doc:update' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L289) |
| POST | `/documents/:id/request-adjustments` | 'doc:update' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L295) |
| POST | `/documents/:id/complete-review` | 'doc:update' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L301) |
| POST | `/documents/:id/send-approval` | 'doc:update' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L307) |
| POST | `/documents/:id/start-approval` | 'doc:update' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L313) |
| POST | `/documents/:id/approve` | 'doc:update' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L319) |
| POST | `/documents/:id/reject` | 'doc:update' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L325) |
| POST | `/documents/:id/publish` | 'doc:update' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L331) |
| POST | `/documents/:id/obsolete` | 'doc:update' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L337) |
| POST | `/documents/:id/archive` | 'doc:update' | Sim | [controller](../apps/api/src/modules/documents/documents.controller.ts#L343) |
| ALL | `/dav/files/:id/:fileName` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/documents/webdav.controller.ts#L27) |
| ALL | `/dav/files/:id` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/documents/webdav.controller.ts#L38) |
| ALL | `/dav/files` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/documents/webdav.controller.ts#L49) |
| ALL | `/dav` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/documents/webdav.controller.ts#L55) |
| GET | `/wopi/files/:id` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/documents/wopi.controller.ts#L38) |
| GET | `/wopi/files/:id/contents` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/documents/wopi.controller.ts#L46) |
| POST | `/wopi/files/:id/contents` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/documents/wopi.controller.ts#L61) |
| POST | `/wopi/files/:id` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/documents/wopi.controller.ts#L88) |

### external-api

Fonte: [diretório](../apps/api/src/modules/external-api). 7 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/external/v1/health` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/external-api/external-api.controller.ts#L21) |
| GET | `/external/v1/indicators` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/external-api/external-api.controller.ts#L27) |
| POST | `/external/v1/results` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/external-api/external-api.controller.ts#L34) |
| GET | `/external/v1/areas` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/external-api/external-api.controller.ts#L41) |
| GET | `/external/v1/action-plans` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/external-api/external-api.controller.ts#L48) |
| POST | `/external/v1/prize/eligible` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/external-api/external-api.controller.ts#L61) |
| POST | `/external/v1/prize/events` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/external-api/external-api.controller.ts#L68) |

### food-safety

Fonte: [diretório](../apps/api/src/modules/food-safety). 75 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/food-safety/summary` | 'fsms:view' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L12) |
| GET | `/food-safety/options` | 'fsms:view' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L18) |
| GET | `/food-safety/programs` | 'fsms:view' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L25) |
| GET | `/food-safety/programs/:id` | 'fsms:view' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L31) |
| POST | `/food-safety/programs` | 'fsms:create' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L37) |
| PATCH | `/food-safety/programs/:id` | 'fsms:update' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L43) |
| DELETE | `/food-safety/programs/:id` | 'fsms:delete' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L49) |
| GET | `/food-safety/processes` | 'fsms:view' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L56) |
| GET | `/food-safety/processes/:id` | 'fsms:view' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L67) |
| POST | `/food-safety/processes` | 'fsms:create' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L73) |
| PATCH | `/food-safety/processes/:id` | 'fsms:update' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L79) |
| DELETE | `/food-safety/processes/:id` | 'fsms:delete' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L85) |
| POST | `/food-safety/processes/:id/steps` | 'fsms:update' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L92) |
| POST | `/food-safety/processes/:id/steps/bulk` | 'fsms:update' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L98) |
| PATCH | `/food-safety/steps/:stepId` | 'fsms:update' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L104) |
| DELETE | `/food-safety/steps/:stepId` | 'fsms:delete' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L110) |
| GET | `/food-safety/flow-templates` | 'fsms:view' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L117) |
| POST | `/food-safety/flow-templates` | 'fsms:update' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L123) |
| PATCH | `/food-safety/flow-templates/:id` | 'fsms:update' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L129) |
| DELETE | `/food-safety/flow-templates/:id` | 'fsms:delete' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L135) |
| GET | `/food-safety/flow-templates/:id/export` | 'fsms:view' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L141) |
| POST | `/food-safety/processes/:id/save-as-template` | 'fsms:update' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L147) |
| GET | `/food-safety/risk-matrix` | 'fsms:view' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L154) |
| PATCH | `/food-safety/risk-matrix` | 'fsms:update' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L160) |
| GET | `/food-safety/hazards` | 'fsms:view' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L167) |
| GET | `/food-safety/hazards/:id` | 'fsms:view' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L180) |
| POST | `/food-safety/hazards` | 'fsms:create' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L186) |
| PATCH | `/food-safety/hazards/:id` | 'fsms:update' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L192) |
| DELETE | `/food-safety/hazards/:id` | 'fsms:delete' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L198) |
| GET | `/food-safety/control-plans` | 'fsms:view' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L205) |
| GET | `/food-safety/control-plans/:id` | 'fsms:view' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L216) |
| POST | `/food-safety/control-plans` | 'fsms:create' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L222) |
| PATCH | `/food-safety/control-plans/:id` | 'fsms:update' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L228) |
| DELETE | `/food-safety/control-plans/:id` | 'fsms:delete' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L234) |
| GET | `/food-safety/control-plans/:id/records` | 'fsms:view' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L240) |
| POST | `/food-safety/control-plans/:id/records` | 'fsms:update' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L246) |
| GET | `/food-safety/standards` | 'fsms:view' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L253) |
| POST | `/food-safety/standards` | 'fsms:create' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L259) |
| PATCH | `/food-safety/standards/:id` | 'fsms:update' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L265) |
| DELETE | `/food-safety/standards/:id` | 'fsms:delete' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L271) |
| POST | `/food-safety/standard-versions` | 'fsms:create' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L277) |
| PATCH | `/food-safety/standard-versions/:id` | 'fsms:update' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L283) |
| DELETE | `/food-safety/standard-versions/:id` | 'fsms:delete' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L289) |
| GET | `/food-safety/compliance-summary` | 'fsms:view' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L295) |
| GET | `/food-safety/requirements` | 'fsms:view' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L301) |
| POST | `/food-safety/requirements` | 'fsms:create' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L312) |
| PATCH | `/food-safety/requirements/:id` | 'fsms:update' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L318) |
| DELETE | `/food-safety/requirements/:id` | 'fsms:delete' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L324) |
| POST | `/food-safety/requirements/:id/assess` | 'fsms:update' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L330) |
| GET | `/food-safety/supply-chain-summary` | 'fsms:view' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L337) |
| GET | `/food-safety/suppliers` | 'fsms:view' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L343) |
| POST | `/food-safety/suppliers` | 'fsms:create' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L355) |
| PATCH | `/food-safety/suppliers/:id` | 'fsms:update' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L361) |
| DELETE | `/food-safety/suppliers/:id` | 'fsms:delete' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L367) |
| GET | `/food-safety/materials` | 'fsms:view' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L373) |
| POST | `/food-safety/materials` | 'fsms:create' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L386) |
| PATCH | `/food-safety/materials/:id` | 'fsms:update' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L392) |
| DELETE | `/food-safety/materials/:id` | 'fsms:delete' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L398) |
| GET | `/food-safety/lots` | 'fsms:view' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L404) |
| POST | `/food-safety/lots` | 'fsms:create' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L418) |
| PATCH | `/food-safety/lots/:id` | 'fsms:update' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L424) |
| DELETE | `/food-safety/lots/:id` | 'fsms:delete' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L430) |
| GET | `/food-safety/lots/:id/trace` | 'fsms:view' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L436) |
| GET | `/food-safety/trace-links` | 'fsms:view' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L442) |
| POST | `/food-safety/trace-links` | 'fsms:create' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L448) |
| GET | `/food-safety/recalls` | 'fsms:view' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L454) |
| POST | `/food-safety/recalls` | 'fsms:create' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L460) |
| PATCH | `/food-safety/recalls/:id` | 'fsms:update' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L466) |
| POST | `/food-safety/recalls/:id/items` | 'fsms:create' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L472) |
| PATCH | `/food-safety/recall-items/:id` | 'fsms:update' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L478) |
| GET | `/food-safety/intelligence-dashboard` | 'fsms:view' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L485) |
| GET | `/food-safety/supplier-scorecard` | 'fsms:view' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L491) |
| GET | `/food-safety/assistant-insights` | 'fsms:view' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L497) |
| GET | `/food-safety/export` | 'fsms:export' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L503) |
| POST | `/food-safety/import` | 'fsms:create' | Sim | [controller](../apps/api/src/modules/food-safety/food-safety.controller.ts#L509) |

### forms

Fonte: [diretório](../apps/api/src/modules/forms). 33 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/forms` | 'forms:view' | Sim | [controller](../apps/api/src/modules/forms/forms.controller.ts#L13) |
| GET | `/forms/summary` | 'forms:view' | Sim | [controller](../apps/api/src/modules/forms/forms.controller.ts#L27) |
| GET | `/forms/dashboard` | 'forms:dashboard' | Sim | [controller](../apps/api/src/modules/forms/forms.controller.ts#L33) |
| GET | `/forms/library` | 'forms:templates' | Sim | [controller](../apps/api/src/modules/forms/forms.controller.ts#L39) |
| GET | `/forms/options` | 'forms:view' | Sim | [controller](../apps/api/src/modules/forms/forms.controller.ts#L45) |
| GET | `/forms/submissions` | 'forms:view' | Sim | [controller](../apps/api/src/modules/forms/forms.controller.ts#L57) |
| GET | `/forms/executions` | 'forms:execute' | Sim | [controller](../apps/api/src/modules/forms/forms.controller.ts#L70) |
| POST | `/forms/executions` | 'forms:execute' | Sim | [controller](../apps/api/src/modules/forms/forms.controller.ts#L82) |
| GET | `/forms/executions/:executionId` | 'forms:execute' | Sim | [controller](../apps/api/src/modules/forms/forms.controller.ts#L88) |
| POST | `/forms/executions/:executionId/responses` | 'forms:execute' | Sim | [controller](../apps/api/src/modules/forms/forms.controller.ts#L94) |
| POST | `/forms/executions/:executionId/complete` | 'forms:execute' | Sim | [controller](../apps/api/src/modules/forms/forms.controller.ts#L100) |
| POST | `/forms/ai/suggestions` | 'forms:ai' | Sim | [controller](../apps/api/src/modules/forms/forms.controller.ts#L106) |
| GET | `/forms/:id` | 'forms:view' | Sim | [controller](../apps/api/src/modules/forms/forms.controller.ts#L112) |
| GET | `/forms/:id/builder` | 'forms:builder' | Sim | [controller](../apps/api/src/modules/forms/forms.controller.ts#L118) |
| POST | `/forms` | 'forms:create' | Sim | [controller](../apps/api/src/modules/forms/forms.controller.ts#L124) |
| POST | `/forms/:id/versions` | 'forms:versions' | Sim | [controller](../apps/api/src/modules/forms/forms.controller.ts#L130) |
| POST | `/forms/:id/publish` | 'forms:publish' | Sim | [controller](../apps/api/src/modules/forms/forms.controller.ts#L136) |
| POST | `/forms/:id/duplicate` | 'forms:create' | Sim | [controller](../apps/api/src/modules/forms/forms.controller.ts#L142) |
| PATCH | `/forms/:id` | 'forms:update' | Sim | [controller](../apps/api/src/modules/forms/forms.controller.ts#L148) |
| DELETE | `/forms/:id` | 'forms:delete' | Sim | [controller](../apps/api/src/modules/forms/forms.controller.ts#L154) |
| GET | `/forms/:id/submissions` | 'forms:view' | Sim | [controller](../apps/api/src/modules/forms/forms.controller.ts#L160) |
| POST | `/forms/:id/recalculate` | 'forms:update' | Sim | [controller](../apps/api/src/modules/forms/forms.controller.ts#L168) |
| POST | `/forms/:id/submissions` | 'forms:fill', 'forms:update' | Sim | [controller](../apps/api/src/modules/forms/forms.controller.ts#L176) |
| GET | `/forms/qrcode/validate/:token` | 'forms:view' | Sim | [controller](../apps/api/src/modules/forms/forms.controller.ts#L183) |
| POST | `/forms/:id/qrcode` | 'forms:templates' | Sim | [controller](../apps/api/src/modules/forms/forms.controller.ts#L189) |
| PATCH | `/forms/submissions/:submissionId` | 'forms:update' | Sim | [controller](../apps/api/src/modules/forms/forms.controller.ts#L195) |
| GET | `/forms/participants/lookup` | 'forms:view' | Sim | [controller](../apps/api/src/modules/forms/forms.controller.ts#L202) |
| POST | `/forms/submissions/:submissionId/photo` | 'forms:fill', 'forms:evidence' | Sim | [controller](../apps/api/src/modules/forms/forms.controller.ts#L209) |
| GET | `/forms/evidence/:evidenceId/content` | 'forms:view' | Sim | [controller](../apps/api/src/modules/forms/forms.controller.ts#L215) |
| POST | `/forms/submissions/:submissionId/evidence` | 'forms:evidence' | Sim | [controller](../apps/api/src/modules/forms/forms.controller.ts#L222) |
| POST | `/forms/submissions/:submissionId/signatures` | 'forms:fill', 'forms:execute', 'forms:approve' | Sim | [controller](../apps/api/src/modules/forms/forms.controller.ts#L228) |
| POST | `/forms/submissions/:submissionId/approvals` | 'forms:approve' | Sim | [controller](../apps/api/src/modules/forms/forms.controller.ts#L234) |
| POST | `/forms/submissions/:submissionId/issues` | 'forms:issues' | Sim | [controller](../apps/api/src/modules/forms/forms.controller.ts#L240) |

### health

Fonte: [diretório](../apps/api/src/modules/health). 0 operações encontradas.

Serviços/infraestrutura sem controller HTTP direto neste diretório.

### help

Fonte: [diretório](../apps/api/src/modules/help). 9 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/admin/help` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/help/admin-help.controller.ts#L16) |
| POST | `/admin/help/categories` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/help/admin-help.controller.ts#L22) |
| PUT | `/admin/help/categories/:id` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/help/admin-help.controller.ts#L28) |
| POST | `/admin/help/articles` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/help/admin-help.controller.ts#L34) |
| PUT | `/admin/help/articles/:id` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/help/admin-help.controller.ts#L40) |
| POST | `/admin/help/articles/:id/status` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/help/admin-help.controller.ts#L46) |
| GET | `/help` | 'help:view' | Não | [controller](../apps/api/src/modules/help/help.controller.ts#L12) |
| GET | `/help/articles/:slug` | 'help:view' | Não | [controller](../apps/api/src/modules/help/help.controller.ts#L17) |
| POST | `/help/articles/:slug/feedback` | 'help:view' | Não | [controller](../apps/api/src/modules/help/help.controller.ts#L22) |

### imports

Fonte: [diretório](../apps/api/src/modules/imports). 4 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/imports/jobs` | 'imports:view' | Não | [controller](../apps/api/src/modules/imports/imports.controller.ts#L12) |
| GET | `/imports/jobs/:id/errors` | 'imports:view' | Não | [controller](../apps/api/src/modules/imports/imports.controller.ts#L18) |
| POST | `/imports/preview` | 'imports:create' | Não | [controller](../apps/api/src/modules/imports/imports.controller.ts#L24) |
| POST | `/imports/commit` | 'imports:create' | Não | [controller](../apps/api/src/modules/imports/imports.controller.ts#L33) |

### indicators

Fonte: [diretório](../apps/api/src/modules/indicators). 23 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/indicators` | 'indicators:view' | Não | [controller](../apps/api/src/modules/indicators/indicators.controller.ts#L14) |
| GET | `/indicators/options` | 'indicators:view' | Não | [controller](../apps/api/src/modules/indicators/indicators.controller.ts#L48) |
| GET | `/indicators/tree/graph` | 'indicators:view' | Não | [controller](../apps/api/src/modules/indicators/indicators.controller.ts#L54) |
| GET | `/indicators/:id` | 'indicators:view' | Não | [controller](../apps/api/src/modules/indicators/indicators.controller.ts#L60) |
| GET | `/indicators/:id/series` | 'indicators:view' | Não | [controller](../apps/api/src/modules/indicators/indicators.controller.ts#L66) |
| GET | `/indicators/:id/targets` | 'indicators:view' | Não | [controller](../apps/api/src/modules/indicators/indicators.controller.ts#L72) |
| GET | `/indicators/:id/history` | 'indicators:view' | Não | [controller](../apps/api/src/modules/indicators/indicators.controller.ts#L78) |
| POST | `/indicators` | 'indicators:create' | Não | [controller](../apps/api/src/modules/indicators/indicators.controller.ts#L84) |
| PATCH | `/indicators/:id` | 'indicators:update' | Não | [controller](../apps/api/src/modules/indicators/indicators.controller.ts#L90) |
| POST | `/indicators/:id/targets` | 'indicators:update' | Não | [controller](../apps/api/src/modules/indicators/indicators.controller.ts#L96) |
| POST | `/indicators/:id/target` | 'indicators:update' | Não | [controller](../apps/api/src/modules/indicators/indicators.controller.ts#L106) |
| POST | `/indicators/:id/targets/batch` | 'indicators:update' | Não | [controller](../apps/api/src/modules/indicators/indicators.controller.ts#L112) |
| POST | `/indicators/:id/results` | 'results:launch' | Não | [controller](../apps/api/src/modules/indicators/indicators.controller.ts#L118) |
| GET | `/indicators/:id/period/:periodRef/notes` | 'indicators:view' | Não | [controller](../apps/api/src/modules/indicators/indicators.controller.ts#L126) |
| POST | `/indicators/:id/period/:periodRef/attachments` | 'results:launch' | Não | [controller](../apps/api/src/modules/indicators/indicators.controller.ts#L136) |
| POST | `/indicators/:id/period/:periodRef/comments` | 'results:launch' | Não | [controller](../apps/api/src/modules/indicators/indicators.controller.ts#L147) |
| GET | `/indicators/result-attachments/:attachmentId` | 'indicators:view' | Não | [controller](../apps/api/src/modules/indicators/indicators.controller.ts#L158) |
| DELETE | `/indicators/result-attachments/:attachmentId` | 'results:launch' | Não | [controller](../apps/api/src/modules/indicators/indicators.controller.ts#L164) |
| DELETE | `/indicators/:id` | 'indicators:delete' | Não | [controller](../apps/api/src/modules/indicators/indicators.controller.ts#L170) |
| GET | `/indicators/:id/children` | 'indicators:view' | Não | [controller](../apps/api/src/modules/indicators/indicators.controller.ts#L178) |
| POST | `/indicators/:id/children` | 'indicators:update' | Não | [controller](../apps/api/src/modules/indicators/indicators.controller.ts#L184) |
| DELETE | `/indicators/:id/children/:childId` | 'indicators:update' | Não | [controller](../apps/api/src/modules/indicators/indicators.controller.ts#L193) |
| GET | `/indicators/:id/impact` | 'indicators:view' | Não | [controller](../apps/api/src/modules/indicators/indicators.controller.ts#L199) |

### insights

Fonte: [diretório](../apps/api/src/modules/insights). 0 operações encontradas.

Serviços/infraestrutura sem controller HTTP direto neste diretório.

### integrations

Fonte: [diretório](../apps/api/src/modules/integrations). 13 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/integrations/external/keys` | 'integrations:view', 'integrations:manage' | Não | [controller](../apps/api/src/modules/integrations/external-integration.controller.ts#L24) |
| POST | `/integrations/external/keys` | 'integrations:manage' | Não | [controller](../apps/api/src/modules/integrations/external-integration.controller.ts#L29) |
| DELETE | `/integrations/external/keys/:id` | 'integrations:manage' | Não | [controller](../apps/api/src/modules/integrations/external-integration.controller.ts#L35) |
| GET | `/integrations/external` | 'integrations:view', 'integrations:manage' | Não | [controller](../apps/api/src/modules/integrations/external-integration.controller.ts#L42) |
| POST | `/integrations/external` | 'integrations:manage' | Não | [controller](../apps/api/src/modules/integrations/external-integration.controller.ts#L47) |
| GET | `/integrations/external/:id` | 'integrations:view', 'integrations:manage' | Não | [controller](../apps/api/src/modules/integrations/external-integration.controller.ts#L53) |
| PATCH | `/integrations/external/:id` | 'integrations:manage' | Não | [controller](../apps/api/src/modules/integrations/external-integration.controller.ts#L58) |
| DELETE | `/integrations/external/:id` | 'integrations:manage' | Não | [controller](../apps/api/src/modules/integrations/external-integration.controller.ts#L64) |
| POST | `/integrations/external/:id/test` | 'integrations:manage' | Não | [controller](../apps/api/src/modules/integrations/external-integration.controller.ts#L70) |
| POST | `/integrations/external/:id/run` | 'integrations:manage' | Não | [controller](../apps/api/src/modules/integrations/external-integration.controller.ts#L76) |
| GET | `/integrations/external/:id/logs` | 'integrations:view', 'integrations:manage' | Não | [controller](../apps/api/src/modules/integrations/external-integration.controller.ts#L82) |
| GET | `/integrations` | 'integrations:view' | Não | [controller](../apps/api/src/modules/integrations/integrations.controller.ts#L16) |
| PUT | `/integrations/:code/preference` | 'integrations:manage' | Não | [controller](../apps/api/src/modules/integrations/integrations.controller.ts#L21) |

### lgpd

Fonte: [diretório](../apps/api/src/modules/lgpd). 13 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/lgpd/overview` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/lgpd/lgpd.controller.ts#L19) |
| GET | `/lgpd/processing-records` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/lgpd/lgpd.controller.ts#L25) |
| POST | `/lgpd/processing-records` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/lgpd/lgpd.controller.ts#L30) |
| PATCH | `/lgpd/processing-records/:id` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/lgpd/lgpd.controller.ts#L35) |
| DELETE | `/lgpd/processing-records/:id` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/lgpd/lgpd.controller.ts#L40) |
| GET | `/lgpd/subprocessors` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/lgpd/lgpd.controller.ts#L46) |
| POST | `/lgpd/subprocessors` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/lgpd/lgpd.controller.ts#L51) |
| PATCH | `/lgpd/subprocessors/:id` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/lgpd/lgpd.controller.ts#L56) |
| DELETE | `/lgpd/subprocessors/:id` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/lgpd/lgpd.controller.ts#L61) |
| GET | `/lgpd/incidents` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/lgpd/lgpd.controller.ts#L67) |
| POST | `/lgpd/incidents` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/lgpd/lgpd.controller.ts#L72) |
| PATCH | `/lgpd/incidents/:id` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/lgpd/lgpd.controller.ts#L77) |
| DELETE | `/lgpd/incidents/:id` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/lgpd/lgpd.controller.ts#L82) |

### meetings

Fonte: [diretório](../apps/api/src/modules/meetings). 15 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/meetings` | 'meetings:view' | Não | [controller](../apps/api/src/modules/meetings/meetings.controller.ts#L12) |
| GET | `/meetings/:id` | 'meetings:view' | Não | [controller](../apps/api/src/modules/meetings/meetings.controller.ts#L18) |
| POST | `/meetings` | 'meetings:create' | Não | [controller](../apps/api/src/modules/meetings/meetings.controller.ts#L24) |
| PATCH | `/meetings/:id` | 'meetings:update' | Não | [controller](../apps/api/src/modules/meetings/meetings.controller.ts#L48) |
| DELETE | `/meetings/:id` | 'meetings:delete' | Não | [controller](../apps/api/src/modules/meetings/meetings.controller.ts#L54) |
| POST | `/meetings/:id/participants` | 'meetings:update' | Não | [controller](../apps/api/src/modules/meetings/meetings.controller.ts#L60) |
| POST | `/meetings/:id/guests` | 'meetings:update' | Não | [controller](../apps/api/src/modules/meetings/meetings.controller.ts#L70) |
| PATCH | `/meetings/:id/participants/:userId` | 'meetings:update' | Não | [controller](../apps/api/src/modules/meetings/meetings.controller.ts#L80) |
| POST | `/meetings/:id/agenda` | 'meetings:update' | Não | [controller](../apps/api/src/modules/meetings/meetings.controller.ts#L91) |
| POST | `/meetings/:id/decisions` | 'meetings:update' | Não | [controller](../apps/api/src/modules/meetings/meetings.controller.ts#L97) |
| POST | `/meetings/:id/ai/minutes` | 'meetings:update' | Não | [controller](../apps/api/src/modules/meetings/meetings.controller.ts#L107) |
| POST | `/meetings/:id/actions` | 'actions:create' | Não | [controller](../apps/api/src/modules/meetings/meetings.controller.ts#L113) |
| POST | `/meetings/:id/action-plan` | 'actions:create' | Não | [controller](../apps/api/src/modules/meetings/meetings.controller.ts#L135) |
| POST | `/meetings/:id/invitations/send` | 'meetings:complete' | Não | [controller](../apps/api/src/modules/meetings/meetings.controller.ts#L141) |
| POST | `/meetings/:id/complete` | 'meetings:complete' | Não | [controller](../apps/api/src/modules/meetings/meetings.controller.ts#L147) |

### monthly-results

Fonte: [diretório](../apps/api/src/modules/monthly-results). 37 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/monthly-results/minutes/meetings` | 'monthly:view', 'actions:view' | Não | [controller](../apps/api/src/modules/monthly-results/monthly-results.controller.ts#L16) |
| GET | `/monthly-results/minutes` | 'monthly:view', 'actions:view' | Não | [controller](../apps/api/src/modules/monthly-results/monthly-results.controller.ts#L22) |
| GET | `/monthly-results/meetings/:id/outcome-follow-up` | 'monthly:view', 'actions:view' | Não | [controller](../apps/api/src/modules/monthly-results/monthly-results.controller.ts#L35) |
| GET | `/monthly-results/minutes/actions/:actionId/curve` | 'monthly:view', 'actions:view' | Não | [controller](../apps/api/src/modules/monthly-results/monthly-results.controller.ts#L41) |
| GET | `/monthly-results/options` | 'monthly:view' | Não | [controller](../apps/api/src/modules/monthly-results/monthly-results.controller.ts#L48) |
| GET | `/monthly-results/dashboard` | 'monthly:view' | Não | [controller](../apps/api/src/modules/monthly-results/monthly-results.controller.ts#L54) |
| GET | `/monthly-results/meetings/:id` | 'monthly:view' | Não | [controller](../apps/api/src/modules/monthly-results/monthly-results.controller.ts#L60) |
| GET | `/monthly-results/presentation-branding` | 'monthly:view' | Não | [controller](../apps/api/src/modules/monthly-results/monthly-results.controller.ts#L67) |
| PUT | `/monthly-results/presentation-branding` | 'monthly:update' | Não | [controller](../apps/api/src/modules/monthly-results/monthly-results.controller.ts#L73) |
| POST | `/monthly-results/meetings` | 'monthly:create' | Não | [controller](../apps/api/src/modules/monthly-results/monthly-results.controller.ts#L80) |
| PATCH | `/monthly-results/meetings/:id` | 'monthly:update' | Não | [controller](../apps/api/src/modules/monthly-results/monthly-results.controller.ts#L86) |
| DELETE | `/monthly-results/meetings/:id` | 'monthly:update' | Não | [controller](../apps/api/src/modules/monthly-results/monthly-results.controller.ts#L92) |
| POST | `/monthly-results/meetings/:id/status` | 'monthly:present', 'monthly:update' | Não | [controller](../apps/api/src/modules/monthly-results/monthly-results.controller.ts#L98) |
| POST | `/monthly-results/areas/:id/seed` | 'monthly:prepare', 'monthly:update' | Não | [controller](../apps/api/src/modules/monthly-results/monthly-results.controller.ts#L105) |
| PATCH | `/monthly-results/areas/:id` | 'monthly:prepare', 'monthly:validate', 'monthly:update' | Não | [controller](../apps/api/src/modules/monthly-results/monthly-results.controller.ts#L111) |
| PATCH | `/monthly-results/meeting-indicators/:id` | 'monthly:prepare', 'monthly:update' | Não | [controller](../apps/api/src/modules/monthly-results/monthly-results.controller.ts#L117) |
| PATCH | `/monthly-results/agenda/:id` | 'monthly:update' | Não | [controller](../apps/api/src/modules/monthly-results/monthly-results.controller.ts#L124) |
| POST | `/monthly-results/meetings/:id/agenda/reorder` | 'monthly:update' | Não | [controller](../apps/api/src/modules/monthly-results/monthly-results.controller.ts#L130) |
| POST | `/monthly-results/agenda/:id/timer` | 'monthly:present', 'monthly:update' | Não | [controller](../apps/api/src/modules/monthly-results/monthly-results.controller.ts#L136) |
| POST | `/monthly-results/meetings/:id/decisions` | 'monthly:decide', 'monthly:update' | Não | [controller](../apps/api/src/modules/monthly-results/monthly-results.controller.ts#L143) |
| POST | `/monthly-results/decisions/:id/action` | 'monthly:decide', 'monthly:update' | Não | [controller](../apps/api/src/modules/monthly-results/monthly-results.controller.ts#L149) |
| PATCH | `/monthly-results/decisions/:id` | 'monthly:decide', 'monthly:update' | Não | [controller](../apps/api/src/modules/monthly-results/monthly-results.controller.ts#L155) |
| DELETE | `/monthly-results/decisions/:id` | 'monthly:decide', 'monthly:update' | Não | [controller](../apps/api/src/modules/monthly-results/monthly-results.controller.ts#L161) |
| POST | `/monthly-results/meetings/:id/actions` | 'monthly:decide', 'monthly:update' | Não | [controller](../apps/api/src/modules/monthly-results/monthly-results.controller.ts#L168) |
| POST | `/monthly-results/meetings/:id/follow-ups` | 'monthly:update' | Não | [controller](../apps/api/src/modules/monthly-results/monthly-results.controller.ts#L175) |
| PATCH | `/monthly-results/follow-ups/:id` | 'monthly:update' | Não | [controller](../apps/api/src/modules/monthly-results/monthly-results.controller.ts#L181) |
| DELETE | `/monthly-results/follow-ups/:id` | 'monthly:update' | Não | [controller](../apps/api/src/modules/monthly-results/monthly-results.controller.ts#L187) |
| POST | `/monthly-results/meetings/:id/learnings` | 'monthly:update' | Não | [controller](../apps/api/src/modules/monthly-results/monthly-results.controller.ts#L194) |
| PATCH | `/monthly-results/learnings/:id` | 'monthly:update' | Não | [controller](../apps/api/src/modules/monthly-results/monthly-results.controller.ts#L200) |
| DELETE | `/monthly-results/learnings/:id` | 'monthly:update' | Não | [controller](../apps/api/src/modules/monthly-results/monthly-results.controller.ts#L206) |
| POST | `/monthly-results/meetings/:id/standardizations` | 'monthly:update' | Não | [controller](../apps/api/src/modules/monthly-results/monthly-results.controller.ts#L213) |
| PATCH | `/monthly-results/standardizations/:id` | 'monthly:update' | Não | [controller](../apps/api/src/modules/monthly-results/monthly-results.controller.ts#L219) |
| DELETE | `/monthly-results/standardizations/:id` | 'monthly:update' | Não | [controller](../apps/api/src/modules/monthly-results/monthly-results.controller.ts#L225) |
| PATCH | `/monthly-results/checklist/:id` | 'monthly:prepare', 'monthly:update' | Não | [controller](../apps/api/src/modules/monthly-results/monthly-results.controller.ts#L232) |
| POST | `/monthly-results/meetings/:id/ai/key-message` | 'monthly:update' | Não | [controller](../apps/api/src/modules/monthly-results/monthly-results.controller.ts#L239) |
| POST | `/monthly-results/meetings/:id/ai/minutes` | 'monthly:update' | Não | [controller](../apps/api/src/modules/monthly-results/monthly-results.controller.ts#L245) |
| POST | `/monthly-results/meetings/:id/ai/executive-summary` | 'monthly:update' | Não | [controller](../apps/api/src/modules/monthly-results/monthly-results.controller.ts#L251) |

### my-day

Fonte: [diretório](../apps/api/src/modules/my-day). 25 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/my-day/team` | 'myday:team' | Não | [controller](../apps/api/src/modules/my-day/my-day.controller.ts#L22) |
| GET | `/my-day/team/summary` | 'myday:team' | Não | [controller](../apps/api/src/modules/my-day/my-day.controller.ts#L28) |
| GET | `/my-day/team/items` | 'myday:team' | Não | [controller](../apps/api/src/modules/my-day/my-day.controller.ts#L34) |
| GET | `/my-day/team/workload` | 'myday:team' | Não | [controller](../apps/api/src/modules/my-day/my-day.controller.ts#L40) |
| GET | `/my-day/team/bottlenecks` | 'myday:team' | Não | [controller](../apps/api/src/modules/my-day/my-day.controller.ts#L46) |
| GET | `/my-day` | 'myday:view' | Não | [controller](../apps/api/src/modules/my-day/my-day.controller.ts#L52) |
| GET | `/my-day/summary` | 'myday:view' | Não | [controller](../apps/api/src/modules/my-day/my-day.controller.ts#L57) |
| GET | `/my-day/items` | 'myday:view' | Não | [controller](../apps/api/src/modules/my-day/my-day.controller.ts#L62) |
| GET | `/my-day/assistant` | 'myday:view' | Não | [controller](../apps/api/src/modules/my-day/my-day.controller.ts#L67) |
| POST | `/my-day/assistant/:key/hide` | 'myday:act' | Não | [controller](../apps/api/src/modules/my-day/my-day.controller.ts#L72) |
| POST | `/my-day/assistant/:key/feedback` | 'myday:act' | Não | [controller](../apps/api/src/modules/my-day/my-day.controller.ts#L78) |
| GET | `/my-day/items/:id` | 'myday:view' | Não | [controller](../apps/api/src/modules/my-day/my-day.controller.ts#L84) |
| POST | `/my-day/items/:id/action` | 'myday:act' | Não | [controller](../apps/api/src/modules/my-day/my-day.controller.ts#L89) |
| POST | `/my-day/items/:id/follow` | 'myday:act' | Não | [controller](../apps/api/src/modules/my-day/my-day.controller.ts#L95) |
| DELETE | `/my-day/items/:id/follow` | 'myday:act' | Não | [controller](../apps/api/src/modules/my-day/my-day.controller.ts#L101) |
| GET | `/my-day/follows` | 'myday:view' | Não | [controller](../apps/api/src/modules/my-day/my-day.controller.ts#L107) |
| GET | `/my-day/delegations` | 'myday:view' | Não | [controller](../apps/api/src/modules/my-day/my-day.controller.ts#L112) |
| POST | `/my-day/delegations` | 'myday:configure' | Não | [controller](../apps/api/src/modules/my-day/my-day.controller.ts#L117) |
| DELETE | `/my-day/delegations/:id` | 'myday:configure' | Não | [controller](../apps/api/src/modules/my-day/my-day.controller.ts#L123) |
| POST | `/my-day/refresh` | 'myday:act' | Não | [controller](../apps/api/src/modules/my-day/my-day.controller.ts#L129) |
| GET | `/my-day/preferences` | 'myday:view' | Não | [controller](../apps/api/src/modules/my-day/my-day.controller.ts#L136) |
| PUT | `/my-day/preferences` | 'myday:configure' | Não | [controller](../apps/api/src/modules/my-day/my-day.controller.ts#L141) |
| GET | `/my-day/saved-filters` | 'myday:view' | Não | [controller](../apps/api/src/modules/my-day/my-day.controller.ts#L147) |
| POST | `/my-day/saved-filters` | 'myday:configure' | Não | [controller](../apps/api/src/modules/my-day/my-day.controller.ts#L152) |
| DELETE | `/my-day/saved-filters/:id` | 'myday:configure' | Não | [controller](../apps/api/src/modules/my-day/my-day.controller.ts#L158) |

### nonconformities

Fonte: [diretório](../apps/api/src/modules/nonconformities). 7 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/nonconformities` | 'nc:view' | Sim | [controller](../apps/api/src/modules/nonconformities/nonconformities.controller.ts#L13) |
| GET | `/nonconformities/summary` | 'nc:view' | Sim | [controller](../apps/api/src/modules/nonconformities/nonconformities.controller.ts#L29) |
| GET | `/nonconformities/options` | 'nc:view' | Sim | [controller](../apps/api/src/modules/nonconformities/nonconformities.controller.ts#L35) |
| GET | `/nonconformities/:id` | 'nc:view' | Sim | [controller](../apps/api/src/modules/nonconformities/nonconformities.controller.ts#L41) |
| POST | `/nonconformities` | 'nc:create' | Sim | [controller](../apps/api/src/modules/nonconformities/nonconformities.controller.ts#L47) |
| PATCH | `/nonconformities/:id` | 'nc:update' | Sim | [controller](../apps/api/src/modules/nonconformities/nonconformities.controller.ts#L53) |
| DELETE | `/nonconformities/:id` | 'nc:delete' | Sim | [controller](../apps/api/src/modules/nonconformities/nonconformities.controller.ts#L59) |

### notifications

Fonte: [diretório](../apps/api/src/modules/notifications). 5 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/notifications` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/notifications/notifications.controller.ts#L10) |
| GET | `/notifications/count` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/notifications/notifications.controller.ts#L15) |
| PATCH | `/notifications/:id/read` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/notifications/notifications.controller.ts#L20) |
| POST | `/notifications/read-all` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/notifications/notifications.controller.ts#L25) |
| POST | `/notifications/generate` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/notifications/notifications.controller.ts#L30) |

### okrs

Fonte: [diretório](../apps/api/src/modules/okrs). 14 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/okrs/cycles` | 'okrs:view' | Não | [controller](../apps/api/src/modules/okrs/okrs.controller.ts#L21) |
| POST | `/okrs/cycles` | 'okrs:create' | Não | [controller](../apps/api/src/modules/okrs/okrs.controller.ts#L27) |
| PATCH | `/okrs/cycles/:cycleId` | 'okrs:update' | Não | [controller](../apps/api/src/modules/okrs/okrs.controller.ts#L36) |
| DELETE | `/okrs/cycles/:cycleId` | 'okrs:delete' | Não | [controller](../apps/api/src/modules/okrs/okrs.controller.ts#L46) |
| GET | `/okrs/options` | 'okrs:view' | Não | [controller](../apps/api/src/modules/okrs/okrs.controller.ts#L52) |
| GET | `/okrs/cycles/:cycleId/objectives` | 'okrs:view' | Não | [controller](../apps/api/src/modules/okrs/okrs.controller.ts#L58) |
| GET | `/okrs/objectives/:id` | 'okrs:view' | Não | [controller](../apps/api/src/modules/okrs/okrs.controller.ts#L64) |
| POST | `/okrs/cycles/:cycleId/objectives` | 'okrs:create' | Não | [controller](../apps/api/src/modules/okrs/okrs.controller.ts#L70) |
| PATCH | `/okrs/objectives/:id` | 'okrs:update' | Não | [controller](../apps/api/src/modules/okrs/okrs.controller.ts#L76) |
| DELETE | `/okrs/objectives/:id` | 'okrs:delete' | Não | [controller](../apps/api/src/modules/okrs/okrs.controller.ts#L82) |
| POST | `/okrs/objectives/:id/krs` | 'okrs:update' | Não | [controller](../apps/api/src/modules/okrs/okrs.controller.ts#L88) |
| PATCH | `/okrs/krs/:krId` | 'okrs:update' | Não | [controller](../apps/api/src/modules/okrs/okrs.controller.ts#L94) |
| DELETE | `/okrs/krs/:krId` | 'okrs:delete' | Não | [controller](../apps/api/src/modules/okrs/okrs.controller.ts#L100) |
| POST | `/okrs/objectives/:id/checkin` | 'okrs:checkin' | Não | [controller](../apps/api/src/modules/okrs/okrs.controller.ts#L106) |

### orgnodes

Fonte: [diretório](../apps/api/src/modules/orgnodes). 14 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/orgnodes` | 'org:view', 'org:view_all' | Não | [controller](../apps/api/src/modules/orgnodes/orgnodes.controller.ts#L15) |
| GET | `/orgnodes/tree` | 'org:view', 'org:view_all' | Não | [controller](../apps/api/src/modules/orgnodes/orgnodes.controller.ts#L21) |
| GET | `/orgnodes/:id/removal-impact` | 'org:manage' | Não | [controller](../apps/api/src/modules/orgnodes/orgnodes.controller.ts#L27) |
| GET | `/orgnodes/:id` | 'org:view', 'org:view_all' | Não | [controller](../apps/api/src/modules/orgnodes/orgnodes.controller.ts#L34) |
| POST | `/orgnodes` | 'org:manage' | Não | [controller](../apps/api/src/modules/orgnodes/orgnodes.controller.ts#L40) |
| PATCH | `/orgnodes/:id` | 'org:manage' | Não | [controller](../apps/api/src/modules/orgnodes/orgnodes.controller.ts#L47) |
| PATCH | `/orgnodes/:id/move` | 'org:manage' | Não | [controller](../apps/api/src/modules/orgnodes/orgnodes.controller.ts#L54) |
| DELETE | `/orgnodes/:id` | 'org:manage' | Não | [controller](../apps/api/src/modules/orgnodes/orgnodes.controller.ts#L61) |
| POST | `/orgnodes/:id/activities` | 'org:manage' | Não | [controller](../apps/api/src/modules/orgnodes/orgnodes.controller.ts#L68) |
| PATCH | `/orgnodes/:id/activities/:activityId` | 'org:manage' | Não | [controller](../apps/api/src/modules/orgnodes/orgnodes.controller.ts#L75) |
| DELETE | `/orgnodes/:id/activities/:activityId` | 'org:manage' | Não | [controller](../apps/api/src/modules/orgnodes/orgnodes.controller.ts#L82) |
| POST | `/orgnodes/:id/activities/:activityId/items` | 'org:manage' | Não | [controller](../apps/api/src/modules/orgnodes/orgnodes.controller.ts#L89) |
| PATCH | `/orgnodes/:id/activities/:activityId/items/:itemId` | 'org:manage' | Não | [controller](../apps/api/src/modules/orgnodes/orgnodes.controller.ts#L96) |
| DELETE | `/orgnodes/:id/activities/:activityId/items/:itemId` | 'org:manage' | Não | [controller](../apps/api/src/modules/orgnodes/orgnodes.controller.ts#L109) |

### payroll

Fonte: [diretório](../apps/api/src/modules/payroll). 67 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/payroll/dashboard` | 'folha:view' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L35) |
| GET | `/payroll/runs/:id/anomalies` | 'folha:view' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L41) |
| GET | `/payroll/accounting/config` | 'folha:accounting' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L49) |
| POST | `/payroll/accounting/config` | 'folha:accounting' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L55) |
| GET | `/payroll/runs/:id/accounting` | 'folha:accounting' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L61) |
| GET | `/payroll/bank/config` | 'folha:bank' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L69) |
| POST | `/payroll/bank/config` | 'folha:bank' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L75) |
| GET | `/payroll/bank/batches` | 'folha:bank' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L81) |
| POST | `/payroll/runs/:id/bank/batch` | 'folha:bank' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L87) |
| POST | `/payroll/bank/batches/:id/approve` | 'folha:bank' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L93) |
| POST | `/payroll/bank/batches/:id/export` | 'folha:bank' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L99) |
| POST | `/payroll/bank/batches/:id/return` | 'folha:bank' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L108) |
| GET | `/payroll/obligations` | 'folha:view' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L116) |
| POST | `/payroll/obligations/generate` | 'folha:operate' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L122) |
| POST | `/payroll/obligations/:id` | 'folha:operate' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L128) |
| POST | `/payroll/obligations/:id/attachment` | 'folha:operate' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L134) |
| POST | `/payroll/obligations/qualif-cad/:periodRef` | 'folha:operate' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L140) |
| POST | `/payroll/obligations/:id/qualif-cad-return` | 'folha:operate' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L150) |
| GET | `/payroll/competences` | 'folha:view' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L158) |
| POST | `/payroll/competences` | 'folha:operate' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L164) |
| POST | `/payroll/runs` | 'folha:operate' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L172) |
| GET | `/payroll/runs/:id` | 'folha:operate' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L178) |
| POST | `/payroll/runs/:id/import-timekeeping` | 'folha:operate' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L184) |
| POST | `/payroll/runs/:id/calculate` | 'folha:operate' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L190) |
| POST | `/payroll/runs/:id/approve` | 'folha:approve' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L196) |
| POST | `/payroll/runs/:id/close` | 'folha:close' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L202) |
| POST | `/payroll/runs/:id/reopen` | 'folha:close' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L208) |
| GET | `/payroll/workers/:id/memory` | 'folha:operate' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L214) |
| GET | `/payroll/my-payslips` | JWT/guardas de classe; conferir fonte | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L222) |
| GET | `/payroll/my-payslips/:id` | JWT/guardas de classe; conferir fonte | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L227) |
| GET | `/payroll/my-income-report` | JWT/guardas de classe; conferir fonte | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L233) |
| GET | `/payroll/employees/:employeeId/income-report` | 'folha:view' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L238) |
| GET | `/payroll/rubrics` | 'folha:params' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L246) |
| GET | `/payroll/legal-tables` | 'folha:params' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L252) |
| POST | `/payroll/legal-tables` | 'folha:params' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L258) |
| GET | `/payroll/company-settings` | 'folha:view' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L267) |
| PATCH | `/payroll/company-settings` | 'folha:params' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L273) |
| GET | `/payroll/vacations` | 'folha:view' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L281) |
| POST | `/payroll/vacations/payroll-inputs` | 'folha:operate' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L288) |
| GET | `/payroll/terminations` | 'folha:view' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L296) |
| POST | `/payroll/terminations/preview` | 'folha:operate' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L303) |
| POST | `/payroll/terminations` | 'folha:operate' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L309) |
| GET | `/payroll/benefits` | 'folha:view' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L317) |
| POST | `/payroll/benefits` | 'folha:params' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L323) |
| POST | `/payroll/benefits/enroll` | 'folha:operate' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L329) |
| GET | `/payroll/loans` | 'folha:view' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L335) |
| POST | `/payroll/loans` | 'folha:operate' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L341) |
| GET | `/payroll/pensions` | 'folha:view' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L347) |
| POST | `/payroll/pensions` | 'folha:operate' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L353) |
| GET | `/payroll/digital-certificates` | 'folha:esocial' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L361) |
| POST | `/payroll/digital-certificates` | 'folha:esocial' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L367) |
| POST | `/payroll/digital-certificates/upload` | 'folha:esocial' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L374) |
| POST | `/payroll/digital-certificates/:id/test` | 'folha:esocial' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L380) |
| GET | `/payroll/esocial/events` | 'folha:esocial' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L386) |
| POST | `/payroll/runs/:id/esocial/events` | 'folha:esocial' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L392) |
| POST | `/payroll/runs/:id/esocial/rubric-table` | 'folha:esocial' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L398) |
| POST | `/payroll/runs/:id/esocial/closing` | 'folha:esocial' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L404) |
| POST | `/payroll/runs/:id/esocial/admission` | 'folha:esocial' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L410) |
| POST | `/payroll/runs/:id/esocial/payments` | 'folha:esocial' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L416) |
| POST | `/payroll/runs/:id/esocial/reconcile` | 'folha:esocial' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L422) |
| POST | `/payroll/runs/:id/esocial/validate-xsd` | 'folha:esocial' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L429) |
| GET | `/payroll/esocial/batches` | 'folha:esocial' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L435) |
| POST | `/payroll/esocial/batches` | 'folha:esocial' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L441) |
| POST | `/payroll/esocial/batches/:id/sign` | 'folha:esocial' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L447) |
| POST | `/payroll/esocial/batches/:id/transmit` | 'folha:esocial' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L454) |
| POST | `/payroll/esocial/batches/:id/query` | 'folha:esocial' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L460) |
| GET | `/payroll/esocial/batches/:id/xml` | 'folha:esocial' | Sim | [controller](../apps/api/src/modules/payroll/payroll.controller.ts#L466) |

### periods

Fonte: [diretório](../apps/api/src/modules/periods). 4 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/periods` | 'settings:manage' | Não | [controller](../apps/api/src/modules/periods/periods.controller.ts#L12) |
| POST | `/periods` | 'settings:manage' | Não | [controller](../apps/api/src/modules/periods/periods.controller.ts#L17) |
| PATCH | `/periods/:id/current` | 'settings:manage' | Não | [controller](../apps/api/src/modules/periods/periods.controller.ts#L22) |
| POST | `/periods/:id/close` | 'settings:manage' | Não | [controller](../apps/api/src/modules/periods/periods.controller.ts#L27) |

### personnel

Fonte: [diretório](../apps/api/src/modules/personnel). 118 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/personnel/biometrics/me` | 'ponto:view' | Sim | [controller](../apps/api/src/modules/personnel/biometric.controller.ts#L16) |
| GET | `/personnel/biometrics/employees` | 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/biometric.controller.ts#L20) |
| POST | `/personnel/biometrics/employees/:employeeId/challenge` | 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/biometric.controller.ts#L30) |
| POST | `/personnel/biometrics/employees/:employeeId/enroll` | 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/biometric.controller.ts#L36) |
| POST | `/personnel/biometrics/employees/:employeeId/revoke` | 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/biometric.controller.ts#L43) |
| POST | `/personnel/biometrics/challenge/enroll` | 'ponto:view' | Sim | [controller](../apps/api/src/modules/personnel/biometric.controller.ts#L49) |
| POST | `/personnel/biometrics/challenge/punch` | 'ponto:clock' | Sim | [controller](../apps/api/src/modules/personnel/biometric.controller.ts#L54) |
| POST | `/personnel/biometrics/enroll` | 'ponto:view' | Sim | [controller](../apps/api/src/modules/personnel/biometric.controller.ts#L58) |
| POST | `/personnel/biometrics/verify-and-punch` | 'ponto:clock' | Sim | [controller](../apps/api/src/modules/personnel/biometric.controller.ts#L63) |
| POST | `/personnel/biometrics/revoke` | 'ponto:view' | Sim | [controller](../apps/api/src/modules/personnel/biometric.controller.ts#L69) |
| GET | `/personnel/employees` | 'pessoal:view' | Sim | [controller](../apps/api/src/modules/personnel/employees.controller.ts#L12) |
| GET | `/personnel/employees/options` | 'pessoal:view' | Sim | [controller](../apps/api/src/modules/personnel/employees.controller.ts#L23) |
| POST | `/personnel/employees/import` | 'pessoal:manage' | Sim | [controller](../apps/api/src/modules/personnel/employees.controller.ts#L29) |
| POST | `/personnel/employees` | 'pessoal:create' | Sim | [controller](../apps/api/src/modules/personnel/employees.controller.ts#L35) |
| GET | `/personnel/employees/:id` | 'pessoal:view' | Sim | [controller](../apps/api/src/modules/personnel/employees.controller.ts#L41) |
| PATCH | `/personnel/employees/:id` | 'pessoal:update' | Sim | [controller](../apps/api/src/modules/personnel/employees.controller.ts#L47) |
| POST | `/personnel/employees/:id/portal-user` | 'pessoal:update' | Sim | [controller](../apps/api/src/modules/personnel/employees.controller.ts#L53) |
| POST | `/personnel/employees/:id/dependents` | 'pessoal:update' | Sim | [controller](../apps/api/src/modules/personnel/employees.controller.ts#L59) |
| DELETE | `/personnel/employees/:id/dependents/:dependentId` | 'pessoal:update' | Sim | [controller](../apps/api/src/modules/personnel/employees.controller.ts#L65) |
| POST | `/personnel/employees/:id/events` | 'pessoal:update' | Sim | [controller](../apps/api/src/modules/personnel/employees.controller.ts#L71) |
| POST | `/personnel/employees/:id/files` | 'pessoal:update' | Sim | [controller](../apps/api/src/modules/personnel/employees.controller.ts#L77) |
| GET | `/personnel/employees/:id/files/:fileId/download` | 'pessoal:view' | Sim | [controller](../apps/api/src/modules/personnel/employees.controller.ts#L83) |
| DELETE | `/personnel/employees/:id/files/:fileId` | 'pessoal:update' | Sim | [controller](../apps/api/src/modules/personnel/employees.controller.ts#L97) |
| POST | `/personnel/employees/:id/photo` | 'pessoal:update' | Sim | [controller](../apps/api/src/modules/personnel/employees.controller.ts#L103) |
| GET | `/personnel/employees/:id/photo` | 'pessoal:view' | Sim | [controller](../apps/api/src/modules/personnel/employees.controller.ts#L109) |
| GET | `/personnel/employees/:id/badge` | 'pessoal:view' | Sim | [controller](../apps/api/src/modules/personnel/employees.controller.ts#L115) |
| POST | `/personnel/kiosk/challenge` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/personnel/kiosk.controller.ts#L15) |
| POST | `/personnel/kiosk/identify-punch` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/personnel/kiosk.controller.ts#L24) |
| GET | `/personnel/kiosk/devices` | 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/kiosk.controller.ts#L32) |
| POST | `/personnel/kiosk/devices` | 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/kiosk.controller.ts#L38) |
| PATCH | `/personnel/kiosk/devices/:id` | 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/kiosk.controller.ts#L44) |
| POST | `/personnel/kiosk/devices/:id/rotate` | 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/kiosk.controller.ts#L50) |
| DELETE | `/personnel/kiosk/devices/:id` | 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/kiosk.controller.ts#L56) |
| GET | `/personnel/processes` | 'pessoal:view' | Sim | [controller](../apps/api/src/modules/personnel/lifecycle.controller.ts#L13) |
| POST | `/personnel/processes` | 'pessoal:update' | Sim | [controller](../apps/api/src/modules/personnel/lifecycle.controller.ts#L19) |
| GET | `/personnel/processes/:id` | 'pessoal:view' | Sim | [controller](../apps/api/src/modules/personnel/lifecycle.controller.ts#L25) |
| POST | `/personnel/processes/:id/items/:itemId/toggle` | 'pessoal:update' | Sim | [controller](../apps/api/src/modules/personnel/lifecycle.controller.ts#L31) |
| POST | `/personnel/processes/:id/complete` | 'pessoal:update' | Sim | [controller](../apps/api/src/modules/personnel/lifecycle.controller.ts#L37) |
| POST | `/personnel/processes/:id/cancel` | 'pessoal:update' | Sim | [controller](../apps/api/src/modules/personnel/lifecycle.controller.ts#L43) |
| GET | `/personnel/medical-exams` | 'pessoal:view' | Sim | [controller](../apps/api/src/modules/personnel/lifecycle.controller.ts#L51) |
| POST | `/personnel/medical-exams` | 'pessoal:update' | Sim | [controller](../apps/api/src/modules/personnel/lifecycle.controller.ts#L57) |
| DELETE | `/personnel/medical-exams/:id` | 'pessoal:update' | Sim | [controller](../apps/api/src/modules/personnel/lifecycle.controller.ts#L63) |
| GET | `/personnel/settings` | 'pessoal:view' | Sim | [controller](../apps/api/src/modules/personnel/personnel-settings.controller.ts#L11) |
| GET | `/personnel/settings/registration-preview` | 'pessoal:view' | Sim | [controller](../apps/api/src/modules/personnel/personnel-settings.controller.ts#L17) |
| PATCH | `/personnel/settings` | 'pessoal:settings' | Sim | [controller](../apps/api/src/modules/personnel/personnel-settings.controller.ts#L23) |
| POST | `/personnel/time-clock/punch` | 'ponto:clock' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L24) |
| GET | `/personnel/time-clock/summary` | 'ponto:view' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L30) |
| GET | `/personnel/time-clock/me` | 'ponto:view' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L36) |
| GET | `/personnel/time-clock/team` | 'ponto:team' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L42) |
| GET | `/personnel/time-clock/user/:userId` | 'ponto:team', 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L48) |
| GET | `/personnel/time-clock/team/dashboard` | 'ponto:team' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L54) |
| GET | `/personnel/time-clock/entries/:id/receipt` | 'ponto:view' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L60) |
| GET | `/personnel/time-clock/explain/:userId/:dayKey` | 'ponto:view', 'ponto:team' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L66) |
| POST | `/personnel/time-clock/adjustments` | 'ponto:view' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L74) |
| GET | `/personnel/time-clock/adjustments` | 'ponto:view' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L80) |
| GET | `/personnel/time-clock/adjustments/pending` | 'ponto:team', 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L88) |
| POST | `/personnel/time-clock/adjustments/:id/approve` | 'ponto:team', 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L94) |
| POST | `/personnel/time-clock/adjustments/:id/reject` | 'ponto:team', 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L100) |
| GET | `/personnel/occurrences` | 'ponto:team', 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L108) |
| GET | `/personnel/occurrences/mine` | 'ponto:view' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L114) |
| POST | `/personnel/occurrences/scan` | 'ponto:team', 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L120) |
| POST | `/personnel/occurrences/:id/justify` | 'ponto:team', 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L126) |
| POST | `/personnel/occurrences/:id/dismiss` | 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L132) |
| GET | `/personnel/time-bank/me` | 'ponto:view' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L140) |
| GET | `/personnel/time-bank/user/:userId` | 'ponto:team', 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L146) |
| POST | `/personnel/time-bank/entries` | 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L152) |
| GET | `/personnel/time-bank/policy` | 'ponto:view' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L158) |
| POST | `/personnel/time-bank/policy` | 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L164) |
| GET | `/personnel/payroll/rubrics` | 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L172) |
| POST | `/personnel/payroll/rubrics` | 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L178) |
| GET | `/personnel/payroll/events/:ref` | 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L184) |
| GET | `/personnel/payroll/exports` | 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L190) |
| GET | `/personnel/payroll/export/:ref` | 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L196) |
| GET | `/personnel/legal/config` | 'ponto:view' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L213) |
| POST | `/personnel/legal/config` | 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L219) |
| GET | `/personnel/legal/status` | 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L225) |
| GET | `/personnel/legal/afd/:ref` | 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L231) |
| GET | `/personnel/legal/aej/:ref` | 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L241) |
| GET | `/personnel/legal/afd/:ref/preview` | 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L251) |
| GET | `/personnel/legal/aej/:ref/preview` | 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L258) |
| GET | `/personnel/legal/mirror/:ref/:userId` | 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L265) |
| POST | `/personnel/time-clock/import` | 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L282) |
| GET | `/personnel/time-clock/periods/:ref/report` | 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L290) |
| GET | `/personnel/time-clock/periods/:ref/report.csv` | 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L296) |
| GET | `/personnel/time-clock/periods` | 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L309) |
| GET | `/personnel/time-clock/periods/:ref/preview` | 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L315) |
| POST | `/personnel/time-clock/periods/:ref/close` | 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L321) |
| POST | `/personnel/time-clock/periods/:ref/reopen` | 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L327) |
| GET | `/personnel/time-clock/periods/:ref/versions` | 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L333) |
| GET | `/personnel/holidays` | 'ponto:view' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L341) |
| POST | `/personnel/holidays` | 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L347) |
| POST | `/personnel/holidays/generate` | 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L353) |
| DELETE | `/personnel/holidays/:id` | 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L359) |
| GET | `/personnel/schedules` | 'ponto:view' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L367) |
| POST | `/personnel/schedules` | 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L373) |
| PATCH | `/personnel/schedules/:id` | 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L379) |
| GET | `/personnel/schedules/assignments` | 'ponto:team' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L385) |
| POST | `/personnel/schedules/assign` | 'ponto:manage' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L391) |
| GET | `/personnel/options` | 'ponto:team' | Sim | [controller](../apps/api/src/modules/personnel/personnel.controller.ts#L397) |
| GET | `/personnel/reports/overview` | 'pessoal:view' | Sim | [controller](../apps/api/src/modules/personnel/reports.controller.ts#L12) |
| GET | `/personnel/reports/turnover` | 'pessoal:view' | Sim | [controller](../apps/api/src/modules/personnel/reports.controller.ts#L18) |
| GET | `/personnel/reports/absenteeism` | 'pessoal:view' | Sim | [controller](../apps/api/src/modules/personnel/reports.controller.ts#L24) |
| GET | `/personnel/reports/overtime` | 'pessoal:view' | Sim | [controller](../apps/api/src/modules/personnel/reports.controller.ts#L30) |
| GET | `/personnel/reports/payroll/:ref/export.csv` | 'pessoal:view', 'pessoal:manage' | Sim | [controller](../apps/api/src/modules/personnel/reports.controller.ts#L36) |
| GET | `/personnel/reports/payroll/:ref/export.xlsx` | 'pessoal:view', 'pessoal:manage' | Sim | [controller](../apps/api/src/modules/personnel/reports.controller.ts#L45) |
| GET | `/personnel/vacations/me` | JWT/guardas de classe; conferir fonte | Sim | [controller](../apps/api/src/modules/personnel/vacations.controller.ts#L13) |
| POST | `/personnel/vacations/me` | JWT/guardas de classe; conferir fonte | Sim | [controller](../apps/api/src/modules/personnel/vacations.controller.ts#L18) |
| POST | `/personnel/vacations/me/:id/cancel` | JWT/guardas de classe; conferir fonte | Sim | [controller](../apps/api/src/modules/personnel/vacations.controller.ts#L23) |
| GET | `/personnel/vacations/balances` | 'pessoal:view' | Sim | [controller](../apps/api/src/modules/personnel/vacations.controller.ts#L30) |
| GET | `/personnel/vacations` | 'pessoal:view' | Sim | [controller](../apps/api/src/modules/personnel/vacations.controller.ts#L36) |
| POST | `/personnel/vacations` | 'pessoal:update' | Sim | [controller](../apps/api/src/modules/personnel/vacations.controller.ts#L42) |
| POST | `/personnel/vacations/:id/approve` | 'pessoal:update' | Sim | [controller](../apps/api/src/modules/personnel/vacations.controller.ts#L48) |
| POST | `/personnel/vacations/:id/reject` | 'pessoal:update' | Sim | [controller](../apps/api/src/modules/personnel/vacations.controller.ts#L54) |
| POST | `/personnel/vacations/:id/cancel` | 'pessoal:update' | Sim | [controller](../apps/api/src/modules/personnel/vacations.controller.ts#L60) |
| GET | `/personnel/leaves` | 'pessoal:view' | Sim | [controller](../apps/api/src/modules/personnel/vacations.controller.ts#L68) |
| POST | `/personnel/leaves` | 'pessoal:update' | Sim | [controller](../apps/api/src/modules/personnel/vacations.controller.ts#L74) |
| POST | `/personnel/leaves/:id/close` | 'pessoal:update' | Sim | [controller](../apps/api/src/modules/personnel/vacations.controller.ts#L80) |
| DELETE | `/personnel/leaves/:id` | 'pessoal:update' | Sim | [controller](../apps/api/src/modules/personnel/vacations.controller.ts#L86) |

### platform

Fonte: [diretório](../apps/api/src/modules/platform). 7 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/platform/overview` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/platform/platform.controller.ts#L19) |
| GET | `/platform/companies` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/platform/platform.controller.ts#L24) |
| POST | `/platform/switch` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/platform/platform.controller.ts#L30) |
| GET | `/platform/companies/:id` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/platform/platform.controller.ts#L35) |
| POST | `/platform/companies` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/platform/platform.controller.ts#L40) |
| PATCH | `/platform/companies/:id` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/platform/platform.controller.ts#L45) |
| PATCH | `/platform/companies/:id/status` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/platform/platform.controller.ts#L50) |

### platform-admin

Fonte: [diretório](../apps/api/src/modules/platform-admin). 220 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/platform-admin/admin/bootstrap` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L136) |
| GET | `/platform-admin/admin/permissions` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L141) |
| POST | `/platform-admin/admin/companies` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L146) |
| PATCH | `/platform-admin/admin/companies/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L151) |
| DELETE | `/platform-admin/admin/companies/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L156) |
| POST | `/platform-admin/admin/branches` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L161) |
| PATCH | `/platform-admin/admin/branches/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L166) |
| DELETE | `/platform-admin/admin/branches/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L171) |
| POST | `/platform-admin/admin/parameters/categories` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L176) |
| PATCH | `/platform-admin/admin/parameters/categories/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L181) |
| DELETE | `/platform-admin/admin/parameters/categories/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L186) |
| POST | `/platform-admin/admin/parameters/items` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L191) |
| PATCH | `/platform-admin/admin/parameters/items/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L196) |
| DELETE | `/platform-admin/admin/parameters/items/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L201) |
| POST | `/platform-admin/admin/security/profiles` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L206) |
| PATCH | `/platform-admin/admin/security/profiles/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L211) |
| PATCH | `/platform-admin/admin/security/profiles/:id/permissions` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L216) |
| DELETE | `/platform-admin/admin/security/profiles/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L221) |
| PUT | `/platform-admin/admin/system/settings` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L226) |
| GET | `/platform-admin/access/modules` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L245) |
| GET | `/platform-admin/access/areas` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L250) |
| GET | `/platform-admin/access/users/:userId/areas` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L255) |
| POST | `/platform-admin/access/users/:userId/areas` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L260) |
| DELETE | `/platform-admin/access/users/:userId/areas/:orgNodeId` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L266) |
| PATCH | `/platform-admin/access/users/:userId/primary-area` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L272) |
| GET | `/platform-admin/access/matrix` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L278) |
| POST | `/platform-admin/access/matrix` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L283) |
| DELETE | `/platform-admin/access/matrix/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L289) |
| GET | `/platform-admin/access/exceptions` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L295) |
| POST | `/platform-admin/access/exceptions` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L300) |
| DELETE | `/platform-admin/access/exceptions/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L306) |
| GET | `/platform-admin/access/simulate/:userId` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L312) |
| GET | `/platform-admin/orgnodes` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L327) |
| GET | `/platform-admin/orgnodes/tree` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L332) |
| POST | `/platform-admin/orgnodes` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L337) |
| PATCH | `/platform-admin/orgnodes/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L343) |
| PATCH | `/platform-admin/orgnodes/:id/move` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L348) |
| DELETE | `/platform-admin/orgnodes/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L353) |
| GET | `/platform-admin/company-audit` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L365) |
| GET | `/platform-admin/company-audit/exports/csv` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L385) |
| GET | `/platform-admin/integrations/external/keys` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L424) |
| POST | `/platform-admin/integrations/external/keys` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L429) |
| DELETE | `/platform-admin/integrations/external/keys/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L434) |
| GET | `/platform-admin/integrations/external` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L439) |
| POST | `/platform-admin/integrations/external` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L444) |
| GET | `/platform-admin/integrations/external/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L449) |
| PATCH | `/platform-admin/integrations/external/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L454) |
| DELETE | `/platform-admin/integrations/external/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L459) |
| POST | `/platform-admin/integrations/external/:id/test` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L464) |
| POST | `/platform-admin/integrations/external/:id/run` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L469) |
| GET | `/platform-admin/integrations/external/:id/logs` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L474) |
| GET | `/platform-admin/prize/eligible/connectors` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L489) |
| POST | `/platform-admin/prize/eligible/connectors` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L494) |
| PATCH | `/platform-admin/prize/eligible/connectors/:id` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L499) |
| DELETE | `/platform-admin/prize/eligible/connectors/:id` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L504) |
| POST | `/platform-admin/prize/eligible/connectors/:id/test` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L509) |
| GET | `/platform-admin/prize/eligible/jobs` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L514) |
| GET | `/platform-admin/lgpd/overview` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L529) |
| GET | `/platform-admin/lgpd/processing-records` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L534) |
| POST | `/platform-admin/lgpd/processing-records` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L539) |
| PATCH | `/platform-admin/lgpd/processing-records/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L544) |
| DELETE | `/platform-admin/lgpd/processing-records/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L549) |
| GET | `/platform-admin/lgpd/subprocessors` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L554) |
| POST | `/platform-admin/lgpd/subprocessors` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L559) |
| PATCH | `/platform-admin/lgpd/subprocessors/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L564) |
| DELETE | `/platform-admin/lgpd/subprocessors/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L569) |
| GET | `/platform-admin/lgpd/incidents` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L574) |
| POST | `/platform-admin/lgpd/incidents` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L579) |
| PATCH | `/platform-admin/lgpd/incidents/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L584) |
| DELETE | `/platform-admin/lgpd/incidents/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L589) |
| GET | `/platform-admin/admin/help` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L604) |
| POST | `/platform-admin/admin/help/categories` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L609) |
| PUT | `/platform-admin/admin/help/categories/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L614) |
| POST | `/platform-admin/admin/help/articles` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L619) |
| PUT | `/platform-admin/admin/help/articles/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L624) |
| POST | `/platform-admin/admin/help/articles/:id/status` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L629) |
| GET | `/platform-admin/admin/database/overview` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L653) |
| GET | `/platform-admin/admin/database/tables` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L659) |
| GET | `/platform-admin/admin/database/tables/:table/schema` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L665) |
| GET | `/platform-admin/admin/database/schema` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L677) |
| GET | `/platform-admin/admin/database/relationships` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L687) |
| GET | `/platform-admin/admin/database/indexes` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L693) |
| GET | `/platform-admin/admin/database/diagnostics` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L699) |
| POST | `/platform-admin/admin/database/diagnostics/run` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L705) |
| GET | `/platform-admin/admin/database/settings` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L711) |
| PUT | `/platform-admin/admin/database/settings` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L716) |
| GET | `/platform-admin/admin/database/audit` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L724) |
| POST | `/platform-admin/admin/database/query/validate` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L743) |
| POST | `/platform-admin/admin/database/query/execute` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L748) |
| POST | `/platform-admin/admin/database/query/explain` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L757) |
| GET | `/platform-admin/admin/database/query/history` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L763) |
| GET | `/platform-admin/admin/database/query/favorites` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L769) |
| POST | `/platform-admin/admin/database/query/favorites` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L775) |
| DELETE | `/platform-admin/admin/database/query/favorites/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L783) |
| POST | `/platform-admin/admin/database/structure/preview` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L791) |
| POST | `/platform-admin/admin/database/structure/execute` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L796) |
| GET | `/platform-admin/admin/database/tables/:table/rows` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L805) |
| POST | `/platform-admin/admin/database/tables/:table/rows` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L827) |
| PATCH | `/platform-admin/admin/database/tables/:table/rows` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L833) |
| POST | `/platform-admin/admin/database/tables/:table/rows/delete` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L839) |
| POST | `/platform-admin/admin/database/export` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L845) |
| POST | `/platform-admin/admin/database/import/preview` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L853) |
| POST | `/platform-admin/admin/database/import/commit` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L859) |
| GET | `/platform-admin/admin/database/backups` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L865) |
| POST | `/platform-admin/admin/database/backups` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L872) |
| GET | `/platform-admin/admin/database/backups/:id/download` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L893) |
| POST | `/platform-admin/admin/database/backups/:id/verify` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L902) |
| POST | `/platform-admin/admin/database/backups/:id/important` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L909) |
| DELETE | `/platform-admin/admin/database/backups/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L916) |
| POST | `/platform-admin/admin/database/backups/:id/restore` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L923) |
| GET | `/platform-admin/admin/portal/overview` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L959) |
| POST | `/platform-admin/admin/portal/registry/sync` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L960) |
| GET | `/platform-admin/admin/portal/modules` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L961) |
| PUT | `/platform-admin/admin/portal/modules/:code` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L962) |
| POST | `/platform-admin/admin/portal/modules/:code/status` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L963) |
| POST | `/platform-admin/admin/portal/modules/:code/enable` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L964) |
| POST | `/platform-admin/admin/portal/modules/:code/disable` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L965) |
| POST | `/platform-admin/admin/portal/modules/:code/maintenance` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L966) |
| GET | `/platform-admin/admin/portal/pages` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L967) |
| POST | `/platform-admin/admin/portal/pages/:code/status` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L968) |
| PUT | `/platform-admin/admin/portal/pages/:code` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L969) |
| GET | `/platform-admin/admin/portal/features` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L970) |
| POST | `/platform-admin/admin/portal/features/:code/status` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L971) |
| PUT | `/platform-admin/admin/portal/features/:code` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L972) |
| GET | `/platform-admin/admin/portal/flags` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L973) |
| PUT | `/platform-admin/admin/portal/flags` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L974) |
| DELETE | `/platform-admin/admin/portal/flags/:key` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L975) |
| GET | `/platform-admin/admin/portal/audit` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L976) |
| GET | `/platform-admin/admin/portal/navigation` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L977) |
| PUT | `/platform-admin/admin/portal/navigation` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L978) |
| POST | `/platform-admin/admin/portal/navigation/reorder` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L979) |
| DELETE | `/platform-admin/admin/portal/navigation/:itemKey` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L980) |
| GET | `/platform-admin/admin/portal/scope` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L981) |
| GET | `/platform-admin/admin/portal/scope/options` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L982) |
| POST | `/platform-admin/admin/portal/scope` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L983) |
| DELETE | `/platform-admin/admin/portal/scope/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L984) |
| GET | `/platform-admin/admin/portal/maintenance` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L985) |
| POST | `/platform-admin/admin/portal/maintenance` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L986) |
| PUT | `/platform-admin/admin/portal/maintenance/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L987) |
| DELETE | `/platform-admin/admin/portal/maintenance/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L988) |
| GET | `/platform-admin/admin/portal/parameters` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L989) |
| PUT | `/platform-admin/admin/portal/parameters` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L990) |
| GET | `/platform-admin/admin/portal/integrations` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L991) |
| POST | `/platform-admin/admin/portal/integrations/:code/test` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L992) |
| POST | `/platform-admin/admin/portal/integrations/:code/status` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L993) |
| GET | `/platform-admin/admin/portal/announcements` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L994) |
| POST | `/platform-admin/admin/portal/announcements` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L995) |
| PUT | `/platform-admin/admin/portal/announcements/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L996) |
| DELETE | `/platform-admin/admin/portal/announcements/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L997) |
| GET | `/platform-admin/admin/portal/snapshots` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L998) |
| POST | `/platform-admin/admin/portal/snapshots` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L999) |
| GET | `/platform-admin/admin/portal/snapshots/:id/diff` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L1000) |
| POST | `/platform-admin/admin/portal/snapshots/:id/restore` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L1001) |
| DELETE | `/platform-admin/admin/portal/snapshots/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L1002) |
| GET | `/platform-admin/admin/portal/diagnostics` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L1003) |
| POST | `/platform-admin/admin/portal/diagnostics/run` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L1004) |
| GET | `/platform-admin/admin/portal/permissions` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts#L1005) |
| POST | `/platform-admin/auth/login` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L49) |
| POST | `/platform-admin/auth/refresh` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L58) |
| POST | `/platform-admin/auth/logout` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L64) |
| GET | `/platform-admin/auth/me` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L72) |
| POST | `/platform-admin/sync-foundation` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L78) |
| GET | `/platform-admin/dashboard` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L84) |
| GET | `/platform-admin/seo-presence` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L90) |
| PATCH | `/platform-admin/seo-presence` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L96) |
| GET | `/platform-admin/companies` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L102) |
| POST | `/platform-admin/companies` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L120) |
| GET | `/platform-admin/companies/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L126) |
| PATCH | `/platform-admin/companies/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L132) |
| PATCH | `/platform-admin/companies/:id/status` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L142) |
| GET | `/platform-admin/modules` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L152) |
| GET | `/platform-admin/module-matrix` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L158) |
| GET | `/platform-admin/business-modules` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L164) |
| PATCH | `/platform-admin/companies/:companyId/business-modules/:businessCode` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L170) |
| GET | `/platform-admin/companies/:companyId/pages` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L181) |
| PATCH | `/platform-admin/companies/:companyId/pages/:pageCode` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L187) |
| PATCH | `/platform-admin/companies/:companyId/modules/:moduleCode` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L198) |
| POST | `/platform-admin/companies/:companyId/modules/apply-plan/:planCode` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L209) |
| GET | `/platform-admin/plans` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L219) |
| POST | `/platform-admin/plans` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L225) |
| GET | `/platform-admin/users` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L231) |
| GET | `/platform-admin/users/permissions` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L239) |
| GET | `/platform-admin/users/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L245) |
| POST | `/platform-admin/users` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L251) |
| PATCH | `/platform-admin/users/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L257) |
| PATCH | `/platform-admin/users/:id/permissions` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L263) |
| PATCH | `/platform-admin/users/:id/active` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L269) |
| PATCH | `/platform-admin/users/:id/status` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L275) |
| POST | `/platform-admin/users/:id/revoke-sessions` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L285) |
| DELETE | `/platform-admin/users/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L291) |
| GET | `/platform-admin/sessions` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L297) |
| POST | `/platform-admin/support-sessions` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L303) |
| PATCH | `/platform-admin/support-sessions/:id/end` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L309) |
| GET | `/platform-admin/database` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L315) |
| GET | `/platform-admin/audit` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L321) |
| GET | `/platform-admin/feature-flags` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L347) |
| POST | `/platform-admin/feature-flags` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L353) |
| GET | `/platform-admin/environments` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L359) |
| GET | `/platform-admin/integrations` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L365) |
| GET | `/platform-admin/email/settings` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L373) |
| PUT | `/platform-admin/email/settings` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L379) |
| POST | `/platform-admin/email/test` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L385) |
| GET | `/platform-admin/email/mailboxes` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L391) |
| POST | `/platform-admin/email/mailboxes` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L397) |
| PATCH | `/platform-admin/email/mailboxes/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L403) |
| POST | `/platform-admin/email/mailboxes/:id/default` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L409) |
| DELETE | `/platform-admin/email/mailboxes/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L415) |
| GET | `/platform-admin/jobs` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L421) |
| GET | `/platform-admin/maintenance` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L427) |
| POST | `/platform-admin/maintenance` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L433) |
| GET | `/platform-admin/inbox/contacts` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L441) |
| PATCH | `/platform-admin/inbox/contacts/:id/read` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L450) |
| DELETE | `/platform-admin/inbox/contacts/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L460) |
| GET | `/platform-admin/inbox/support-tickets` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L469) |
| GET | `/platform-admin/inbox/support-tickets/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L480) |
| POST | `/platform-admin/inbox/support-tickets/:id/messages` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L486) |
| PATCH | `/platform-admin/inbox/support-tickets/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-admin.controller.ts#L496) |
| GET | `/platform-admin/site-analytics/overview` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-site-analytics.controller.ts#L13) |
| GET | `/platform-admin/site-analytics/visits` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-site-analytics.controller.ts#L19) |
| GET | `/platform-admin/site-analytics/visits/:id` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/platform-admin/platform-site-analytics.controller.ts#L25) |

### portal-admin

Fonte: [diretório](../apps/api/src/modules/portal-admin). 48 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/admin/portal/overview` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-admin.controller.ts#L25) |
| POST | `/admin/portal/registry/sync` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-admin.controller.ts#L32) |
| GET | `/admin/portal/modules` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-admin.controller.ts#L39) |
| PUT | `/admin/portal/modules/:code` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-admin.controller.ts#L45) |
| POST | `/admin/portal/modules/:code/status` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-admin.controller.ts#L51) |
| POST | `/admin/portal/modules/:code/enable` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-admin.controller.ts#L57) |
| POST | `/admin/portal/modules/:code/disable` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-admin.controller.ts#L63) |
| POST | `/admin/portal/modules/:code/maintenance` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-admin.controller.ts#L69) |
| GET | `/admin/portal/pages` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-admin.controller.ts#L76) |
| POST | `/admin/portal/pages/:code/status` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-admin.controller.ts#L82) |
| PUT | `/admin/portal/pages/:code` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-admin.controller.ts#L88) |
| GET | `/admin/portal/features` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-admin.controller.ts#L95) |
| POST | `/admin/portal/features/:code/status` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-admin.controller.ts#L101) |
| PUT | `/admin/portal/features/:code` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-admin.controller.ts#L107) |
| GET | `/admin/portal/flags` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-admin.controller.ts#L114) |
| PUT | `/admin/portal/flags` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-admin.controller.ts#L120) |
| DELETE | `/admin/portal/flags/:key` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-admin.controller.ts#L126) |
| GET | `/admin/portal/audit` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-admin.controller.ts#L133) |
| GET | `/portal/config` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-config.controller.ts#L15) |
| GET | `/admin/portal/navigation` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-manage.controller.ts#L35) |
| PUT | `/admin/portal/navigation` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-manage.controller.ts#L36) |
| POST | `/admin/portal/navigation/reorder` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-manage.controller.ts#L37) |
| DELETE | `/admin/portal/navigation/:itemKey` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-manage.controller.ts#L38) |
| GET | `/admin/portal/scope` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-manage.controller.ts#L41) |
| GET | `/admin/portal/scope/options` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-manage.controller.ts#L42) |
| POST | `/admin/portal/scope` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-manage.controller.ts#L43) |
| DELETE | `/admin/portal/scope/:id` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-manage.controller.ts#L44) |
| GET | `/admin/portal/maintenance` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-manage.controller.ts#L47) |
| POST | `/admin/portal/maintenance` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-manage.controller.ts#L48) |
| PUT | `/admin/portal/maintenance/:id` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-manage.controller.ts#L49) |
| DELETE | `/admin/portal/maintenance/:id` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-manage.controller.ts#L50) |
| GET | `/admin/portal/parameters` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-manage.controller.ts#L53) |
| PUT | `/admin/portal/parameters` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-manage.controller.ts#L54) |
| GET | `/admin/portal/integrations` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-manage.controller.ts#L57) |
| POST | `/admin/portal/integrations/:code/test` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-manage.controller.ts#L58) |
| POST | `/admin/portal/integrations/:code/status` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-manage.controller.ts#L59) |
| GET | `/admin/portal/announcements` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-manage.controller.ts#L62) |
| POST | `/admin/portal/announcements` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-manage.controller.ts#L63) |
| PUT | `/admin/portal/announcements/:id` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-manage.controller.ts#L64) |
| DELETE | `/admin/portal/announcements/:id` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-manage.controller.ts#L65) |
| GET | `/admin/portal/snapshots` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-manage.controller.ts#L68) |
| POST | `/admin/portal/snapshots` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-manage.controller.ts#L69) |
| GET | `/admin/portal/snapshots/:id/diff` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-manage.controller.ts#L70) |
| POST | `/admin/portal/snapshots/:id/restore` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-manage.controller.ts#L71) |
| DELETE | `/admin/portal/snapshots/:id` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-manage.controller.ts#L72) |
| GET | `/admin/portal/diagnostics` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-manage.controller.ts#L75) |
| POST | `/admin/portal/diagnostics/run` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-manage.controller.ts#L76) |
| GET | `/admin/portal/permissions` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/portal-admin/controllers/portal-manage.controller.ts#L79) |

### prize

Fonte: [diretório](../apps/api/src/modules/prize). 138 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| POST | `/prize/actuals/competence/:competenceId/sync` | 'prize:actuals:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-actuals.controller.ts#L18) |
| POST | `/prize/actuals/competence/:competenceId/sync-catalog` | 'prize:actuals:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-actuals.controller.ts#L25) |
| GET | `/prize/actuals/competence/:competenceId` | 'prize:view' | Sim | [controller](../apps/api/src/modules/prize/prize-actuals.controller.ts#L31) |
| GET | `/prize/actuals/previsto-realizado/:competenceId` | 'prize:view' | Sim | [controller](../apps/api/src/modules/prize/prize-actuals.controller.ts#L37) |
| POST | `/prize/actuals/competence/:competenceId` | 'prize:actuals:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-actuals.controller.ts#L43) |
| POST | `/prize/actuals/competence/:competenceId/grid` | 'prize:actuals:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-actuals.controller.ts#L49) |
| POST | `/prize/actuals/competence/:competenceId/close` | 'prize:actuals:close' | Sim | [controller](../apps/api/src/modules/prize/prize-actuals.controller.ts#L55) |
| PATCH | `/prize/actuals/:actualId/status` | 'prize:actuals:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-actuals.controller.ts#L61) |
| POST | `/prize/actuals/:actualId/reopen` | 'prize:actuals:close' | Sim | [controller](../apps/api/src/modules/prize/prize-actuals.controller.ts#L67) |
| POST | `/prize/actuals/:actualId/evidence` | 'prize:actuals:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-actuals.controller.ts#L73) |
| DELETE | `/prize/actuals/:actualId/evidence/:evidenceId` | 'prize:actuals:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-actuals.controller.ts#L79) |
| GET | `/prize/annexes` | 'prize:view' | Sim | [controller](../apps/api/src/modules/prize/prize-annexes.controller.ts#L11) |
| GET | `/prize/annexes/compare` | 'prize:view' | Sim | [controller](../apps/api/src/modules/prize/prize-annexes.controller.ts#L17) |
| GET | `/prize/annexes/:id` | 'prize:view' | Sim | [controller](../apps/api/src/modules/prize/prize-annexes.controller.ts#L23) |
| GET | `/prize/annexes/:id/approvers` | 'prize:view' | Sim | [controller](../apps/api/src/modules/prize/prize-annexes.controller.ts#L29) |
| POST | `/prize/annexes` | 'prize:annex:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-annexes.controller.ts#L35) |
| POST | `/prize/annexes/:id/versions` | 'prize:annex:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-annexes.controller.ts#L41) |
| PATCH | `/prize/annexes/versions/:versionId` | 'prize:annex:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-annexes.controller.ts#L47) |
| POST | `/prize/annexes/versions/:versionId/submit` | 'prize:annex:submit' | Sim | [controller](../apps/api/src/modules/prize/prize-annexes.controller.ts#L53) |
| POST | `/prize/annexes/versions/:versionId/send-approval` | 'prize:annex:submit' | Sim | [controller](../apps/api/src/modules/prize/prize-annexes.controller.ts#L59) |
| POST | `/prize/annexes/versions/:versionId/decide` | 'prize:annex:approve' | Sim | [controller](../apps/api/src/modules/prize/prize-annexes.controller.ts#L69) |
| POST | `/prize/annexes/versions/:versionId/publish` | 'prize:annex:approve' | Sim | [controller](../apps/api/src/modules/prize/prize-annexes.controller.ts#L79) |
| POST | `/prize/annexes/versions/:versionId/archive` | 'prize:annex:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-annexes.controller.ts#L85) |
| POST | `/prize/calc/competence/:competenceId/run` | 'prize:calc:run' | Sim | [controller](../apps/api/src/modules/prize/prize-calc.controller.ts#L16) |
| POST | `/prize/calc/competence/:competenceId/run-v2` | 'prize:calc:run' | Sim | [controller](../apps/api/src/modules/prize/prize-calc.controller.ts#L22) |
| POST | `/prize/calc/competence/:competenceId/reprocess` | 'prize:calc:run' | Sim | [controller](../apps/api/src/modules/prize/prize-calc.controller.ts#L28) |
| GET | `/prize/calc/competence/:competenceId/results` | 'prize:view' | Sim | [controller](../apps/api/src/modules/prize/prize-calc.controller.ts#L34) |
| POST | `/prize/calc/competence/:competenceId/submit-review` | 'prize:calc:run' | Sim | [controller](../apps/api/src/modules/prize/prize-calc.controller.ts#L40) |
| POST | `/prize/calc/competence/:competenceId/approve` | 'prize:calc:approve' | Sim | [controller](../apps/api/src/modules/prize/prize-calc.controller.ts#L46) |
| POST | `/prize/calc/competence/:competenceId/reject` | 'prize:calc:approve' | Sim | [controller](../apps/api/src/modules/prize/prize-calc.controller.ts#L52) |
| GET | `/prize/calc/result/:resultId/memory` | 'prize:view' | Sim | [controller](../apps/api/src/modules/prize/prize-calc.controller.ts#L58) |
| GET | `/prize/calc/moderators` | 'prize:view' | Sim | [controller](../apps/api/src/modules/prize/prize-calc.controller.ts#L65) |
| POST | `/prize/calc/moderators` | 'prize:admin' | Sim | [controller](../apps/api/src/modules/prize/prize-calc.controller.ts#L71) |
| POST | `/prize/calc/moderators/seed-defaults` | 'prize:admin' | Sim | [controller](../apps/api/src/modules/prize/prize-calc.controller.ts#L78) |
| PATCH | `/prize/calc/moderators/:id` | 'prize:admin' | Sim | [controller](../apps/api/src/modules/prize/prize-calc.controller.ts#L84) |
| DELETE | `/prize/calc/moderators/:id` | 'prize:admin' | Sim | [controller](../apps/api/src/modules/prize/prize-calc.controller.ts#L90) |
| GET | `/prize/calc/competence/:competenceId/adjustments` | 'prize:view' | Sim | [controller](../apps/api/src/modules/prize/prize-calc.controller.ts#L97) |
| POST | `/prize/calc/competence/:competenceId/adjustments` | 'prize:adjustments:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-calc.controller.ts#L103) |
| PATCH | `/prize/calc/adjustments/:id/decide` | 'prize:adjustments:approve' | Sim | [controller](../apps/api/src/modules/prize/prize-calc.controller.ts#L109) |
| GET | `/prize/calc/competence/:competenceId/exceptions` | 'prize:view' | Sim | [controller](../apps/api/src/modules/prize/prize-calc.controller.ts#L116) |
| POST | `/prize/calc/competence/:competenceId/exceptions` | 'prize:adjustments:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-calc.controller.ts#L122) |
| PATCH | `/prize/calc/exceptions/:id/decide` | 'prize:adjustments:approve' | Sim | [controller](../apps/api/src/modules/prize/prize-calc.controller.ts#L128) |
| GET | `/prize/calc/competence/:competenceId/allocations` | 'prize:view' | Sim | [controller](../apps/api/src/modules/prize/prize-calc.controller.ts#L135) |
| POST | `/prize/calc/competence/:competenceId/allocations` | 'prize:adjustments:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-calc.controller.ts#L141) |
| GET | `/prize/catalog/areas` | 'prize:view' | Sim | [controller](../apps/api/src/modules/prize/prize-catalog.controller.ts#L11) |
| GET | `/prize/catalog/cargos` | 'prize:view' | Sim | [controller](../apps/api/src/modules/prize/prize-catalog.controller.ts#L17) |
| PATCH | `/prize/catalog/areas/:id` | 'prize:eligible:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-catalog.controller.ts#L23) |
| PATCH | `/prize/catalog/cargos/:id` | 'prize:eligible:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-catalog.controller.ts#L29) |
| POST | `/prize/catalog/areas/merge` | 'prize:eligible:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-catalog.controller.ts#L35) |
| POST | `/prize/catalog/cargos/merge` | 'prize:eligible:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-catalog.controller.ts#L41) |
| POST | `/prize/catalog/import` | 'prize:eligible:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-catalog.controller.ts#L47) |
| POST | `/prize/catalog/rebuild` | 'prize:eligible:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-catalog.controller.ts#L53) |
| POST | `/prize/competences/:id/autopilot` | 'prize:calc:run' | Sim | [controller](../apps/api/src/modules/prize/prize-competences.controller.ts#L16) |
| GET | `/prize/competences` | 'prize:view' | Sim | [controller](../apps/api/src/modules/prize/prize-competences.controller.ts#L22) |
| GET | `/prize/competences/:id` | 'prize:view' | Sim | [controller](../apps/api/src/modules/prize/prize-competences.controller.ts#L33) |
| GET | `/prize/competences/:id/checklist` | 'prize:view' | Sim | [controller](../apps/api/src/modules/prize/prize-competences.controller.ts#L39) |
| POST | `/prize/competences` | 'prize:competences:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-competences.controller.ts#L45) |
| PATCH | `/prize/competences/:id` | 'prize:competences:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-competences.controller.ts#L51) |
| PATCH | `/prize/competences/:id/status` | 'prize:competences:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-competences.controller.ts#L57) |
| POST | `/prize/competences/:id/close` | 'prize:competences:close' | Sim | [controller](../apps/api/src/modules/prize/prize-competences.controller.ts#L63) |
| POST | `/prize/competences/:id/reopen` | 'prize:competences:reopen' | Sim | [controller](../apps/api/src/modules/prize/prize-competences.controller.ts#L69) |
| GET | `/prize/eligible/competence/:competenceId` | 'prize:view' | Sim | [controller](../apps/api/src/modules/prize/prize-eligible.controller.ts#L17) |
| GET | `/prize/eligible/competence/:competenceId/reconciliation` | 'prize:view' | Sim | [controller](../apps/api/src/modules/prize/prize-eligible.controller.ts#L23) |
| GET | `/prize/eligible/competence/:competenceId/events` | 'prize:view' | Sim | [controller](../apps/api/src/modules/prize/prize-eligible.controller.ts#L29) |
| POST | `/prize/eligible/competence/:competenceId/import` | 'prize:eligible:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-eligible.controller.ts#L35) |
| POST | `/prize/eligible/competence/:competenceId/import/internal` | 'prize:eligible:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-eligible.controller.ts#L42) |
| POST | `/prize/eligible/competence/:competenceId/import/preview` | 'prize:eligible:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-eligible.controller.ts#L51) |
| POST | `/prize/eligible/competence/:competenceId/import/file` | 'prize:eligible:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-eligible.controller.ts#L58) |
| POST | `/prize/eligible/competence/:competenceId/atestados/preview` | 'prize:eligible:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-eligible.controller.ts#L65) |
| POST | `/prize/eligible/competence/:competenceId/atestados/file` | 'prize:eligible:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-eligible.controller.ts#L72) |
| GET | `/prize/eligible/template` | 'prize:eligible:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-eligible.controller.ts#L79) |
| PATCH | `/prize/eligible/employee/:snapshotId/eligibility` | 'prize:eligible:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-eligible.controller.ts#L88) |
| GET | `/prize/eligible/connectors` | 'prize:view' | Sim | [controller](../apps/api/src/modules/prize/prize-eligible.controller.ts#L95) |
| POST | `/prize/eligible/connectors` | 'prize:admin' | Sim | [controller](../apps/api/src/modules/prize/prize-eligible.controller.ts#L101) |
| PATCH | `/prize/eligible/connectors/:id` | 'prize:admin' | Sim | [controller](../apps/api/src/modules/prize/prize-eligible.controller.ts#L107) |
| POST | `/prize/eligible/connectors/:id/test` | 'prize:admin' | Sim | [controller](../apps/api/src/modules/prize/prize-eligible.controller.ts#L113) |
| GET | `/prize/eligible/jobs` | 'prize:view' | Sim | [controller](../apps/api/src/modules/prize/prize-eligible.controller.ts#L119) |
| GET | `/prize/indicators` | 'prize:view' | Sim | [controller](../apps/api/src/modules/prize/prize-indicators.controller.ts#L11) |
| GET | `/prize/indicators/platform-options` | 'prize:view' | Sim | [controller](../apps/api/src/modules/prize/prize-indicators.controller.ts#L24) |
| GET | `/prize/indicators/:id` | 'prize:view' | Sim | [controller](../apps/api/src/modules/prize/prize-indicators.controller.ts#L30) |
| POST | `/prize/indicators` | 'prize:indicators:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-indicators.controller.ts#L36) |
| PATCH | `/prize/indicators/:id` | 'prize:indicators:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-indicators.controller.ts#L42) |
| DELETE | `/prize/indicators/:id` | 'prize:indicators:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-indicators.controller.ts#L48) |
| POST | `/prize/indicators/:id/parameters` | 'prize:indicators:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-indicators.controller.ts#L54) |
| DELETE | `/prize/indicators/:id/parameters/:parameterId` | 'prize:indicators:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-indicators.controller.ts#L60) |
| POST | `/prize/indicators/:id/ranges` | 'prize:indicators:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-indicators.controller.ts#L66) |
| POST | `/prize/indicators/:id/ranges/suggest` | 'prize:indicators:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-indicators.controller.ts#L73) |
| POST | `/prize/indicators/:id/ranges/bulk` | 'prize:indicators:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-indicators.controller.ts#L84) |
| DELETE | `/prize/indicators/:id/ranges/:rangeId` | 'prize:indicators:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-indicators.controller.ts#L94) |
| GET | `/prize/payroll/batches` | 'prize:view' | Sim | [controller](../apps/api/src/modules/prize/prize-payroll.controller.ts#L13) |
| GET | `/prize/payroll/batches/:id` | 'prize:view' | Sim | [controller](../apps/api/src/modules/prize/prize-payroll.controller.ts#L19) |
| GET | `/prize/payroll/batches/:id/export` | 'prize:payroll:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-payroll.controller.ts#L25) |
| POST | `/prize/payroll/competence/:competenceId/generate` | 'prize:payroll:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-payroll.controller.ts#L34) |
| POST | `/prize/payroll/batches/:id/sent` | 'prize:payroll:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-payroll.controller.ts#L40) |
| POST | `/prize/payroll/batches/:id/return` | 'prize:payroll:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-payroll.controller.ts#L46) |
| POST | `/prize/payroll/batches/:id/cancel` | 'prize:payroll:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-payroll.controller.ts#L52) |
| GET | `/prize/payslips/mine` | JWT/guardas de classe; conferir fonte | Sim | [controller](../apps/api/src/modules/prize/prize-payslip.controller.ts#L14) |
| GET | `/prize/payslips/mine/:id` | JWT/guardas de classe; conferir fonte | Sim | [controller](../apps/api/src/modules/prize/prize-payslip.controller.ts#L19) |
| POST | `/prize/payslips/mine/:id/acknowledge` | JWT/guardas de classe; conferir fonte | Sim | [controller](../apps/api/src/modules/prize/prize-payslip.controller.ts#L24) |
| GET | `/prize/payslips/competence/:competenceId` | 'prize:view' | Sim | [controller](../apps/api/src/modules/prize/prize-payslip.controller.ts#L29) |
| GET | `/prize/payslips/:id` | 'prize:view' | Sim | [controller](../apps/api/src/modules/prize/prize-payslip.controller.ts#L35) |
| POST | `/prize/payslips/competence/:competenceId/generate` | 'prize:payslip:publish' | Sim | [controller](../apps/api/src/modules/prize/prize-payslip.controller.ts#L41) |
| POST | `/prize/payslips/competence/:competenceId/publish` | 'prize:payslip:publish' | Sim | [controller](../apps/api/src/modules/prize/prize-payslip.controller.ts#L47) |
| POST | `/prize/payslips/:id/publish` | 'prize:payslip:publish' | Sim | [controller](../apps/api/src/modules/prize/prize-payslip.controller.ts#L53) |
| POST | `/prize/payslips/:id/acknowledge` | 'prize:view' | Sim | [controller](../apps/api/src/modules/prize/prize-payslip.controller.ts#L59) |
| GET | `/prize/programs` | 'prize:view' | Sim | [controller](../apps/api/src/modules/prize/prize-programs.controller.ts#L11) |
| GET | `/prize/programs/:id` | 'prize:view' | Sim | [controller](../apps/api/src/modules/prize/prize-programs.controller.ts#L17) |
| POST | `/prize/programs` | 'prize:programs:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-programs.controller.ts#L23) |
| PATCH | `/prize/programs/:id` | 'prize:programs:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-programs.controller.ts#L29) |
| POST | `/prize/programs/:id/duplicate` | 'prize:programs:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-programs.controller.ts#L35) |
| PATCH | `/prize/programs/:id/status` | 'prize:programs:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-programs.controller.ts#L41) |
| DELETE | `/prize/programs/:id` | 'prize:programs:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-programs.controller.ts#L47) |
| GET | `/prize/reports/apuracao/:competenceId` | 'prize:reports:view' | Sim | [controller](../apps/api/src/modules/prize/prize-reports.controller.ts#L16) |
| GET | `/prize/reports/apuracao/:competenceId/export` | 'prize:reports:view' | Sim | [controller](../apps/api/src/modules/prize/prize-reports.controller.ts#L22) |
| GET | `/prize/reports/operational` | 'prize:reports:view' | Sim | [controller](../apps/api/src/modules/prize/prize-reports.controller.ts#L31) |
| POST | `/prize/reports/ai/memory/:resultId` | 'prize:reports:view' | Sim | [controller](../apps/api/src/modules/prize/prize-reports.controller.ts#L38) |
| POST | `/prize/reports/ai/competence/:competenceId` | 'prize:reports:view' | Sim | [controller](../apps/api/src/modules/prize/prize-reports.controller.ts#L44) |
| GET | `/prize/rules/catalog` | 'prize:view' | Sim | [controller](../apps/api/src/modules/prize/prize-rules.controller.ts#L21) |
| POST | `/prize/rules/catalog` | 'prize:indicators:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-rules.controller.ts#L27) |
| PATCH | `/prize/rules/catalog/:id` | 'prize:indicators:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-rules.controller.ts#L33) |
| GET | `/prize/rules/groups` | 'prize:view' | Sim | [controller](../apps/api/src/modules/prize/prize-rules.controller.ts#L39) |
| POST | `/prize/rules/groups` | 'prize:annex:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-rules.controller.ts#L49) |
| PATCH | `/prize/rules/groups/:id` | 'prize:annex:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-rules.controller.ts#L55) |
| DELETE | `/prize/rules/groups/:id` | 'prize:annex:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-rules.controller.ts#L61) |
| POST | `/prize/rules/groups/:groupId/indicators` | 'prize:indicators:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-rules.controller.ts#L67) |
| PATCH | `/prize/rules/indicators/:id` | 'prize:indicators:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-rules.controller.ts#L73) |
| DELETE | `/prize/rules/indicators/:id` | 'prize:indicators:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-rules.controller.ts#L79) |
| POST | `/prize/rules/indicators/:id/parameters` | 'prize:indicators:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-rules.controller.ts#L85) |
| POST | `/prize/rules/parameters/:id/bands/suggest` | 'prize:indicators:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-rules.controller.ts#L91) |
| POST | `/prize/rules/parameters/:id/bands/bulk` | 'prize:indicators:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-rules.controller.ts#L97) |
| GET | `/prize/rules/competence/:competenceId/catalog-actuals` | 'prize:view' | Sim | [controller](../apps/api/src/modules/prize/prize-rules.controller.ts#L103) |
| POST | `/prize/rules/competence/:competenceId/catalog-actuals` | 'prize:actuals:manage' | Sim | [controller](../apps/api/src/modules/prize/prize-rules.controller.ts#L109) |
| GET | `/prize/rules/competence/:competenceId/cells` | 'prize:view' | Sim | [controller](../apps/api/src/modules/prize/prize-rules.controller.ts#L115) |
| GET | `/prize/rules/competence/:competenceId/unmatched` | 'prize:view' | Sim | [controller](../apps/api/src/modules/prize/prize-rules.controller.ts#L121) |
| GET | `/prize/rules/aliases` | 'prize:view' | Sim | [controller](../apps/api/src/modules/prize/prize-rules.controller.ts#L127) |
| POST | `/prize/rules/aliases` | 'prize:admin' | Sim | [controller](../apps/api/src/modules/prize/prize-rules.controller.ts#L133) |
| GET | `/prize/overview` | 'prize:view' | Sim | [controller](../apps/api/src/modules/prize/prize.controller.ts#L15) |
| GET | `/prize/audit` | 'prize:reports:view' | Sim | [controller](../apps/api/src/modules/prize/prize.controller.ts#L21) |

### processes

Fonte: [diretório](../apps/api/src/modules/processes). 26 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/processes/governance/dashboard` | 'processes:view' | Não | [controller](../apps/api/src/modules/processes/process-governance.controller.ts#L13) |
| POST | `/processes/governance/validate-bpmn` | 'processes:update' | Não | [controller](../apps/api/src/modules/processes/process-governance.controller.ts#L16) |
| GET | `/processes/governance/targets` | 'processes:view' | Não | [controller](../apps/api/src/modules/processes/process-governance.controller.ts#L21) |
| GET | `/processes/governance/subjects` | 'processes:view' | Não | [controller](../apps/api/src/modules/processes/process-governance.controller.ts#L24) |
| GET | `/processes/governance/related` | 'processes:view' | Não | [controller](../apps/api/src/modules/processes/process-governance.controller.ts#L27) |
| GET | `/processes/:id/context` | 'processes:view' | Não | [controller](../apps/api/src/modules/processes/process-governance.controller.ts#L30) |
| POST | `/processes/:id/artifacts` | 'processes:update' | Não | [controller](../apps/api/src/modules/processes/process-governance.controller.ts#L33) |
| GET | `/processes/governance/artifacts/:id` | 'processes:view' | Não | [controller](../apps/api/src/modules/processes/process-governance.controller.ts#L36) |
| PATCH | `/processes/governance/artifacts/:id` | 'processes:update' | Não | [controller](../apps/api/src/modules/processes/process-governance.controller.ts#L39) |
| POST | `/processes/governance/artifacts/:id/transition` | 'processes:update', 'processes:approve', 'processes:publish', 'processes:delete' | Não | [controller](../apps/api/src/modules/processes/process-governance.controller.ts#L42) |
| GET | `/processes/governance/artifacts/:id/versions/:versionId` | 'processes:view' | Não | [controller](../apps/api/src/modules/processes/process-governance.controller.ts#L45) |
| GET | `/processes/governance/artifacts/:id/versions` | 'processes:view' | Não | [controller](../apps/api/src/modules/processes/process-governance.controller.ts#L48) |
| GET | `/processes/governance/artifacts/:id/compare/:otherId` | 'processes:view' | Não | [controller](../apps/api/src/modules/processes/process-governance.controller.ts#L51) |
| PATCH | `/processes/governance/activities/:id` | 'processes:update' | Não | [controller](../apps/api/src/modules/processes/process-governance.controller.ts#L54) |
| POST | `/processes/:id/integrations` | 'processes:update' | Não | [controller](../apps/api/src/modules/processes/process-governance.controller.ts#L57) |
| DELETE | `/processes/governance/integrations/:id` | 'processes:update' | Não | [controller](../apps/api/src/modules/processes/process-governance.controller.ts#L60) |
| GET | `/processes` | 'processes:view' | Não | [controller](../apps/api/src/modules/processes/processes.controller.ts#L11) |
| GET | `/processes/summary` | 'processes:view' | Não | [controller](../apps/api/src/modules/processes/processes.controller.ts#L24) |
| GET | `/processes/options` | 'processes:view' | Não | [controller](../apps/api/src/modules/processes/processes.controller.ts#L30) |
| GET | `/processes/:id` | 'processes:view' | Não | [controller](../apps/api/src/modules/processes/processes.controller.ts#L36) |
| POST | `/processes` | 'processes:create' | Não | [controller](../apps/api/src/modules/processes/processes.controller.ts#L42) |
| PATCH | `/processes/:id` | 'processes:update' | Não | [controller](../apps/api/src/modules/processes/processes.controller.ts#L48) |
| DELETE | `/processes/:id` | 'processes:delete' | Não | [controller](../apps/api/src/modules/processes/processes.controller.ts#L54) |
| POST | `/processes/:id/steps` | 'processes:update' | Não | [controller](../apps/api/src/modules/processes/processes.controller.ts#L60) |
| PATCH | `/processes/steps/:stepId` | 'processes:update' | Não | [controller](../apps/api/src/modules/processes/processes.controller.ts#L66) |
| DELETE | `/processes/steps/:stepId` | 'processes:update' | Não | [controller](../apps/api/src/modules/processes/processes.controller.ts#L72) |

### projects

Fonte: [diretório](../apps/api/src/modules/projects). 12 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/projects` | 'projects:view' | Não | [controller](../apps/api/src/modules/projects/projects.controller.ts#L11) |
| GET | `/projects/indicators` | 'projects:view' | Não | [controller](../apps/api/src/modules/projects/projects.controller.ts#L22) |
| GET | `/projects/portfolio` | 'projects:view' | Não | [controller](../apps/api/src/modules/projects/projects.controller.ts#L28) |
| GET | `/projects/:id` | 'projects:view' | Não | [controller](../apps/api/src/modules/projects/projects.controller.ts#L39) |
| POST | `/projects` | 'projects:create' | Não | [controller](../apps/api/src/modules/projects/projects.controller.ts#L45) |
| PATCH | `/projects/:id` | 'projects:update' | Não | [controller](../apps/api/src/modules/projects/projects.controller.ts#L51) |
| DELETE | `/projects/:id` | 'projects:delete' | Não | [controller](../apps/api/src/modules/projects/projects.controller.ts#L57) |
| POST | `/projects/:id/milestones` | 'projects:update' | Não | [controller](../apps/api/src/modules/projects/projects.controller.ts#L63) |
| PATCH | `/projects/milestones/:id` | 'projects:update' | Não | [controller](../apps/api/src/modules/projects/projects.controller.ts#L69) |
| POST | `/projects/:id/tasks` | 'projects:update' | Não | [controller](../apps/api/src/modules/projects/projects.controller.ts#L75) |
| PATCH | `/projects/tasks/:id` | 'projects:update' | Não | [controller](../apps/api/src/modules/projects/projects.controller.ts#L81) |
| DELETE | `/projects/tasks/:id` | 'projects:update' | Não | [controller](../apps/api/src/modules/projects/projects.controller.ts#L87) |

### public

Fonte: [diretório](../apps/api/src/modules/public). 3 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| POST | `/public/contact` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/public/public.controller.ts#L20) |
| GET | `/public/tenant` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/public/public.controller.ts#L32) |
| GET | `/public/tenant/allow` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/public/public.controller.ts#L43) |

### push

Fonte: [diretório](../apps/api/src/modules/push). 4 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/push/public-key` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/push/push.controller.ts#L10) |
| POST | `/push/subscribe` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/push/push.controller.ts#L15) |
| POST | `/push/unsubscribe` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/push/push.controller.ts#L20) |
| POST | `/push/test` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/push/push.controller.ts#L25) |

### recruitment

Fonte: [diretório](../apps/api/src/modules/recruitment). 116 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/careers/company` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/recruitment/careers.controller.ts#L32) |
| GET | `/careers/global` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/recruitment/careers.controller.ts#L38) |
| GET | `/careers/assets/:kind` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/recruitment/careers.controller.ts#L50) |
| GET | `/careers/vacancies` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/recruitment/careers.controller.ts#L64) |
| GET | `/careers/vacancies/:slug` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/recruitment/careers.controller.ts#L77) |
| GET | `/careers/vacancies/:slug/screening-questions` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/recruitment/careers.controller.ts#L83) |
| POST | `/careers/candidates/register` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/recruitment/careers.controller.ts#L92) |
| POST | `/careers/candidates/request-code` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/recruitment/careers.controller.ts#L98) |
| POST | `/careers/candidates/login` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/recruitment/careers.controller.ts#L104) |
| POST | `/careers/candidates/forgot-password` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/recruitment/careers.controller.ts#L110) |
| POST | `/careers/candidates/reset-password` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/recruitment/careers.controller.ts#L116) |
| GET | `/careers/candidates/oauth/providers` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/recruitment/careers.controller.ts#L125) |
| GET | `/careers/candidates/oauth/:provider/start` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/recruitment/careers.controller.ts#L131) |
| GET | `/careers/candidates/oauth/:provider/callback` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/recruitment/careers.controller.ts#L140) |
| GET | `/careers/candidate/me` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/recruitment/careers.controller.ts#L152) |
| PATCH | `/careers/candidate/me` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/recruitment/careers.controller.ts#L159) |
| POST | `/careers/vacancies/:slug/apply` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/recruitment/careers.controller.ts#L166) |
| GET | `/careers/candidate/applications` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/recruitment/careers.controller.ts#L183) |
| POST | `/careers/candidate/applications/:id/withdraw` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/recruitment/careers.controller.ts#L190) |
| POST | `/careers/candidate/documents` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/recruitment/careers.controller.ts#L197) |
| GET | `/careers/candidate/documents` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/recruitment/careers.controller.ts#L204) |
| GET | `/careers/candidate/documents/:id` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/recruitment/careers.controller.ts#L211) |
| DELETE | `/careers/candidate/documents/:id` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/recruitment/careers.controller.ts#L218) |
| GET | `/careers/candidate/data-requests` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/recruitment/careers.controller.ts#L225) |
| POST | `/careers/candidate/data-requests` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/recruitment/careers.controller.ts#L232) |
| GET | `/careers/candidate/offers` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/recruitment/careers.controller.ts#L239) |
| POST | `/careers/candidate/offers/:id/decision` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/recruitment/careers.controller.ts#L246) |
| GET | `/careers/candidate/pre-admissions` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/recruitment/careers.controller.ts#L253) |
| POST | `/careers/candidate/pre-admission-documents/:id/submit` | Pública; conferir autenticação específica | Sim | [controller](../apps/api/src/modules/recruitment/careers.controller.ts#L260) |
| GET | `/recruitment/analytics/funnel` | 'recruit:view' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L43) |
| GET | `/recruitment/career-page` | 'recruit:view' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L51) |
| PATCH | `/recruitment/career-page` | 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L57) |
| POST | `/recruitment/career-page/assets/:kind` | 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L63) |
| DELETE | `/recruitment/career-page/assets/:kind` | 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L73) |
| GET | `/recruitment/candidates` | 'recruit:view' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L81) |
| GET | `/recruitment/candidates/tags` | 'recruit:view' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L92) |
| POST | `/recruitment/candidates/:id/tags` | 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L98) |
| GET | `/recruitment/email-templates` | 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L106) |
| POST | `/recruitment/email-templates/:event` | 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L112) |
| POST | `/recruitment/email-templates/:event/reset` | 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L118) |
| GET | `/recruitment/pipelines` | 'recruit:view' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L126) |
| POST | `/recruitment/pipelines` | 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L132) |
| GET | `/recruitment/postings` | 'recruit:view' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L140) |
| GET | `/recruitment/postings/:id` | 'recruit:view' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L146) |
| GET | `/recruitment/postings/:id/applications` | 'recruit:view' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L152) |
| GET | `/recruitment/postings/:id/stages` | 'recruit:view' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L158) |
| GET | `/recruitment/postings/:id/screening-questions` | 'recruit:view' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L164) |
| POST | `/recruitment/postings/:id/screening-questions` | 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L170) |
| POST | `/recruitment/screening-questions/:id/delete` | 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L176) |
| GET | `/recruitment/postings/:id/scorecard` | 'recruit:view' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L182) |
| POST | `/recruitment/postings/:id/scorecard` | 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L188) |
| POST | `/recruitment/scorecard/:id/delete` | 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L194) |
| GET | `/recruitment/application-documents/:id` | 'recruit:view' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L200) |
| GET | `/recruitment/applications/:id` | 'recruit:view' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L206) |
| POST | `/recruitment/applications/:id/move` | 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L212) |
| POST | `/recruitment/applications/:id/reject` | 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L218) |
| POST | `/recruitment/applications/bulk-move` | 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L224) |
| POST | `/recruitment/applications/bulk-reject` | 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L230) |
| POST | `/recruitment/applications/:id/notes` | 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L236) |
| GET | `/recruitment/applications/:id/evaluations` | 'recruit:view' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L242) |
| POST | `/recruitment/applications/:id/evaluations` | 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L248) |
| GET | `/recruitment/applications/:id/interviews` | 'recruit:view' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L254) |
| POST | `/recruitment/applications/:id/interviews` | 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L260) |
| POST | `/recruitment/interviews/:id/status` | 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L266) |
| GET | `/recruitment/applications/:id/assessments` | 'recruit:view' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L272) |
| POST | `/recruitment/applications/:id/assessments` | 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L278) |
| GET | `/recruitment/ai-settings` | 'recruit:view' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L284) |
| POST | `/recruitment/ai-settings` | 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L290) |
| POST | `/recruitment/applications/:id/ai-triage` | 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L296) |
| GET | `/recruitment/applications/:id/offers` | 'recruit:view' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L302) |
| POST | `/recruitment/applications/:id/offers` | 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L308) |
| POST | `/recruitment/offers/:id/approve` | 'recruit:offer:approve', 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L314) |
| POST | `/recruitment/offers/:id/send` | 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L320) |
| POST | `/recruitment/offers/:id/cancel` | 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L326) |
| GET | `/recruitment/applications/:id/pre-admissions` | 'recruit:view' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L332) |
| POST | `/recruitment/applications/:id/pre-admissions` | 'recruit:prehire', 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L338) |
| POST | `/recruitment/pre-admissions/:id/documents` | 'recruit:prehire', 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L344) |
| POST | `/recruitment/pre-admissions/:id/notify-documents` | 'recruit:prehire', 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L350) |
| POST | `/recruitment/pre-admission-documents/:id/review` | 'recruit:prehire', 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L356) |
| GET | `/recruitment/applications/:id/occupational-exams` | 'recruit:view' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L362) |
| POST | `/recruitment/applications/:id/occupational-exams` | 'recruit:prehire', 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L368) |
| GET | `/recruitment/occupational-exams` | 'saude:occupational' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L374) |
| GET | `/recruitment/occupational-exams/:id/medical` | 'saude:occupational' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L380) |
| POST | `/recruitment/occupational-exams/:id/schedule` | 'saude:occupational' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L386) |
| POST | `/recruitment/occupational-exams/:id/result` | 'saude:occupational' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L392) |
| POST | `/recruitment/occupational-exams/:id/cancel` | 'recruit:prehire', 'recruit:manage', 'saude:occupational' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L398) |
| GET | `/recruitment/applications/:id/admission` | 'recruit:view' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L404) |
| POST | `/recruitment/applications/:id/admission/authorize` | 'recruit:admit', 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L410) |
| POST | `/recruitment/probation-reviews/:id/complete` | 'recruit:admit', 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L416) |
| GET | `/recruitment/data-requests` | 'recruit:lgpd', 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L424) |
| GET | `/recruitment/data-requests/:id` | 'recruit:lgpd', 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L430) |
| POST | `/recruitment/data-requests/:id/resolve` | 'recruit:lgpd', 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L436) |
| GET | `/recruitment/candidates/:id/data-export` | 'recruit:lgpd', 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L442) |
| POST | `/recruitment/requisitions/:id/posting` | 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L448) |
| POST | `/recruitment/postings/:id` | 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L454) |
| POST | `/recruitment/postings/:id/publish` | 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L460) |
| POST | `/recruitment/postings/:id/status` | 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L466) |
| GET | `/recruitment/recruiters` | 'recruit:view' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L474) |
| GET | `/recruitment/recruiters/candidates` | 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L480) |
| POST | `/recruitment/recruiters` | 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L486) |
| PATCH | `/recruitment/recruiters/:id` | 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L492) |
| DELETE | `/recruitment/recruiters/:id` | 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L498) |
| GET | `/recruitment/requisitions` | 'recruit:view' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L504) |
| GET | `/recruitment/requisitions/:id` | 'recruit:view' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L510) |
| GET | `/recruitment/requisitions/:id/gate` | 'recruit:view' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L516) |
| POST | `/recruitment/requisitions` | 'recruit:requisition:create' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L522) |
| POST | `/recruitment/requisitions/:id/submit` | 'recruit:requisition:create' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L528) |
| POST | `/recruitment/requisitions/:id/decide` | 'recruit:requisition:approve' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L534) |
| POST | `/recruitment/requisitions/:id/gate-exception` | 'recruit:requisition:approve' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L540) |
| POST | `/recruitment/requisitions/:id/reassign-approver` | 'recruit:manage' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L546) |
| POST | `/recruitment/requisitions/:id/send-to-recruitment` | 'recruit:requisition:approve' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L552) |
| POST | `/recruitment/requisitions/:id/cancel` | 'recruit:requisition:create' | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L558) |
| GET | `/recruitment/internal-postings` | JWT/guardas de classe; conferir fonte | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L566) |
| GET | `/recruitment/internal-postings/my-applications` | JWT/guardas de classe; conferir fonte | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L571) |
| GET | `/recruitment/internal-postings/:id` | JWT/guardas de classe; conferir fonte | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L576) |
| POST | `/recruitment/internal-postings/:id/apply` | JWT/guardas de classe; conferir fonte | Sim | [controller](../apps/api/src/modules/recruitment/recruitment.controller.ts#L581) |

### reports

Fonte: [diretório](../apps/api/src/modules/reports). 4 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/reports/indicators.csv` | 'reports:export' | Não | [controller](../apps/api/src/modules/reports/reports.controller.ts#L13) |
| GET | `/reports/results.csv` | 'reports:export' | Não | [controller](../apps/api/src/modules/reports/reports.controller.ts#L19) |
| GET | `/reports/actions.csv` | 'reports:export' | Não | [controller](../apps/api/src/modules/reports/reports.controller.ts#L30) |
| GET | `/reports/deviations.csv` | 'reports:export' | Não | [controller](../apps/api/src/modules/reports/reports.controller.ts#L36) |

### results

Fonte: [diretório](../apps/api/src/modules/results). 5 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/results/pending` | 'launches:view' | Não | [controller](../apps/api/src/modules/results/results.controller.ts#L18) |
| GET | `/results/grain` | 'launches:view' | Não | [controller](../apps/api/src/modules/results/results.controller.ts#L37) |
| POST | `/results` | 'results:launch' | Não | [controller](../apps/api/src/modules/results/results.controller.ts#L52) |
| POST | `/results/batch` | 'results:launch' | Não | [controller](../apps/api/src/modules/results/results.controller.ts#L61) |
| POST | `/results/:id/approve` | 'results:approve' | Não | [controller](../apps/api/src/modules/results/results.controller.ts#L74) |

### risks

Fonte: [diretório](../apps/api/src/modules/risks). 7 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/risks` | 'risks:view' | Sim | [controller](../apps/api/src/modules/risks/risks.controller.ts#L13) |
| GET | `/risks/summary` | 'risks:view' | Sim | [controller](../apps/api/src/modules/risks/risks.controller.ts#L28) |
| GET | `/risks/options` | 'risks:view' | Sim | [controller](../apps/api/src/modules/risks/risks.controller.ts#L34) |
| GET | `/risks/:id` | 'risks:view' | Sim | [controller](../apps/api/src/modules/risks/risks.controller.ts#L40) |
| POST | `/risks` | 'risks:create' | Sim | [controller](../apps/api/src/modules/risks/risks.controller.ts#L46) |
| PATCH | `/risks/:id` | 'risks:update' | Sim | [controller](../apps/api/src/modules/risks/risks.controller.ts#L52) |
| DELETE | `/risks/:id` | 'risks:delete' | Sim | [controller](../apps/api/src/modules/risks/risks.controller.ts#L58) |

### search

Fonte: [diretório](../apps/api/src/modules/search). 1 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/search` | JWT/guardas de classe; conferir fonte | Não | [controller](../apps/api/src/modules/search/search.controller.ts#L10) |

### site-analytics

Fonte: [diretório](../apps/api/src/modules/site-analytics). 1 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| POST | `/public/site-events` | Pública; conferir autenticação específica | Não | [controller](../apps/api/src/modules/site-analytics/site-analytics.controller.ts#L16) |

### strategy

Fonte: [diretório](../apps/api/src/modules/strategy). 40 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/strategy/maps` | 'strategy:view' | Não | [controller](../apps/api/src/modules/strategy/strategy.controller.ts#L12) |
| GET | `/strategy/options` | 'strategy:view' | Não | [controller](../apps/api/src/modules/strategy/strategy.controller.ts#L17) |
| GET | `/strategy/maps/:id` | 'strategy:view' | Não | [controller](../apps/api/src/modules/strategy/strategy.controller.ts#L22) |
| POST | `/strategy/maps` | 'strategy:maps:create' | Não | [controller](../apps/api/src/modules/strategy/strategy.controller.ts#L31) |
| POST | `/strategy/maps/:id/duplicate` | 'strategy:maps:create' | Não | [controller](../apps/api/src/modules/strategy/strategy.controller.ts#L37) |
| PATCH | `/strategy/maps/:id` | 'strategy:maps:update' | Não | [controller](../apps/api/src/modules/strategy/strategy.controller.ts#L43) |
| DELETE | `/strategy/maps/:id` | 'strategy:maps:delete' | Não | [controller](../apps/api/src/modules/strategy/strategy.controller.ts#L49) |
| POST | `/strategy/maps/:id/perspectives` | 'strategy:perspectives:create' | Não | [controller](../apps/api/src/modules/strategy/strategy.controller.ts#L55) |
| PATCH | `/strategy/perspectives/:id` | 'strategy:perspectives:update' | Não | [controller](../apps/api/src/modules/strategy/strategy.controller.ts#L61) |
| DELETE | `/strategy/perspectives/:id` | 'strategy:perspectives:delete' | Não | [controller](../apps/api/src/modules/strategy/strategy.controller.ts#L67) |
| PATCH | `/strategy/maps/:id/perspectives/reorder` | 'strategy:perspectives:update' | Não | [controller](../apps/api/src/modules/strategy/strategy.controller.ts#L73) |
| POST | `/strategy/maps/:id/objectives` | 'strategy:objectives:create' | Não | [controller](../apps/api/src/modules/strategy/strategy.controller.ts#L79) |
| PATCH | `/strategy/objectives/:objId` | 'strategy:objectives:update' | Não | [controller](../apps/api/src/modules/strategy/strategy.controller.ts#L85) |
| DELETE | `/strategy/objectives/:objId` | 'strategy:objectives:delete' | Não | [controller](../apps/api/src/modules/strategy/strategy.controller.ts#L91) |
| PATCH | `/strategy/maps/:id/layout` | 'strategy:objectives:update' | Não | [controller](../apps/api/src/modules/strategy/strategy.controller.ts#L97) |
| POST | `/strategy/relations` | 'strategy:links:manage' | Não | [controller](../apps/api/src/modules/strategy/strategy.controller.ts#L103) |
| PATCH | `/strategy/relations/:id` | 'strategy:links:manage' | Não | [controller](../apps/api/src/modules/strategy/strategy.controller.ts#L109) |
| DELETE | `/strategy/relations/:id` | 'strategy:links:manage' | Não | [controller](../apps/api/src/modules/strategy/strategy.controller.ts#L115) |
| POST | `/strategy/objectives/:objId/indicators/:indicatorId` | 'strategy:indicators:link' | Não | [controller](../apps/api/src/modules/strategy/strategy.controller.ts#L121) |
| DELETE | `/strategy/objectives/:objId/indicators/:indicatorId` | 'strategy:indicators:link' | Não | [controller](../apps/api/src/modules/strategy/strategy.controller.ts#L127) |
| DELETE | `/strategy/indicators/:indicatorId/objective` | 'strategy:indicators:link' | Não | [controller](../apps/api/src/modules/strategy/strategy.controller.ts#L133) |
| POST | `/strategy/objectives/:objId/orgnodes/:orgNodeId` | 'strategy:objectives:update' | Não | [controller](../apps/api/src/modules/strategy/strategy.controller.ts#L139) |
| DELETE | `/strategy/objectives/:objId/orgnodes/:orgNodeId` | 'strategy:objectives:update' | Não | [controller](../apps/api/src/modules/strategy/strategy.controller.ts#L145) |
| GET | `/strategy/maps/:id/versions` | 'strategy:history:view' | Não | [controller](../apps/api/src/modules/strategy/strategy.controller.ts#L151) |
| POST | `/strategy/maps/:id/versions` | 'strategy:publish' | Não | [controller](../apps/api/src/modules/strategy/strategy.controller.ts#L157) |
| GET | `/strategy/organograma` | 'strategy:view' | Sim | [controller](../apps/api/src/modules/strategy/strategy.controller.ts#L163) |
| POST | `/strategy/jobs` | 'strategy:links:manage' | Sim | [controller](../apps/api/src/modules/strategy/strategy.controller.ts#L168) |
| PATCH | `/strategy/jobs/:id` | 'strategy:links:manage' | Sim | [controller](../apps/api/src/modules/strategy/strategy.controller.ts#L174) |
| DELETE | `/strategy/jobs/:id` | 'strategy:links:manage' | Sim | [controller](../apps/api/src/modules/strategy/strategy.controller.ts#L180) |
| POST | `/strategy/employees` | 'strategy:links:manage' | Sim | [controller](../apps/api/src/modules/strategy/strategy.controller.ts#L186) |
| PATCH | `/strategy/employees/:id` | 'strategy:links:manage' | Sim | [controller](../apps/api/src/modules/strategy/strategy.controller.ts#L192) |
| DELETE | `/strategy/employees/:id` | 'strategy:links:manage' | Sim | [controller](../apps/api/src/modules/strategy/strategy.controller.ts#L198) |
| POST | `/strategy/career-paths` | 'strategy:links:manage' | Sim | [controller](../apps/api/src/modules/strategy/strategy.controller.ts#L204) |
| DELETE | `/strategy/career-paths/:id` | 'strategy:links:manage' | Sim | [controller](../apps/api/src/modules/strategy/strategy.controller.ts#L210) |
| GET | `/strategy/career-approvals/approvers` | 'strategy:view' | Sim | [controller](../apps/api/src/modules/strategy/strategy.controller.ts#L217) |
| GET | `/strategy/career-approvals` | 'strategy:view' | Sim | [controller](../apps/api/src/modules/strategy/strategy.controller.ts#L222) |
| GET | `/strategy/career-approvals/:id` | 'strategy:view' | Sim | [controller](../apps/api/src/modules/strategy/strategy.controller.ts#L231) |
| POST | `/strategy/career-approvals` | 'strategy:view' | Sim | [controller](../apps/api/src/modules/strategy/strategy.controller.ts#L236) |
| PATCH | `/strategy/career-approvals/:id/decision` | 'strategy:view' | Sim | [controller](../apps/api/src/modules/strategy/strategy.controller.ts#L241) |
| PATCH | `/strategy/career-approvals/:id/cancel` | 'strategy:view' | Sim | [controller](../apps/api/src/modules/strategy/strategy.controller.ts#L250) |

### supplies

Fonte: [diretório](../apps/api/src/modules/supplies). 68 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/supplies-advanced/measurements` | 'compras:view', 'compras:buy', 'compras:approve' | Sim | [controller](../apps/api/src/modules/supplies/advanced-supplies.controller.ts#L12) |
| POST | `/supplies-advanced/measurements` | 'compras:buy', 'compras:manage' | Sim | [controller](../apps/api/src/modules/supplies/advanced-supplies.controller.ts#L13) |
| POST | `/supplies-advanced/measurements/:id/submit` | 'compras:buy', 'compras:manage' | Sim | [controller](../apps/api/src/modules/supplies/advanced-supplies.controller.ts#L14) |
| POST | `/supplies-advanced/measurements/:id/approve` | 'compras:approve', 'compras:manage' | Sim | [controller](../apps/api/src/modules/supplies/advanced-supplies.controller.ts#L15) |
| POST | `/supplies-advanced/measurements/:id/contest` | 'compras:approve', 'compras:manage' | Sim | [controller](../apps/api/src/modules/supplies/advanced-supplies.controller.ts#L16) |
| POST | `/supplies-advanced/invoices/service` | 'compras:buy', 'compras:manage' | Sim | [controller](../apps/api/src/modules/supplies/advanced-supplies.controller.ts#L17) |
| GET | `/supplies-advanced/inventory-counts` | 'estoque:view', 'estoque:operate' | Sim | [controller](../apps/api/src/modules/supplies/advanced-supplies.controller.ts#L18) |
| POST | `/supplies-advanced/inventory-counts` | 'estoque:manage', 'estoque:adjust' | Sim | [controller](../apps/api/src/modules/supplies/advanced-supplies.controller.ts#L19) |
| POST | `/supplies-advanced/inventory-counts/:id/start` | 'estoque:operate', 'estoque:manage' | Sim | [controller](../apps/api/src/modules/supplies/advanced-supplies.controller.ts#L20) |
| POST | `/supplies-advanced/inventory-counts/:id/record` | 'estoque:operate', 'estoque:manage' | Sim | [controller](../apps/api/src/modules/supplies/advanced-supplies.controller.ts#L21) |
| POST | `/supplies-advanced/inventory-counts/:id/complete` | 'estoque:adjust', 'estoque:manage' | Sim | [controller](../apps/api/src/modules/supplies/advanced-supplies.controller.ts#L22) |
| GET | `/supplies-advanced/abc-curve` | 'estoque:view' | Sim | [controller](../apps/api/src/modules/supplies/advanced-supplies.controller.ts#L23) |
| GET | `/supplies-advanced/qr/:token` | 'estoque:view' | Sim | [controller](../apps/api/src/modules/supplies/advanced-supplies.controller.ts#L24) |
| GET | `/supplies-advanced/withdrawal-policies` | 'estoque:view', 'estoque:manage' | Sim | [controller](../apps/api/src/modules/supplies/advanced-supplies.controller.ts#L25) |
| POST | `/supplies-advanced/withdrawal-policies` | 'estoque:manage' | Sim | [controller](../apps/api/src/modules/supplies/advanced-supplies.controller.ts#L26) |
| GET | `/inventory/dashboard` | 'estoque:view' | Sim | [controller](../apps/api/src/modules/supplies/inventory.controller.ts#L26) |
| GET | `/inventory/warehouses` | 'estoque:view' | Sim | [controller](../apps/api/src/modules/supplies/inventory.controller.ts#L30) |
| POST | `/inventory/warehouses` | 'estoque:manage' | Sim | [controller](../apps/api/src/modules/supplies/inventory.controller.ts#L34) |
| PATCH | `/inventory/warehouses/:id` | 'estoque:manage' | Sim | [controller](../apps/api/src/modules/supplies/inventory.controller.ts#L38) |
| GET | `/inventory/items` | 'estoque:view', 'compras:view' | Sim | [controller](../apps/api/src/modules/supplies/inventory.controller.ts#L42) |
| POST | `/inventory/items` | 'estoque:manage' | Sim | [controller](../apps/api/src/modules/supplies/inventory.controller.ts#L46) |
| PATCH | `/inventory/items/:id` | 'estoque:manage' | Sim | [controller](../apps/api/src/modules/supplies/inventory.controller.ts#L50) |
| GET | `/inventory/balances` | 'estoque:view' | Sim | [controller](../apps/api/src/modules/supplies/inventory.controller.ts#L54) |
| GET | `/inventory/movements` | 'estoque:view' | Sim | [controller](../apps/api/src/modules/supplies/inventory.controller.ts#L58) |
| POST | `/inventory/movements/adjust` | 'estoque:adjust', 'estoque:manage' | Sim | [controller](../apps/api/src/modules/supplies/inventory.controller.ts#L62) |
| POST | `/inventory/movements/transfer` | 'estoque:transfer', 'estoque:manage' | Sim | [controller](../apps/api/src/modules/supplies/inventory.controller.ts#L66) |
| GET | `/inventory/withdrawals` | 'estoque:view', 'estoque:withdraw', 'estoque:operate' | Sim | [controller](../apps/api/src/modules/supplies/inventory.controller.ts#L70) |
| POST | `/inventory/withdrawals` | 'estoque:withdraw', 'estoque:view' | Sim | [controller](../apps/api/src/modules/supplies/inventory.controller.ts#L74) |
| POST | `/inventory/withdrawals/:id/approve` | 'estoque:approve', 'estoque:manage' | Sim | [controller](../apps/api/src/modules/supplies/inventory.controller.ts#L78) |
| POST | `/inventory/withdrawals/:id/reject` | 'estoque:approve', 'estoque:manage' | Sim | [controller](../apps/api/src/modules/supplies/inventory.controller.ts#L82) |
| POST | `/inventory/withdrawals/:id/cancel` | 'estoque:withdraw', 'estoque:view' | Sim | [controller](../apps/api/src/modules/supplies/inventory.controller.ts#L86) |
| POST | `/inventory/withdrawals/:id/fulfill` | 'estoque:operate', 'estoque:manage' | Sim | [controller](../apps/api/src/modules/supplies/inventory.controller.ts#L90) |
| GET | `/inventory/imports/catalog-template` | 'estoque:manage' | Sim | [controller](../apps/api/src/modules/supplies/inventory.controller.ts#L94) |
| POST | `/inventory/imports/catalog` | 'estoque:manage' | Sim | [controller](../apps/api/src/modules/supplies/inventory.controller.ts#L103) |
| GET | `/procurement/dashboard` | 'compras:view', 'compras:buy', 'compras:approve', 'compras:manage' | Sim | [controller](../apps/api/src/modules/supplies/procurement.controller.ts#L31) |
| GET | `/procurement/options` | 'compras:view', 'compras:buy', 'compras:approve', 'compras:manage', 'estoque:view' | Sim | [controller](../apps/api/src/modules/supplies/procurement.controller.ts#L35) |
| GET | `/procurement/suppliers` | 'compras:view' | Sim | [controller](../apps/api/src/modules/supplies/procurement.controller.ts#L39) |
| POST | `/procurement/suppliers` | 'compras:manage' | Sim | [controller](../apps/api/src/modules/supplies/procurement.controller.ts#L43) |
| PATCH | `/procurement/suppliers/:id` | 'compras:manage' | Sim | [controller](../apps/api/src/modules/supplies/procurement.controller.ts#L47) |
| GET | `/procurement/approval-rules` | 'compras:view', 'compras:approve', 'compras:manage' | Sim | [controller](../apps/api/src/modules/supplies/procurement.controller.ts#L51) |
| POST | `/procurement/approval-rules` | 'compras:manage' | Sim | [controller](../apps/api/src/modules/supplies/procurement.controller.ts#L55) |
| PATCH | `/procurement/approval-rules/:id` | 'compras:manage' | Sim | [controller](../apps/api/src/modules/supplies/procurement.controller.ts#L59) |
| GET | `/procurement/requisitions` | 'compras:view', 'compras:request', 'compras:buy' | Sim | [controller](../apps/api/src/modules/supplies/procurement.controller.ts#L63) |
| POST | `/procurement/requisitions` | 'compras:request', 'compras:view' | Sim | [controller](../apps/api/src/modules/supplies/procurement.controller.ts#L67) |
| PATCH | `/procurement/requisitions/:id` | 'compras:request', 'compras:view' | Sim | [controller](../apps/api/src/modules/supplies/procurement.controller.ts#L71) |
| POST | `/procurement/requisitions/:id/submit` | 'compras:request', 'compras:view' | Sim | [controller](../apps/api/src/modules/supplies/procurement.controller.ts#L75) |
| POST | `/procurement/requisitions/:id/claim` | 'compras:buy', 'compras:manage' | Sim | [controller](../apps/api/src/modules/supplies/procurement.controller.ts#L79) |
| POST | `/procurement/requisitions/:id/reject` | 'compras:buy', 'compras:manage' | Sim | [controller](../apps/api/src/modules/supplies/procurement.controller.ts#L83) |
| POST | `/procurement/requisitions/:id/cancel` | 'compras:request', 'compras:view' | Sim | [controller](../apps/api/src/modules/supplies/procurement.controller.ts#L87) |
| GET | `/procurement/orders` | 'compras:view', 'compras:buy', 'compras:approve', 'compras:manage' | Sim | [controller](../apps/api/src/modules/supplies/procurement.controller.ts#L91) |
| POST | `/procurement/orders` | 'compras:buy', 'compras:manage' | Sim | [controller](../apps/api/src/modules/supplies/procurement.controller.ts#L95) |
| POST | `/procurement/orders/:id/submit` | 'compras:buy', 'compras:manage' | Sim | [controller](../apps/api/src/modules/supplies/procurement.controller.ts#L99) |
| POST | `/procurement/orders/:id/approve` | 'compras:approve', 'compras:manage' | Sim | [controller](../apps/api/src/modules/supplies/procurement.controller.ts#L103) |
| POST | `/procurement/orders/:id/reject` | 'compras:approve', 'compras:manage' | Sim | [controller](../apps/api/src/modules/supplies/procurement.controller.ts#L107) |
| POST | `/procurement/orders/:id/send` | 'compras:buy', 'compras:manage' | Sim | [controller](../apps/api/src/modules/supplies/procurement.controller.ts#L111) |
| POST | `/procurement/orders/:id/cancel` | 'compras:buy', 'compras:manage' | Sim | [controller](../apps/api/src/modules/supplies/procurement.controller.ts#L115) |
| POST | `/procurement/orders/:id/close` | 'compras:buy', 'compras:manage' | Sim | [controller](../apps/api/src/modules/supplies/procurement.controller.ts#L119) |
| POST | `/procurement/orders/:id/receive` | 'estoque:operate', 'estoque:manage' | Sim | [controller](../apps/api/src/modules/supplies/procurement.controller.ts#L123) |
| GET | `/procurement/receipts` | 'compras:view', 'estoque:view' | Sim | [controller](../apps/api/src/modules/supplies/procurement.controller.ts#L127) |
| GET | `/procurement/quotations` | 'compras:view', 'compras:buy' | Sim | [controller](../apps/api/src/modules/supplies/procurement.controller.ts#L131) |
| POST | `/procurement/quotations` | 'compras:buy', 'compras:manage' | Sim | [controller](../apps/api/src/modules/supplies/procurement.controller.ts#L135) |
| POST | `/procurement/quotations/:id/quotes` | 'compras:buy', 'compras:manage' | Sim | [controller](../apps/api/src/modules/supplies/procurement.controller.ts#L139) |
| GET | `/procurement/quotations/:id/map` | 'compras:view', 'compras:buy' | Sim | [controller](../apps/api/src/modules/supplies/procurement.controller.ts#L143) |
| POST | `/procurement/quotations/:id/award` | 'compras:buy', 'compras:manage' | Sim | [controller](../apps/api/src/modules/supplies/procurement.controller.ts#L147) |
| GET | `/procurement/invoices` | 'compras:view', 'compras:buy', 'estoque:view' | Sim | [controller](../apps/api/src/modules/supplies/procurement.controller.ts#L151) |
| POST | `/procurement/invoices/material` | 'compras:buy', 'compras:manage', 'estoque:operate' | Sim | [controller](../apps/api/src/modules/supplies/procurement.controller.ts#L155) |
| POST | `/procurement/invoices/:id/verify` | 'compras:buy', 'compras:manage' | Sim | [controller](../apps/api/src/modules/supplies/procurement.controller.ts#L159) |
| POST | `/procurement/invoices/:id/return` | 'compras:buy', 'compras:manage' | Sim | [controller](../apps/api/src/modules/supplies/procurement.controller.ts#L163) |

### support-tickets

Fonte: [diretório](../apps/api/src/modules/support-tickets). 5 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| POST | `/support-tickets` | 'help:view' | Não | [controller](../apps/api/src/modules/support-tickets/support-tickets.controller.ts#L12) |
| GET | `/support-tickets` | 'help:view' | Não | [controller](../apps/api/src/modules/support-tickets/support-tickets.controller.ts#L17) |
| GET | `/support-tickets/:id` | 'help:view' | Não | [controller](../apps/api/src/modules/support-tickets/support-tickets.controller.ts#L29) |
| POST | `/support-tickets/:id/messages` | 'help:view' | Não | [controller](../apps/api/src/modules/support-tickets/support-tickets.controller.ts#L34) |
| PATCH | `/support-tickets/:id` | 'help:view' | Não | [controller](../apps/api/src/modules/support-tickets/support-tickets.controller.ts#L39) |

### tasks

Fonte: [diretório](../apps/api/src/modules/tasks). 15 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/tasks/board` | 'myday:view' | Não | [controller](../apps/api/src/modules/tasks/tasks.controller.ts#L12) |
| GET | `/tasks/context` | 'myday:view' | Não | [controller](../apps/api/src/modules/tasks/tasks.controller.ts#L17) |
| PATCH | `/tasks/board/wiki` | 'myday:act' | Não | [controller](../apps/api/src/modules/tasks/tasks.controller.ts#L22) |
| POST | `/tasks` | 'myday:act' | Não | [controller](../apps/api/src/modules/tasks/tasks.controller.ts#L28) |
| GET | `/tasks/:id` | 'myday:view' | Não | [controller](../apps/api/src/modules/tasks/tasks.controller.ts#L34) |
| PATCH | `/tasks/:id` | 'myday:act' | Não | [controller](../apps/api/src/modules/tasks/tasks.controller.ts#L39) |
| DELETE | `/tasks/:id` | 'myday:act' | Não | [controller](../apps/api/src/modules/tasks/tasks.controller.ts#L45) |
| POST | `/tasks/:id/move` | 'myday:act' | Não | [controller](../apps/api/src/modules/tasks/tasks.controller.ts#L51) |
| POST | `/tasks/:id/comments` | 'myday:act' | Não | [controller](../apps/api/src/modules/tasks/tasks.controller.ts#L57) |
| POST | `/tasks/:id/checklist` | 'myday:act' | Não | [controller](../apps/api/src/modules/tasks/tasks.controller.ts#L63) |
| PATCH | `/tasks/:id/checklist/:itemId` | 'myday:act' | Não | [controller](../apps/api/src/modules/tasks/tasks.controller.ts#L69) |
| DELETE | `/tasks/:id/checklist/:itemId` | 'myday:act' | Não | [controller](../apps/api/src/modules/tasks/tasks.controller.ts#L80) |
| POST | `/tasks/:id/attachments` | 'myday:act' | Não | [controller](../apps/api/src/modules/tasks/tasks.controller.ts#L86) |
| POST | `/tasks/:id/links` | 'myday:act' | Não | [controller](../apps/api/src/modules/tasks/tasks.controller.ts#L92) |
| DELETE | `/tasks/:id/links/:linkId` | 'myday:act' | Não | [controller](../apps/api/src/modules/tasks/tasks.controller.ts#L98) |

### traceability

Fonte: [diretório](../apps/api/src/modules/traceability). 2 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/traceability` | 'indicators:history' | Não | [controller](../apps/api/src/modules/traceability/traceability.controller.ts#L13) |
| GET | `/traceability/indicators/:id` | 'indicators:history' | Não | [controller](../apps/api/src/modules/traceability/traceability.controller.ts#L29) |

### training

Fonte: [diretório](../apps/api/src/modules/training). 58 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/training/overview` | 'training:view' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L25) |
| GET | `/training/assignments` | 'training:view' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L32) |
| GET | `/training/assignments/:id` | 'training:view' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L38) |
| GET | `/training/employees/:employeeId/history` | 'training:view' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L44) |
| GET | `/training/trainings/:trainingId/authorized` | 'training:view' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L51) |
| POST | `/training/employees/:employeeId/recompute` | 'training:manage' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L58) |
| GET | `/training/catalog/categories` | 'training:view' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L70) |
| POST | `/training/catalog/categories` | 'training:manage' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L76) |
| GET | `/training/catalog/instructors` | 'training:view' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L82) |
| POST | `/training/catalog/instructors` | 'training:manage' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L88) |
| GET | `/training/catalog/trainings` | 'training:view' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L94) |
| GET | `/training/catalog/trainings/:id` | 'training:view' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L100) |
| POST | `/training/catalog/trainings` | 'training:create' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L106) |
| PATCH | `/training/catalog/trainings/:id` | 'training:update' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L112) |
| DELETE | `/training/catalog/trainings/:id` | 'training:manage' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L118) |
| GET | `/training/catalog/requirements` | 'training:view' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L126) |
| POST | `/training/catalog/requirements` | 'training:requirements' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L132) |
| PATCH | `/training/catalog/requirements/:id` | 'training:requirements' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L138) |
| DELETE | `/training/catalog/requirements/:id` | 'training:requirements' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L144) |
| GET | `/training/classes` | 'training:view' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L156) |
| GET | `/training/classes/:id` | 'training:view' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L162) |
| POST | `/training/classes` | 'training:class:manage' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L168) |
| PATCH | `/training/classes/:id` | 'training:class:manage' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L174) |
| POST | `/training/classes/:id/participants/pending` | 'training:class:manage' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L181) |
| POST | `/training/classes/:id/participants` | 'training:class:manage' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L187) |
| DELETE | `/training/classes/:id/participants/:participantId` | 'training:class:manage' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L193) |
| POST | `/training/classes/:id/attendance` | 'training:attendance' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L199) |
| POST | `/training/classes/:id/close` | 'training:result' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L205) |
| POST | `/training/classes/:id/cancel` | 'training:class:manage' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L211) |
| GET | `/training/certificates` | 'training:view' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L223) |
| POST | `/training/certificates` | 'training:certificate' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L229) |
| POST | `/training/certificates/:id/validate` | 'training:certificate:validate' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L235) |
| GET | `/training/me` | 'training:self' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L248) |
| POST | `/training/me/classes/:participantId/confirm` | 'training:self' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L254) |
| POST | `/training/me/classes/:participantId/justify` | 'training:self' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L260) |
| GET | `/training/documents/:documentId` | 'training:view', 'doc:view' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L275) |
| GET | `/training/documents/:documentId/outdated` | 'training:view' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L282) |
| POST | `/training/documents/:documentId/revision` | 'training:requirements', 'training:manage' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L289) |
| PATCH | `/training/documents/trainings/:trainingId/revision-action` | 'training:update', 'training:manage' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L296) |
| GET | `/training/development/effectiveness/pending` | 'training:view' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L308) |
| POST | `/training/development/effectiveness/:id` | 'training:effectiveness', 'training:manage' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L314) |
| GET | `/training/development/plans` | 'training:view' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L320) |
| GET | `/training/development/plans/:id` | 'training:view' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L326) |
| POST | `/training/development/plans` | 'training:create', 'training:manage' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L332) |
| PATCH | `/training/development/plans/:id` | 'training:update', 'training:manage' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L338) |
| POST | `/training/development/plans/:id/actions` | 'training:update', 'training:manage' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L344) |
| PATCH | `/training/development/actions/:actionId` | 'training:update', 'training:manage' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L350) |
| GET | `/training/reports` | 'training:view' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L362) |
| GET | `/training/reports/:kind` | 'training:view' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L368) |
| GET | `/training/reports/:kind/export.csv` | 'training:export', 'training:manage' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L374) |
| GET | `/training/assessments/trainings/:trainingId` | 'training:view' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L389) |
| POST | `/training/assessments/trainings/:trainingId` | 'training:assessment', 'training:manage' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L395) |
| POST | `/training/assessments/:assessmentId/questions` | 'training:assessment', 'training:manage' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L401) |
| DELETE | `/training/assessments/questions/:questionId` | 'training:assessment', 'training:manage' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L407) |
| GET | `/training/assessments/grading/pending` | 'training:assessment', 'training:manage' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L414) |
| POST | `/training/assessments/attempts/:attemptId/grade` | 'training:assessment', 'training:manage' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L420) |
| POST | `/training/assessments/start/:assignmentId` | 'training:self' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L428) |
| POST | `/training/assessments/attempts/:attemptId/submit` | 'training:self' | Sim | [controller](../apps/api/src/modules/training/training.controller.ts#L434) |

### treatments

Fonte: [diretório](../apps/api/src/modules/treatments). 8 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/treatments/:id` | 'treatments:view' | Não | [controller](../apps/api/src/modules/treatments/treatments.controller.ts#L19) |
| GET | `/treatments/indicators/:indicatorId/current` | 'treatments:view' | Não | [controller](../apps/api/src/modules/treatments/treatments.controller.ts#L25) |
| POST | `/treatments/from-result/:resultId/start` | 'treatments:manage' | Não | [controller](../apps/api/src/modules/treatments/treatments.controller.ts#L35) |
| POST | `/treatments/:id/ignore` | 'treatments:ignore' | Não | [controller](../apps/api/src/modules/treatments/treatments.controller.ts#L41) |
| POST | `/treatments/:id/analysis` | 'treatments:manage' | Não | [controller](../apps/api/src/modules/treatments/treatments.controller.ts#L47) |
| POST | `/treatments/:id/meeting` | 'treatments:manage' | Não | [controller](../apps/api/src/modules/treatments/treatments.controller.ts#L66) |
| POST | `/treatments/:id/actions` | 'treatments:manage' | Não | [controller](../apps/api/src/modules/treatments/treatments.controller.ts#L94) |
| POST | `/treatments/:id/reevaluate` | 'treatments:manage' | Não | [controller](../apps/api/src/modules/treatments/treatments.controller.ts#L117) |

### users

Fonte: [diretório](../apps/api/src/modules/users). 9 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/users` | 'users:view', 'users:profiles', 'users:manage' | Não | [controller](../apps/api/src/modules/users/users.controller.ts#L15) |
| GET | `/users/permissions` | 'users:permissions', 'users:profiles', 'users:manage' | Não | [controller](../apps/api/src/modules/users/users.controller.ts#L22) |
| GET | `/users/access-context` | 'users:view', 'users:create', 'users:update', 'users:permissions', 'users:profiles', 'users:manage' | Não | [controller](../apps/api/src/modules/users/users.controller.ts#L29) |
| GET | `/users/:id` | 'users:view', 'users:update', 'users:profiles', 'users:manage' | Não | [controller](../apps/api/src/modules/users/users.controller.ts#L36) |
| POST | `/users` | 'users:create', 'users:manage' | Não | [controller](../apps/api/src/modules/users/users.controller.ts#L43) |
| PATCH | `/users/:id` | 'users:update', 'users:manage' | Não | [controller](../apps/api/src/modules/users/users.controller.ts#L59) |
| PATCH | `/users/:id/permissions` | 'users:permissions', 'users:manage' | Não | [controller](../apps/api/src/modules/users/users.controller.ts#L66) |
| PATCH | `/users/:id/active` | 'users:update', 'users:manage' | Não | [controller](../apps/api/src/modules/users/users.controller.ts#L73) |
| DELETE | `/users/:id` | 'users:delete', 'users:manage' | Não | [controller](../apps/api/src/modules/users/users.controller.ts#L80) |

### vision360

Fonte: [diretório](../apps/api/src/modules/vision360). 9 operações encontradas.

| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |
|---|---|---|---|---|
| GET | `/vision360/links` | 'vision360:view' | Não | [controller](../apps/api/src/modules/vision360/vision360.controller.ts#L12) |
| POST | `/vision360/links` | 'vision360:manage' | Não | [controller](../apps/api/src/modules/vision360/vision360.controller.ts#L37) |
| DELETE | `/vision360/links/:id` | 'vision360:manage' | Não | [controller](../apps/api/src/modules/vision360/vision360.controller.ts#L55) |
| GET | `/vision360/impact-simulation` | 'vision360:impact' | Não | [controller](../apps/api/src/modules/vision360/vision360.controller.ts#L64) |
| POST | `/vision360/impact-analysis` | 'vision360:impact' | Não | [controller](../apps/api/src/modules/vision360/vision360.controller.ts#L76) |
| GET | `/vision360/pending-impacts` | 'vision360:impact' | Não | [controller](../apps/api/src/modules/vision360/vision360.controller.ts#L85) |
| GET | `/vision360/export-xlsx` | 'vision360:view' | Não | [controller](../apps/api/src/modules/vision360/vision360.controller.ts#L91) |
| GET | `/vision360/search` | 'vision360:view' | Não | [controller](../apps/api/src/modules/vision360/vision360.controller.ts#L105) |
| PATCH | `/vision360/impact-items/:id/resolve` | 'vision360:impact' | Não | [controller](../apps/api/src/modules/vision360/vision360.controller.ts#L115) |

## Páginas do frontend

| Rota | Suspensa por caminho | Arquivo |
|---|---|---|
| `/` | Não | [page](../apps/web/app/page.tsx) |
| `/actions` | Não | [page](../apps/web/app/(app)/actions/page.tsx) |
| `/actions/[id]` | Não | [page](../apps/web/app/(app)/actions/[id]/page.tsx) |
| `/ajuda` | Não | [page](../apps/web/app/(app)/ajuda/page.tsx) |
| `/aprovacoes-cargo` | Sim | [page](../apps/web/app/(app)/aprovacoes-cargo/page.tsx) |
| `/audit` | Não | [page](../apps/web/app/(app)/audit/page.tsx) |
| `/audits` | Sim | [page](../apps/web/app/(app)/audits/page.tsx) |
| `/candidato` | Sim | [page](../apps/web/app/candidato/page.tsx) |
| `/cargos-salarios` | Sim | [page](../apps/web/app/(app)/cargos-salarios/page.tsx) |
| `/cargos-salarios/aprovacoes` | Sim | [page](../apps/web/app/(app)/cargos-salarios/aprovacoes/page.tsx) |
| `/cargos-salarios/catalogo` | Sim | [page](../apps/web/app/(app)/cargos-salarios/catalogo/page.tsx) |
| `/cargos-salarios/ciclos` | Sim | [page](../apps/web/app/(app)/cargos-salarios/ciclos/page.tsx) |
| `/cargos-salarios/configuracoes` | Sim | [page](../apps/web/app/(app)/cargos-salarios/configuracoes/page.tsx) |
| `/cargos-salarios/descricoes` | Sim | [page](../apps/web/app/(app)/cargos-salarios/descricoes/page.tsx) |
| `/cargos-salarios/enquadramento` | Sim | [page](../apps/web/app/(app)/cargos-salarios/enquadramento/page.tsx) |
| `/cargos-salarios/equidade` | Sim | [page](../apps/web/app/(app)/cargos-salarios/equidade/page.tsx) |
| `/cargos-salarios/estrutura-quadro` | Sim | [page](../apps/web/app/(app)/cargos-salarios/estrutura-quadro/page.tsx) |
| `/cargos-salarios/hierarquia` | Sim | [page](../apps/web/app/(app)/cargos-salarios/hierarquia/page.tsx) |
| `/cargos-salarios/movimentacoes` | Sim | [page](../apps/web/app/(app)/cargos-salarios/movimentacoes/page.tsx) |
| `/cargos-salarios/orcamento` | Sim | [page](../apps/web/app/(app)/cargos-salarios/orcamento/page.tsx) |
| `/cargos-salarios/pesquisas` | Sim | [page](../apps/web/app/(app)/cargos-salarios/pesquisas/page.tsx) |
| `/cargos-salarios/relatorios` | Sim | [page](../apps/web/app/(app)/cargos-salarios/relatorios/page.tsx) |
| `/cargos-salarios/simulacoes` | Sim | [page](../apps/web/app/(app)/cargos-salarios/simulacoes/page.tsx) |
| `/cargos-salarios/tabelas-salariais` | Sim | [page](../apps/web/app/(app)/cargos-salarios/tabelas-salariais/page.tsx) |
| `/carreiras` | Sim | [page](../apps/web/app/carreiras/page.tsx) |
| `/carreiras/[empresa]` | Sim | [page](../apps/web/app/carreiras/[empresa]/page.tsx) |
| `/carreiras/vagas/[slug]` | Sim | [page](../apps/web/app/carreiras/vagas/[slug]/page.tsx) |
| `/central-atendimento` | Não | [page](../apps/web/app/(app)/central-atendimento/page.tsx) |
| `/central-atendimento/detalhes/[id]` | Não | [page](../apps/web/app/(app)/central-atendimento/detalhes/[id]/page.tsx) |
| `/central-automacoes` | Sim | [page](../apps/web/app/(app)/central-automacoes/page.tsx) |
| `/central-automacoes/aprovacoes` | Sim | [page](../apps/web/app/(app)/central-automacoes/aprovacoes/page.tsx) |
| `/central-automacoes/biblioteca` | Sim | [page](../apps/web/app/(app)/central-automacoes/biblioteca/page.tsx) |
| `/central-automacoes/configuracoes` | Sim | [page](../apps/web/app/(app)/central-automacoes/configuracoes/page.tsx) |
| `/central-automacoes/escalonamentos` | Sim | [page](../apps/web/app/(app)/central-automacoes/escalonamentos/page.tsx) |
| `/central-automacoes/execucoes` | Sim | [page](../apps/web/app/(app)/central-automacoes/execucoes/page.tsx) |
| `/central-automacoes/falhas` | Sim | [page](../apps/web/app/(app)/central-automacoes/falhas/page.tsx) |
| `/central-automacoes/fluxos` | Sim | [page](../apps/web/app/(app)/central-automacoes/fluxos/page.tsx) |
| `/central-automacoes/fluxos/construtor` | Sim | [page](../apps/web/app/(app)/central-automacoes/fluxos/construtor/page.tsx) |
| `/central-automacoes/historico` | Sim | [page](../apps/web/app/(app)/central-automacoes/historico/page.tsx) |
| `/central-automacoes/integracoes` | Sim | [page](../apps/web/app/(app)/central-automacoes/integracoes/page.tsx) |
| `/central-automacoes/modelos` | Sim | [page](../apps/web/app/(app)/central-automacoes/modelos/page.tsx) |
| `/central-automacoes/permissoes` | Sim | [page](../apps/web/app/(app)/central-automacoes/permissoes/page.tsx) |
| `/central-automacoes/tarefas` | Sim | [page](../apps/web/app/(app)/central-automacoes/tarefas/page.tsx) |
| `/central-impactos` | Sim | [page](../apps/web/app/(app)/central-impactos/page.tsx) |
| `/comunicacao` | Sim | [page](../apps/web/app/(app)/comunicacao/page.tsx) |
| `/comunicacao/chat` | Sim | [page](../apps/web/app/(app)/comunicacao/chat/page.tsx) |
| `/comunicacao/configuracoes` | Sim | [page](../apps/web/app/(app)/comunicacao/configuracoes/page.tsx) |
| `/comunicacao/midias` | Sim | [page](../apps/web/app/(app)/comunicacao/midias/page.tsx) |
| `/comunicacao/publicacoes` | Sim | [page](../apps/web/app/(app)/comunicacao/publicacoes/page.tsx) |
| `/comunicacao/publicacoes/[id]` | Sim | [page](../apps/web/app/(app)/comunicacao/publicacoes/[id]/page.tsx) |
| `/comunicacao/publicacoes/[id]/editar` | Sim | [page](../apps/web/app/(app)/comunicacao/publicacoes/[id]/editar/page.tsx) |
| `/comunicacao/publicacoes/nova` | Sim | [page](../apps/web/app/(app)/comunicacao/publicacoes/nova/page.tsx) |
| `/contato` | Não | [page](../apps/web/app/contato/page.tsx) |
| `/conteudos` | Não | [page](../apps/web/app/conteudos/page.tsx) |
| `/conteudos/artigos` | Não | [page](../apps/web/app/conteudos/artigos/page.tsx) |
| `/conteudos/artigos/[slug]` | Não | [page](../apps/web/app/conteudos/artigos/[slug]/page.tsx) |
| `/conteudos/guias` | Não | [page](../apps/web/app/conteudos/guias/page.tsx) |
| `/conteudos/perguntas-frequentes` | Não | [page](../apps/web/app/conteudos/perguntas-frequentes/page.tsx) |
| `/dashboard` | Não | [page](../apps/web/app/(app)/dashboard/page.tsx) |
| `/demonstracao` | Não | [page](../apps/web/app/demonstracao/page.tsx) |
| `/deviations` | Não | [page](../apps/web/app/(app)/deviations/page.tsx) |
| `/deviations/[id]` | Não | [page](../apps/web/app/(app)/deviations/[id]/page.tsx) |
| `/documents` | Sim | [page](../apps/web/app/(app)/documents/page.tsx) |
| `/eficacia` | Não | [page](../apps/web/app/(app)/eficacia/page.tsx) |
| `/forms` | Sim | [page](../apps/web/app/(app)/forms/page.tsx) |
| `/gestao-premio` | Sim | [page](../apps/web/app/(app)/gestao-premio/page.tsx) |
| `/gestao-premio/ajustes` | Sim | [page](../apps/web/app/(app)/gestao-premio/ajustes/page.tsx) |
| `/gestao-premio/anexos` | Sim | [page](../apps/web/app/(app)/gestao-premio/anexos/page.tsx) |
| `/gestao-premio/apuracao` | Sim | [page](../apps/web/app/(app)/gestao-premio/apuracao/page.tsx) |
| `/gestao-premio/auditoria` | Sim | [page](../apps/web/app/(app)/gestao-premio/auditoria/page.tsx) |
| `/gestao-premio/colaboradores` | Sim | [page](../apps/web/app/(app)/gestao-premio/colaboradores/page.tsx) |
| `/gestao-premio/competencias` | Sim | [page](../apps/web/app/(app)/gestao-premio/competencias/page.tsx) |
| `/gestao-premio/espelhos` | Sim | [page](../apps/web/app/(app)/gestao-premio/espelhos/page.tsx) |
| `/gestao-premio/folha` | Sim | [page](../apps/web/app/(app)/gestao-premio/folha/page.tsx) |
| `/gestao-premio/indicadores` | Sim | [page](../apps/web/app/(app)/gestao-premio/indicadores/page.tsx) |
| `/gestao-premio/integracoes` | Sim | [page](../apps/web/app/(app)/gestao-premio/integracoes/page.tsx) |
| `/gestao-premio/moderadores` | Sim | [page](../apps/web/app/(app)/gestao-premio/moderadores/page.tsx) |
| `/gestao-premio/previsto-realizado` | Sim | [page](../apps/web/app/(app)/gestao-premio/previsto-realizado/page.tsx) |
| `/gestao-premio/programas` | Sim | [page](../apps/web/app/(app)/gestao-premio/programas/page.tsx) |
| `/gestao-premio/realizado` | Sim | [page](../apps/web/app/(app)/gestao-premio/realizado/page.tsx) |
| `/gestao-premio/relatorios` | Sim | [page](../apps/web/app/(app)/gestao-premio/relatorios/page.tsx) |
| `/implantacao` | Não | [page](../apps/web/app/implantacao/page.tsx) |
| `/imports` | Não | [page](../apps/web/app/(app)/imports/page.tsx) |
| `/indicators` | Não | [page](../apps/web/app/(app)/indicators/page.tsx) |
| `/indicators/[id]` | Não | [page](../apps/web/app/(app)/indicators/[id]/page.tsx) |
| `/indicators/new` | Não | [page](../apps/web/app/(app)/indicators/new/page.tsx) |
| `/insights` | Não | [page](../apps/web/app/(app)/insights/page.tsx) |
| `/integracoes` | Não | [page](../apps/web/app/(app)/integracoes/page.tsx) |
| `/lgpd` | Não | [page](../apps/web/app/lgpd/page.tsx) |
| `/login` | Não | [page](../apps/web/app/login/page.tsx) |
| `/meetings` | Não | [page](../apps/web/app/(app)/meetings/page.tsx) |
| `/meetings/[id]` | Não | [page](../apps/web/app/(app)/meetings/[id]/page.tsx) |
| `/meu-dia` | Não | [page](../apps/web/app/(app)/meu-dia/page.tsx) |
| `/meu-dia/equipe` | Não | [page](../apps/web/app/(app)/meu-dia/equipe/page.tsx) |
| `/modulos` | Não | [page](../apps/web/app/modulos/page.tsx) |
| `/monthly-results` | Não | [page](../apps/web/app/(app)/monthly-results/page.tsx) |
| `/monthly-results/[id]` | Não | [page](../apps/web/app/(app)/monthly-results/[id]/page.tsx) |
| `/nonconformities` | Sim | [page](../apps/web/app/(app)/nonconformities/page.tsx) |
| `/okrs` | Não | [page](../apps/web/app/(app)/okrs/page.tsx) |
| `/org` | Não | [page](../apps/web/app/(app)/org/page.tsx) |
| `/organograma` | Sim | [page](../apps/web/app/(app)/organograma/page.tsx) |
| `/perfil` | Não | [page](../apps/web/app/(app)/perfil/page.tsx) |
| `/perfil/[id]` | Não | [page](../apps/web/app/(app)/perfil/[id]/page.tsx) |
| `/periods` | Não | [page](../apps/web/app/(app)/periods/page.tsx) |
| `/pessoas` | Sim | [page](../apps/web/app/(app)/pessoas/page.tsx) |
| `/plataforma` | Não | [page](../apps/web/app/(app)/plataforma/page.tsx) |
| `/platform-admin` | Não | [page](../apps/web/app/platform-admin/page.tsx) |
| `/platform-admin/login` | Não | [page](../apps/web/app/platform-admin/login/page.tsx) |
| `/politica-de-privacidade` | Não | [page](../apps/web/app/politica-de-privacidade/page.tsx) |
| `/ponto-totem` | Sim | [page](../apps/web/app/ponto-totem/page.tsx) |
| `/portal-seguranca/[token]` | Sim | [page](../apps/web/app/portal-seguranca/[token]/page.tsx) |
| `/privacidade` | Não | [page](../apps/web/app/(app)/privacidade/page.tsx) |
| `/processes` | Não | [page](../apps/web/app/(app)/processes/page.tsx) |
| `/processes/[id]` | Não | [page](../apps/web/app/(app)/processes/[id]/page.tsx) |
| `/projects` | Não | [page](../apps/web/app/(app)/projects/page.tsx) |
| `/projects/[id]` | Não | [page](../apps/web/app/(app)/projects/[id]/page.tsx) |
| `/projects/cronograma` | Não | [page](../apps/web/app/(app)/projects/cronograma/page.tsx) |
| `/recrutamento` | Sim | [page](../apps/web/app/(app)/recrutamento/page.tsx) |
| `/recrutamento/analises` | Sim | [page](../apps/web/app/(app)/recrutamento/analises/page.tsx) |
| `/recrutamento/carreiras` | Sim | [page](../apps/web/app/(app)/recrutamento/carreiras/page.tsx) |
| `/recrutamento/comunicacao` | Sim | [page](../apps/web/app/(app)/recrutamento/comunicacao/page.tsx) |
| `/recrutamento/lgpd` | Sim | [page](../apps/web/app/(app)/recrutamento/lgpd/page.tsx) |
| `/recrutamento/talentos` | Sim | [page](../apps/web/app/(app)/recrutamento/talentos/page.tsx) |
| `/recrutamento/vagas` | Sim | [page](../apps/web/app/(app)/recrutamento/vagas/page.tsx) |
| `/recrutamento/vagas/[id]` | Sim | [page](../apps/web/app/(app)/recrutamento/vagas/[id]/page.tsx) |
| `/recursos` | Não | [page](../apps/web/app/recursos/page.tsx) |
| `/reports` | Não | [page](../apps/web/app/(app)/reports/page.tsx) |
| `/risks` | Sim | [page](../apps/web/app/(app)/risks/page.tsx) |
| `/scan` | Sim | [page](../apps/web/app/(app)/scan/page.tsx) |
| `/segmentos` | Não | [page](../apps/web/app/segmentos/page.tsx) |
| `/segmentos/[slug]` | Não | [page](../apps/web/app/segmentos/[slug]/page.tsx) |
| `/seguranca` | Não | [page](../apps/web/app/seguranca/page.tsx) |
| `/seguranca-alimentos` | Sim | [page](../apps/web/app/(app)/seguranca-alimentos/page.tsx) |
| `/seguranca-patrimonial` | Sim | [page](../apps/web/app/(app)/seguranca-patrimonial/page.tsx) |
| `/selecionar-empresa` | Não | [page](../apps/web/app/(app)/selecionar-empresa/page.tsx) |
| `/servico-pessoal` | Sim | [page](../apps/web/app/(app)/servico-pessoal/page.tsx) |
| `/servico-pessoal/admissoes` | Sim | [page](../apps/web/app/(app)/servico-pessoal/admissoes/page.tsx) |
| `/servico-pessoal/biometrias` | Sim | [page](../apps/web/app/(app)/servico-pessoal/biometrias/page.tsx) |
| `/servico-pessoal/colaboradores` | Sim | [page](../apps/web/app/(app)/servico-pessoal/colaboradores/page.tsx) |
| `/servico-pessoal/comunicacao-interna` | Sim | [page](../apps/web/app/(app)/servico-pessoal/comunicacao-interna/page.tsx) |
| `/servico-pessoal/configuracoes` | Sim | [page](../apps/web/app/(app)/servico-pessoal/configuracoes/page.tsx) |
| `/servico-pessoal/ferias` | Sim | [page](../apps/web/app/(app)/servico-pessoal/ferias/page.tsx) |
| `/servico-pessoal/folha` | Sim | [page](../apps/web/app/(app)/servico-pessoal/folha/page.tsx) |
| `/servico-pessoal/folha/banco` | Sim | [page](../apps/web/app/(app)/servico-pessoal/folha/banco/page.tsx) |
| `/servico-pessoal/folha/beneficios` | Sim | [page](../apps/web/app/(app)/servico-pessoal/folha/beneficios/page.tsx) |
| `/servico-pessoal/folha/decimo-terceiro` | Sim | [page](../apps/web/app/(app)/servico-pessoal/folha/decimo-terceiro/page.tsx) |
| `/servico-pessoal/folha/esocial` | Sim | [page](../apps/web/app/(app)/servico-pessoal/folha/esocial/page.tsx) |
| `/servico-pessoal/folha/ferias` | Sim | [page](../apps/web/app/(app)/servico-pessoal/folha/ferias/page.tsx) |
| `/servico-pessoal/folha/gestao-a-vista` | Sim | [page](../apps/web/app/(app)/servico-pessoal/folha/gestao-a-vista/page.tsx) |
| `/servico-pessoal/folha/obrigacoes` | Sim | [page](../apps/web/app/(app)/servico-pessoal/folha/obrigacoes/page.tsx) |
| `/servico-pessoal/folha/parametros` | Sim | [page](../apps/web/app/(app)/servico-pessoal/folha/parametros/page.tsx) |
| `/servico-pessoal/folha/rescisao` | Sim | [page](../apps/web/app/(app)/servico-pessoal/folha/rescisao/page.tsx) |
| `/servico-pessoal/folha/runs/[id]` | Sim | [page](../apps/web/app/(app)/servico-pessoal/folha/runs/[id]/page.tsx) |
| `/servico-pessoal/folha/workers/[id]` | Sim | [page](../apps/web/app/(app)/servico-pessoal/folha/workers/[id]/page.tsx) |
| `/servico-pessoal/meu-holerite` | Sim | [page](../apps/web/app/(app)/servico-pessoal/meu-holerite/page.tsx) |
| `/servico-pessoal/ponto` | Sim | [page](../apps/web/app/(app)/servico-pessoal/ponto/page.tsx) |
| `/servico-pessoal/ponto-facial` | Sim | [page](../apps/web/app/(app)/servico-pessoal/ponto-facial/page.tsx) |
| `/servico-pessoal/relatorios` | Sim | [page](../apps/web/app/(app)/servico-pessoal/relatorios/page.tsx) |
| `/settings` | Não | [page](../apps/web/app/(app)/settings/page.tsx) |
| `/settings/dados` | Não | [page](../apps/web/app/(app)/settings/dados/page.tsx) |
| `/settings/database` | Não | [page](../apps/web/app/(app)/settings/database/page.tsx) |
| `/settings/database/advanced` | Não | [page](../apps/web/app/(app)/settings/database/advanced/page.tsx) |
| `/settings/database/audit` | Não | [page](../apps/web/app/(app)/settings/database/audit/page.tsx) |
| `/settings/database/backups` | Não | [page](../apps/web/app/(app)/settings/database/backups/page.tsx) |
| `/settings/database/diagnostics` | Não | [page](../apps/web/app/(app)/settings/database/diagnostics/page.tsx) |
| `/settings/database/import-export` | Não | [page](../apps/web/app/(app)/settings/database/import-export/page.tsx) |
| `/settings/database/indexes` | Não | [page](../apps/web/app/(app)/settings/database/indexes/page.tsx) |
| `/settings/database/query-builder` | Não | [page](../apps/web/app/(app)/settings/database/query-builder/page.tsx) |
| `/settings/database/records` | Não | [page](../apps/web/app/(app)/settings/database/records/page.tsx) |
| `/settings/database/sql` | Não | [page](../apps/web/app/(app)/settings/database/sql/page.tsx) |
| `/settings/database/structure` | Não | [page](../apps/web/app/(app)/settings/database/structure/page.tsx) |
| `/settings/database/tables` | Não | [page](../apps/web/app/(app)/settings/database/tables/page.tsx) |
| `/settings/database/tables/[table]` | Não | [page](../apps/web/app/(app)/settings/database/tables/[table]/page.tsx) |
| `/settings/identidade-visual` | Não | [page](../apps/web/app/(app)/settings/identidade-visual/page.tsx) |
| `/settings/integracoes` | Não | [page](../apps/web/app/(app)/settings/integracoes/page.tsx) |
| `/settings/portal` | Não | [page](../apps/web/app/(app)/settings/portal/page.tsx) |
| `/settings/visibilidade` | Não | [page](../apps/web/app/(app)/settings/visibilidade/page.tsx) |
| `/sobre` | Não | [page](../apps/web/app/sobre/page.tsx) |
| `/solucoes` | Não | [page](../apps/web/app/solucoes/page.tsx) |
| `/solucoes/[slug]` | Não | [page](../apps/web/app/solucoes/[slug]/page.tsx) |
| `/strategy` | Não | [page](../apps/web/app/(app)/strategy/page.tsx) |
| `/strategy/[id]` | Não | [page](../apps/web/app/(app)/strategy/[id]/page.tsx) |
| `/suporte` | Não | [page](../apps/web/app/suporte/page.tsx) |
| `/suprimentos` | Sim | [page](../apps/web/app/(app)/suprimentos/page.tsx) |
| `/tarefas` | Não | [page](../apps/web/app/(app)/tarefas/page.tsx) |
| `/termos-de-uso` | Não | [page](../apps/web/app/termos-de-uso/page.tsx) |
| `/teste-gratis` | Não | [page](../apps/web/app/teste-gratis/page.tsx) |
| `/totem` | Sim | [page](../apps/web/app/totem/page.tsx) |
| `/treatments` | Não | [page](../apps/web/app/(app)/treatments/page.tsx) |
| `/treatments/[id]` | Não | [page](../apps/web/app/(app)/treatments/[id]/page.tsx) |
| `/treinamento` | Sim | [page](../apps/web/app/(app)/treinamento/page.tsx) |
| `/treinamento/desenvolvimento` | Sim | [page](../apps/web/app/(app)/treinamento/desenvolvimento/page.tsx) |
| `/treinamento/matriz` | Sim | [page](../apps/web/app/(app)/treinamento/matriz/page.tsx) |
| `/treinamento/matriz/[employeeId]` | Sim | [page](../apps/web/app/(app)/treinamento/matriz/[employeeId]/page.tsx) |
| `/treinamento/pendencias` | Sim | [page](../apps/web/app/(app)/treinamento/pendencias/page.tsx) |
| `/treinamento/relatorios` | Sim | [page](../apps/web/app/(app)/treinamento/relatorios/page.tsx) |
| `/treinamento/treinamentos` | Sim | [page](../apps/web/app/(app)/treinamento/treinamentos/page.tsx) |
| `/treinamento/turmas` | Sim | [page](../apps/web/app/(app)/treinamento/turmas/page.tsx) |
| `/users` | Não | [page](../apps/web/app/(app)/users/page.tsx) |
| `/vagas-internas` | Sim | [page](../apps/web/app/(app)/vagas-internas/page.tsx) |
| `/visualization` | Não | [page](../apps/web/app/(app)/visualization/page.tsx) |

## Entidades persistidas

Os nomes abaixo estão no schema. Campos, FKs, índices e enums são a fonte de verdade em [schema.prisma](../apps/api/prisma/schema.prisma).

`Company`, `WorkPeriod`, `Branch`, `OrgNode`, `OrganizationalUnitActivity`, `OrganizationalUnitActivityItem`, `User`, `Permission`, `UserPermission`, `AccessProfile`, `ProfilePermission`, `RefreshToken`, `StrategicMap`, `Perspective`, `StrategicObjective`, `ObjectiveRelation`, `StrategicObjectiveIndicator`, `StrategicObjectiveOrgNode`, `StrategicMapVersion`, `OKRCycle`, `OKRObjective`, `KeyResult`, `OKRCheckin`, `Indicator`, `IndicatorSharedArea`, `IndicatorTarget`, `IndicatorResult`, `IndicatorTreeRelation`, `ClosedMonth`, `Deviation`, `DeviationCause`, `DeviationAnalysis`, `ActionPlan`, `ActionTask`, `GeneralApprovalRequest`, `ActionParticipant`, `ActionEvidence`, `ActionComment`, `ActionHistory`, `ActionAnalysisSession`, `ActionFiveWhy`, `ActionIshikawaCause`, `ActionMaspStep`, `ActionPdcaStep`, `ActionFiveW2H`, `ActionAiSuggestion`, `Project`, `ProjectProgressSnapshot`, `ProjectMilestone`, `ProjectTask`, `RiskRegister`, `NonConformity`, `Document`, `DocumentTypeConfig`, `DocumentCodeRule`, `DocumentTemplate`, `DocumentVersion`, `DocumentFile`, `DocumentStatusHistory`, `DocumentWorkflow`, `DocumentWorkflowStep`, `DocumentApproval`, `DocumentReviewRequest`, `DocumentEditRequest`, `DocumentComment`, `DocumentCommentMention`, `DocumentRelation`, `DocumentPermission`, `DocumentAccessGroup`, `DocumentAccessGroupUser`, `DocumentDistribution`, `DocumentReadConfirmation`, `DocumentDownloadLog`, `DocumentViewLog`, `DocumentShareLink`, `DocumentNotification`, `DocumentAuditLog`, `DocumentExternalMetadata`, `DocumentRetentionRule`, `DocumentEditorSession`, `DocumentAutosaveCheckpoint`, `DocumentTag`, `DocumentTagRelation`, `Audit`, `AuditFinding`, `AuditProgram`, `AuditProgramRevision`, `AuditTypeConfig`, `AuditUniverseItem`, `AuditRiskCriterion`, `AuditRiskScore`, `AuditorProfile`, `AuditorCompetency`, `AuditorCertification`, `AuditorAvailability`, `AuditorConflict`, `AuditStandard`, `AuditRequirement`, `AuditFindingClassification`, `AuditChecklistTemplate`, `AuditChecklistSection`, `AuditChecklistItem`, `AuditChecklistExecution`, `AuditChecklistResponse`, `AuditEvidence`, `AuditReport`, `AuditApproval`, `AuditFollowUp`, `AuditTimelineEvent`, `AuditWorkflow`, `AuditNotificationRule`, `AuditExternalAccess`, `AuditAiSuggestion`, `Process`, `ProcessArtifact`, `ProcessArtifactVersion`, `ProcessActivity`, `ProcessRaciRow`, `ProcessRaciAssignment`, `ProcessIntegration`, `ProcessStep`, `FormTemplate`, `FormField`, `FormSubmission`, `FormAnswer`, `FormTypeConfig`, `FormCategory`, `FormFolder`, `FormTag`, `FormTemplateTagRelation`, `FormTemplateVersion`, `FormTemplateSection`, `FormFieldOption`, `FormReusableBlock`, `FormTemplateRule`, `FormTemplateFormula`, `FormWorkflow`, `FormPermission`, `FormPrintLayout`, `FormSchedule`, `FormExecution`, `FormExecutionAssignment`, `FormExecutionResponseItem`, `FormEvidence`, `FormSignature`, `FormApproval`, `FormOperationalRecord`, `FormRecordCorrection`, `FormRecordTimeline`, `FormIssue`, `FormExternalLink`, `FormQrCode`, `FormKiosk`, `FormOfflineSyncQueue`, `FormOfflineSyncConflict`, `FormNotificationRule`, `FormExportJob`, `FormImportJob`, `FormAiSuggestion`, `FormRetentionPolicy`, `Meeting`, `MeetingParticipant`, `MeetingGuest`, `MeetingAgendaItem`, `MeetingDecision`, `MonthlyMeeting`, `MonthlyMeetingArea`, `MonthlyMeetingIndicator`, `MonthlyMeetingAgendaItem`, `MonthlyMeetingDecision`, `MonthlyMeetingFollowUp`, `MonthlyMeetingLearning`, `MonthlyMeetingStandardization`, `MonthlyMeetingParticipant`, `MonthlyMeetingChecklistItem`, `MonthlyMeetingAttachment`, `CommunicationPost`, `CommunicationCategory`, `CommunicationSettings`, `CommunicationPostAudience`, `CommunicationPostRecipient`, `CommunicationPostMedia`, `CommunicationPostRead`, `CommunicationPostReaction`, `CommunicationPostComment`, `CommunicationPollResponse`, `CommunicationCampaign`, `CommunicationMedia`, `Attachment`, `Comment`, `Notification`, `PushSubscription`, `TraceabilityEvent`, `StatusHistory`, `RelationshipMap`, `MapNode`, `MapEdge`, `MapLayout`, `TreatmentCase`, `EmailLog`, `CalendarInvite`, `ImportJob`, `ImportError`, `AuditLog`, `AppSetting`, `ParameterCategory`, `ParameterItem`, `OrgJob`, `OrgEmployee`, `CompensationEmployeeProfile`, `OrgJobApprovalRequest`, `OrgJobCareerPath`, `CompensationJobCatalog`, `CompensationJobCatalogVersion`, `CompensationJobDescription`, `CompensationSalaryTable`, `CompensationSalaryRange`, `CompensationPosition`, `CompensationAllocationHistory`, `CompensationSalarySnapshot`, `CompensationMovementRequest`, `CompensationBudget`, `CompensationCycle`, `CompensationSalarySurvey`, `CompensationSimulation`, `IndicatorResultAttachment`, `IndicatorResultComment`, `DbAdminAuditLog`, `DbAdminBackup`, `DbAdminSavedQuery`, `DbAdminQueryHistory`, `PortalModule`, `PortalPage`, `PortalFeature`, `PortalFeatureFlag`, `PortalNavOverride`, `PortalScopeRule`, `PortalIntegration`, `PortalEmailSetting`, `PortalMailbox`, `PortalAnnouncement`, `PortalMaintenanceWindow`, `PortalAdminAuditLog`, `PortalConfigSnapshot`, `PortalDiagnosticRun`, `PlatformAdminUser`, `PlatformAdminRole`, `PlatformAdminPermission`, `PlatformAdminRolePermission`, `PlatformAdminUserRole`, `PlatformAdminSession`, `PlatformAccessLog`, `PlatformAuditLog`, `PlatformCompanyProfile`, `PlatformCompanyStatusHistory`, `PlatformPlan`, `PlatformPlanModule`, `PlatformCompanyPlanOverride`, `PlatformContract`, `PlatformModuleCatalog`, `PlatformCompanyPage`, `PlatformCompanyModule`, `PlatformCompanyModuleHistory`, `PlatformFeatureFlagTarget`, `PlatformSupportSession`, `PlatformEnvironment`, `PlatformRelease`, `PlatformMigrationRecord`, `PlatformBackup`, `PlatformIntegrationConfig`, `PlatformJob`, `PlatformHealthCheck`, `Conversation`, `ConversationParticipant`, `Message`, `MessageAttachment`, `MessageReaction`, `UserPresence`, `HelpCategory`, `HelpArticle`, `HelpFeedback`, `UserIntegrationPreference`, `NotificationPreference`, `UserAreaAssignment`, `AreaVisibilityRule`, `UserVisibilityException`, `ExternalIntegration`, `ExternalIntegrationLog`, `InboundApiKey`, `FoodSafetyProgram`, `FoodSafetyProcess`, `FoodSafetyProcessStep`, `FoodSafetyFlowTemplate`, `FoodSafetyRiskMatrix`, `FoodSafetyHazard`, `FoodSafetyControlPlan`, `FoodSafetyMonitoringRecord`, `FoodSafetyStandard`, `FoodSafetyStandardVersion`, `FoodSafetyRequirement`, `FoodSafetyRequirementAssessment`, `FoodSafetySupplier`, `FoodSafetyMaterial`, `FoodSafetyLot`, `FoodSafetyTraceLink`, `FoodSafetyRecall`, `FoodSafetyRecallItem`, `RelationshipLink`, `ImpactAnalysis`, `ImpactAnalysisItem`, `RelationshipAuditLog`, `WorkflowDefinition`, `WorkflowVersion`, `WorkflowNode`, `WorkflowEdge`, `WorkflowInstance`, `WorkflowNodeExecution`, `WorkflowEvent`, `WorkflowTimer`, `WorkflowApproval`, `WorkflowTask`, `WorkflowTemplate`, `SlaPolicy`, `WorkflowExecutionLog`, `WorkflowDeadLetter`, `WorkflowIntegration`, `WorkItemIndex`, `UserDashboardPreference`, `UserDelegation`, `WorkItemFollow`, `MyDayAssistantLog`, `TaskBoard`, `TaskBoardColumn`, `WorkspaceTask`, `TaskComment`, `TaskAttachment`, `TaskChecklistItem`, `TaskActivity`, `TaskLink`, `PrizeProgram`, `PrizeProgramVersion`, `PrizeCompetence`, `PrizeAnnex`, `PrizeAnnexVersion`, `PrizeAnnexApproval`, `PrizeIndicator`, `PrizeIndicatorParameter`, `PrizeIndicatorRange`, `PrizeAuditLog`, `PrizeActualResult`, `PrizeActualEvidence`, `PrizeIndicatorCatalog`, `PrizeRuleGroup`, `PrizeRuleIndicator`, `PrizeRuleParameter`, `PrizeRuleBand`, `PrizeRuleAlias`, `PrizeOrgRef`, `PrizeCargoRef`, `PrizeCatalogActualResult`, `PrizeCellResult`, `PrizeUnmatchedEmployee`, `PrizeIntegrationConfig`, `PrizeIntegrationJob`, `PrizeEmployeeSnapshot`, `PrizeEmployeeEvent`, `PrizeModeratorRule`, `PrizeManualAdjustment`, `PrizeException`, `PrizeTemporaryAllocation`, `PrizeCalculationRun`, `PrizeCalculationResult`, `PrizeCalculationLine`, `PrizePayrollBatch`, `PrizePayrollBatchItem`, `PrizePayslip`, `SecurityPackageActivation`, `SecurityGate`, `SecurityEquipment`, `SecurityPost`, `SecurityPerson`, `SecurityContractorCompany`, `SecurityVehicle`, `SecurityDocumentRequirement`, `SecurityAuthorization`, `SecurityExternalInvite`, `SecurityAccessMovement`, `SecurityMaterialMovement`, `SecurityCustodyItem`, `SecurityCorrespondence`, `SecurityBlocklist`, `SecurityIncident`, `SecurityRoundRoute`, `SecurityRoundCheckpoint`, `SecurityRoundExecution`, `SecurityShiftHandover`, `SecurityLogBookEntry`, `SecurityQrCode`, `SecurityOfflineSync`, `SecurityAuditLog`, `SupportTicket`, `SupportTicketMessage`, `SupportTicketAttachment`, `PublicContactMessage`, `SiteVisit`, `SiteEvent`, `DataProcessingRecord`, `Subprocessor`, `DataIncident`, `WorkShiftTemplate`, `WorkScheduleAssignment`, `PersonnelKioskDevice`, `PersonnelKioskChallenge`, `PersonnelCounter`, `CompanyHoliday`, `TimesheetPeriodVersion`, `TimeClockEntry`, `TimeClockEntryTreatment`, `TimeClockReceiptSnapshot`, `TimesheetCalculationMemory`, `PersonnelBiometricProfile`, `PersonnelBiometricChallenge`, `PersonnelBiometricAttempt`, `TimeAdjustmentRequest`, `AttendanceOccurrence`, `TimeBankPolicy`, `TimeBankEntry`, `PersonnelLegalConfig`, `PayrollRubricMap`, `PayrollExport`, `PayrollLegalTableVersion`, `PayrollRubricDef`, `PayrollRubricVersion`, `PayrollCompetence`, `PayrollRun`, `PayrollTimekeepingSnapshot`, `PayrollRunWorker`, `PayrollRunItem`, `PayrollWorkerSettings`, `PayrollCompanySettings`, `PayrollDigitalCertificate`, `PayrollEsocialEvent`, `PayrollEsocialBatch`, `TimesheetPeriod`, `PersonnelEmployeeProfile`, `PersonnelSettings`, `EmployeeDependent`, `EmploymentEvent`, `EmployeeDossierFile`, `VacationRequest`, `LeaveRecord`, `EmployeeProcess`, `EmployeeProcessItem`, `MedicalExam`, `Warehouse`, `StockItem`, `StockBalance`, `StockMovement`, `MaterialWithdrawal`, `MaterialWithdrawalItem`, `Supplier`, `PurchaseApprovalRule`, `PurchaseRequisition`, `PurchaseRequisitionItem`, `PurchaseOrder`, `PurchaseOrderItem`, `PurchaseOrderApproval`, `PurchaseReceipt`, `PurchaseReceiptItem`, `Quotation`, `SupplierQuote`, `SupplierQuoteItem`, `SupplierInvoice`, `SupplierInvoiceItem`, `ServiceMeasurement`, `ServiceMeasurementItem`, `InventoryCount`, `InventoryCountItem`, `WithdrawalApprovalPolicy`, `PayrollAccountingConfig`, `PayrollBankConfig`, `PayrollBankBatch`, `PayrollBankItem`, `PayrollObligation`, `PayrollTermination`, `PayrollBenefit`, `PayrollBenefitEnrollment`, `PayrollLoan`, `PayrollPension`, `RecruitRequisition`, `RecruitRequisitionOpening`, `RecruitRequisitionApproval`, `RecruitRequisitionSnapshot`, `RecruitRecruiter`, `RecruitPipelineTemplate`, `RecruitPipelineStage`, `RecruitCareerPage`, `RecruitJobPosting`, `RecruitPostingChannel`, `RecruitEmailTemplate`, `RecruitCandidate`, `RecruitCandidateOtp`, `RecruitCandidateIdentity`, `RecruitApplication`, `RecruitApplicationEvent`, `RecruitCandidateDocument`, `RecruitConsent`, `RecruitDataRequest`, `RecruitScreeningQuestion`, `RecruitScreeningAnswer`, `RecruitScorecardCriterion`, `RecruitEvaluation`, `RecruitEvaluationRating`, `RecruitInterview`, `RecruitInterviewParticipant`, `RecruitAssessment`, `RecruitAiSetting`, `RecruitAiAnalysis`, `RecruitOffer`, `RecruitPreAdmission`, `RecruitPreAdmissionDocument`, `RecruitOccupationalExamRequest`, `RecruitOccupationalAppointment`, `RecruitAsoRecord`, `RecruitAdmission`, `RecruitProbationReview`, `TrainingCategory`, `TrainingInstructor`, `Training`, `TrainingRequirement`, `TrainingAssignment`, `TrainingClass`, `TrainingClassParticipant`, `TrainingCertificate`, `TrainingEvidence`, `TrainingEffectivenessReview`, `TrainingHistoryEntry`, `DevelopmentPlan`, `DevelopmentAction`, `TrainingAssessment`, `TrainingAssessmentQuestion`, `TrainingAssessmentOption`, `TrainingAssessmentAttempt`, `TrainingAssessmentAnswer`.
