# Relatorio de mudancas dos ultimos 3 dias

Gerado em: 2026-06-08  
Projeto: `d:\Projetos\gestao-indicadores-sqlite`  
Periodo auditado: de `2026-06-05 00:00:00 -0300` ate o `HEAD` atual  
Base anterior ao periodo: `aa0891873e095b46e2948ab4679fea77a8716348`  
Primeiro commit do periodo: `bbafd178cf6f016e0a268851c7e7d32f1e876aaa`  
Ultimo commit do periodo: `8fada6637e4629771279245e50704b8b03188b2d`

## Observacao sobre "por voce"

O historico Git deste repositorio nao guarda um metadado separado dizendo "feito pelo Codex". Ele registra commits, autores e datas. No periodo auditado, todos os commits locais encontrados estao com autor `Aldemir Fidelis <aldemir.fidelis@gmail.com>`.

Para nao deixar nada de fora, este relatorio cobre todos os commits presentes no branch atual desde `2026-06-05 00:00:00 -0300`. Antes de criar este relatorio, o `git status --short` estava limpo, ou seja, nao havia alteracoes locais nao commitadas.

## Artefato bruto completo

O diff completo linha-a-linha do periodo foi salvo aqui:

- `docs/RELATORIO_MUDANCAS_CODEX_ULTIMOS_3_DIAS.diff`

Esse arquivo contem o detalhe bruto de todas as linhas adicionadas, removidas e alteradas entre:

```bash
git diff aa0891873e095b46e2948ab4679fea77a8716348..HEAD
```

## Resumo numerico

- Commits no periodo: 13
- Arquivos afetados no diff liquido: 94
- Insercoes liquidas: 24.527
- Delecoes liquidas: 2.334
- Arquivos novos criados no periodo: 41
- Arquivos removidos por completo: 0

## Principais frentes alteradas

- Fundacao de modulos corporativos da Fase 6: GED/documentos, auditorias/compliance e formularios/checklists operacionais.
- Novas migrations Prisma, grande expansao do schema e populacao de dados demo.
- Portal Admin Global / Platform Admin, com autenticacao, permissoes, catalogo de modulos, auditoria e telas administrativas.
- Suporte a Collabora/WOPI para edicao de documentos.
- Reorganizacao das configuracoes para dentro do Platform Admin.
- Ajustes de navegacao lateral, areas de configuracao e controle de acesso por modulo/plano.
- Reformulacao da landing page publica e melhoria do login/demo.
- Restricao do usuario demo a empresa demo.
- Correcao de acesso a estrategia para respeitar escopo de empresa.
- Atualizacao de documentacao tecnica dos novos modulos e rotas.

## Linha do tempo completa dos commits

### 2026-06-05 09:32:47 -0300

Commit: `bbafd178cf6f016e0a268851c7e7d32f1e876aaa`  
Mensagem: `feat(seed-demo): popular módulos corporativos na Empresa Demonstração`

Mudancas:

- Expandiu `apps/api/prisma/seed-demo-company.ts`.
- Populou dados de demonstracao dos modulos corporativos.
- Estatistica do commit: 299 insercoes, 4 delecoes.

Arquivos:

- `apps/api/prisma/seed-demo-company.ts`

### 2026-06-05 18:02:46 -0300

Commit: `d9d2b383e421e87daba47151877fb9aa397e1559`  
Mensagem: `refactor(nav): remover abas redundantes do menu lateral`

Mudancas:

- Removeu entradas redundantes do menu lateral.
- Estatistica do commit: 29 delecoes.

Arquivos:

- `apps/web/components/shell/navigation.ts`

### 2026-06-05 18:03:24 -0300

Commit: `1ad8f3e1b6818db8bb1e663e03aa6d1c6f994405`  
Mensagem: `feat(corporativos): fundacao GED + auditorias/compliance + formularios operacionais`

Mudancas:

- Criou migrations para GED/documentos, auditorias/compliance e formularios operacionais.
- Expandiu fortemente o schema Prisma para suportar os novos dominios.
- Atualizou seeds gerais e da empresa demo.
- Criou servicos auxiliares para codigo, risco e armazenamento em auditorias, documentos e formularios.
- Ampliou controllers, services, modules e testes dos modulos `audits`, `documents` e `forms`.
- Adicionou permissoes ao catalogo de usuarios.
- Evoluiu telas web de auditorias, documentos e formularios.
- Criou documentacao especifica de Auditorias/Compliance, Formularios/Checklists e GED.
- Atualizou documentacao da Fase 6 e de rotas/APIs.
- Estatistica do commit: 15.566 insercoes, 1.363 delecoes.

Arquivos:

- `apps/api/prisma/migrations/20260605100000_document_ged_foundation/migration.sql`
- `apps/api/prisma/migrations/20260605113000_audit_compliance_foundation/migration.sql`
- `apps/api/prisma/migrations/20260605143000_forms_operational_platform/migration.sql`
- `apps/api/prisma/migrations/20260605160000_fix_document_relation_index_names/migration.sql`
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/seed-demo-company.ts`
- `apps/api/prisma/seed.ts`
- `apps/api/src/modules/audits/audit-code.service.ts`
- `apps/api/src/modules/audits/audit-risk.service.ts`
- `apps/api/src/modules/audits/audit-storage.service.ts`
- `apps/api/src/modules/audits/audits.controller.ts`
- `apps/api/src/modules/audits/audits.module.ts`
- `apps/api/src/modules/audits/audits.service.spec.ts`
- `apps/api/src/modules/audits/audits.service.ts`
- `apps/api/src/modules/documents/document-code.service.ts`
- `apps/api/src/modules/documents/document-editor.service.ts`
- `apps/api/src/modules/documents/document-storage.service.ts`
- `apps/api/src/modules/documents/documents.controller.ts`
- `apps/api/src/modules/documents/documents.module.ts`
- `apps/api/src/modules/documents/documents.service.spec.ts`
- `apps/api/src/modules/documents/documents.service.ts`
- `apps/api/src/modules/forms/form-code.service.ts`
- `apps/api/src/modules/forms/form-storage.service.ts`
- `apps/api/src/modules/forms/forms.controller.ts`
- `apps/api/src/modules/forms/forms.module.ts`
- `apps/api/src/modules/forms/forms.service.spec.ts`
- `apps/api/src/modules/forms/forms.service.ts`
- `apps/api/src/modules/users/permission-catalog.ts`
- `apps/web/app/(app)/audits/page.tsx`
- `apps/web/app/(app)/documents/page.tsx`
- `apps/web/app/(app)/forms/page.tsx`
- `docs/AUDITORIAS_COMPLIANCE.md`
- `docs/FASE6_MODULOS_CORPORATIVOS.md`
- `docs/FORMULARIOS_CHECKLISTS.md`
- `docs/GED_DOCUMENTOS.md`
- `docs/ROTAS_E_APIS.md`

### 2026-06-06 21:28:05 -0300

Commit: `49adcfbd73de6179a43870c07da97fb73c712c92`  
Mensagem: `feat: add platform admin global and Collabora WOPI`

Mudancas:

- Atualizou exemplos de ambiente, Caddyfile, Dockerfile e compose de droplet.
- Criou migration para administracao global da plataforma.
- Expandiu schema e seed para Platform Admin.
- Registrou modulo Platform Admin na aplicacao.
- Ajustou interceptor de auditoria.
- Evoluiu o modulo de documentos para editor, storage, DOCX e WOPI.
- Criou controller WOPI.
- Criou decorators, guard, controle de acesso, catalogo, controller, module, tipos e services do Platform Admin.
- Criou autenticacao, auditoria, bootstrap e servico principal do Platform Admin.
- Ajustou gate/configuracao do Portal Admin.
- Atualizou tela de documentos.
- Criou login e pagina inicial do Platform Admin no web.
- Criou componente principal `platform-admin-app`.
- Criou cliente web `platform-admin-api`.
- Atualizou documentacao GED e criou documentacao do Portal Admin Global.
- Estatistica do commit: 5.708 insercoes, 48 delecoes.

Arquivos:

- `.env.droplet.example`
- `.env.example`
- `.env.production.example`
- `Caddyfile`
- `apps/api/Dockerfile`
- `apps/api/prisma/migrations/20260606193000_platform_admin_global/migration.sql`
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/seed.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/common/interceptors/audit.interceptor.ts`
- `apps/api/src/modules/documents/document-editor.service.ts`
- `apps/api/src/modules/documents/document-storage.service.ts`
- `apps/api/src/modules/documents/documents.module.ts`
- `apps/api/src/modules/documents/documents.service.spec.ts`
- `apps/api/src/modules/documents/documents.service.ts`
- `apps/api/src/modules/documents/docx.util.ts`
- `apps/api/src/modules/documents/wopi.controller.ts`
- `apps/api/src/modules/platform-admin/decorators/current-platform-admin.decorator.ts`
- `apps/api/src/modules/platform-admin/decorators/platform-permissions.decorator.ts`
- `apps/api/src/modules/platform-admin/guards/platform-admin-auth.guard.ts`
- `apps/api/src/modules/platform-admin/platform-admin.access.spec.ts`
- `apps/api/src/modules/platform-admin/platform-admin.access.ts`
- `apps/api/src/modules/platform-admin/platform-admin.catalog.ts`
- `apps/api/src/modules/platform-admin/platform-admin.controller.ts`
- `apps/api/src/modules/platform-admin/platform-admin.module.ts`
- `apps/api/src/modules/platform-admin/platform-admin.types.ts`
- `apps/api/src/modules/platform-admin/services/platform-admin-audit.service.ts`
- `apps/api/src/modules/platform-admin/services/platform-admin-auth.service.ts`
- `apps/api/src/modules/platform-admin/services/platform-admin-bootstrap.service.ts`
- `apps/api/src/modules/platform-admin/services/platform-admin.service.ts`
- `apps/api/src/modules/portal-admin/guards/portal-gate.guard.ts`
- `apps/api/src/modules/portal-admin/services/portal-config.service.ts`
- `apps/web/app/(app)/documents/page.tsx`
- `apps/web/app/platform-admin/login/page.tsx`
- `apps/web/app/platform-admin/page.tsx`
- `apps/web/components/auth/auth-provider.tsx`
- `apps/web/components/platform-admin/platform-admin-app.tsx`
- `apps/web/components/portal-admin/types.ts`
- `apps/web/lib/platform-admin-api.ts`
- `docker-compose.droplet.yml`
- `docs/GED_DOCUMENTOS.md`
- `docs/PORTAL_ADMIN_GLOBAL.md`

### 2026-06-06 22:09:20 -0300

Commit: `6c6fe99f25cffed4fe4d1a5a8789b18872f4cf24`  
Mensagem: `fix: promote demo platform owner during bootstrap`

Mudancas:

- Ajustou o bootstrap do Platform Admin para promover corretamente o dono da plataforma demo.
- Estatistica do commit: 51 insercoes, 8 delecoes.

Arquivos:

- `apps/api/src/modules/platform-admin/services/platform-admin-bootstrap.service.ts`

### 2026-06-07 13:37:00 -0300

Commit: `2c2b833fc71ad5fed9a73e7dc26dabc0e448cf95`  
Mensagem: `chore: move settings to platform admin`

Mudancas:

- Criou layouts para areas de auditoria, integracoes e configuracoes.
- Ajustou pagina de plataforma e usuarios.
- Moveu/reorganizou configuracoes para o Platform Admin.
- Ajustou aba de navegacao do Portal Admin.
- Ajustou accordion e mapa de navegacao lateral.
- Estatistica do commit: 231 insercoes, 48 delecoes.

Arquivos:

- `apps/web/app/(app)/audit/layout.tsx`
- `apps/web/app/(app)/integracoes/layout.tsx`
- `apps/web/app/(app)/plataforma/page.tsx`
- `apps/web/app/(app)/settings/layout.tsx`
- `apps/web/app/(app)/users/page.tsx`
- `apps/web/components/platform-admin/platform-admin-app.tsx`
- `apps/web/components/portal-admin/tabs/navigation-tab.tsx`
- `apps/web/components/shell/accordion-navigation.tsx`
- `apps/web/components/shell/navigation.ts`

### 2026-06-07 14:04:48 -0300

Commit: `9462925919bdb2a434a73f92650464f6d04e0ee3`  
Mensagem: `feat: customize platform plans and module access`

Mudancas:

- Personalizou planos da plataforma.
- Ajustou acesso por modulos.
- Evoluiu guard do Portal Admin.
- Evoluiu interface do Platform Admin para administrar planos/modulos.
- Estatistica do commit: 312 insercoes, 31 delecoes.

Arquivos:

- `apps/api/src/modules/platform-admin/services/platform-admin.service.ts`
- `apps/api/src/modules/portal-admin/guards/portal-gate.guard.ts`
- `apps/web/components/platform-admin/platform-admin-app.tsx`

### 2026-06-07 16:02:42 -0300

Commit: `075262e14f773e1b468f0502b174544d1aea065d`  
Mensagem: `feat: move full settings into platform admin`

Mudancas:

- Ajustou modulos de access, database-admin, help e portal-admin.
- Criou controller legado do Platform Admin para concentrar rotas administrativas.
- Ajustou controller e module do Platform Admin.
- Moveu configuracoes completas para dentro do Platform Admin.
- Reduziu pagina de detalhe de tabela e criou componente compartilhado para detalhe de tabela.
- Ajustou cliente API web para novas chamadas administrativas.
- Estatistica do commit: 1.409 insercoes, 196 delecoes.

Arquivos:

- `apps/api/src/modules/access/access.module.ts`
- `apps/api/src/modules/database-admin/database-admin.module.ts`
- `apps/api/src/modules/help/help.module.ts`
- `apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts`
- `apps/api/src/modules/platform-admin/platform-admin.controller.ts`
- `apps/api/src/modules/platform-admin/platform-admin.module.ts`
- `apps/api/src/modules/portal-admin/portal-admin.module.ts`
- `apps/web/app/(app)/settings/database/structure/page.tsx`
- `apps/web/app/(app)/settings/database/tables/[table]/page.tsx`
- `apps/web/app/(app)/settings/page.tsx`
- `apps/web/components/database-admin/table-detail-content.tsx`
- `apps/web/components/platform-admin/platform-admin-app.tsx`
- `apps/web/lib/api.ts`

### 2026-06-07 16:57:54 -0300

Commit: `4cb28402b51bfaef6069466b8e8f78d2c226d8c3`  
Mensagem: `feat: complete settings audit in platform admin`

Mudancas:

- Completou auditoria de configuracoes dentro do Platform Admin.
- Ajustou controller legado, module e service do Platform Admin.
- Ajustou pagina de portal settings.
- Evoluiu a aplicacao web do Platform Admin.
- Atualizou clientes API usados pela area administrativa.
- Estatistica do commit: 745 insercoes, 95 delecoes.

Arquivos:

- `apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts`
- `apps/api/src/modules/platform-admin/platform-admin.module.ts`
- `apps/api/src/modules/platform-admin/services/platform-admin.service.ts`
- `apps/web/app/(app)/settings/portal/page.tsx`
- `apps/web/components/platform-admin/platform-admin-app.tsx`
- `apps/web/lib/api.ts`
- `apps/web/lib/platform-admin-api.ts`

### 2026-06-07 17:45:19 -0300

Commit: `df12079020bb51c0c38e58a74555c73a440797d1`  
Mensagem: `feat: refresh landing page and demo login`

Mudancas:

- Atualizou README com informacoes de acesso/demo.
- Ajustou seed.
- Ajustou pagina de login.
- Reformulou fortemente a landing page publica.
- Estatistica do commit: 353 insercoes, 716 delecoes.

Arquivos:

- `README.md`
- `apps/api/prisma/seed.ts`
- `apps/web/app/login/page.tsx`
- `apps/web/app/page.tsx`

### 2026-06-07 20:47:56 -0300

Commit: `e7e7b316d919be0311b19e6a60146b816dac597f`  
Mensagem: `fix: clean public landing hero`

Mudancas:

- Limpou e simplificou o hero da landing page publica.
- Estatistica do commit: 78 insercoes, 95 delecoes.

Arquivos:

- `apps/web/app/page.tsx`

### 2026-06-07 21:09:18 -0300

Commit: `c7d24c9f146c9b2a55ef4ff49502b6627ab788d5`  
Mensagem: `fix: restrict demo user to demo company`

Mudancas:

- Ajustou README e seed para restringir usuario demo a empresa demo.
- Estatistica do commit: 13 insercoes, 7 delecoes.

Arquivos:

- `README.md`
- `apps/api/prisma/seed.ts`

### 2026-06-07 22:24:21 -0300

Commit: `8fada6637e4629771279245e50704b8b03188b2d`  
Mensagem: `fix: enforce company scoped strategy access`

Mudancas:

- Reforcou acesso a estrategia com escopo de empresa.
- Ajustou service de estrategia e testes.
- Ajustou tela de detalhe de estrategia.
- Ajustou provider de autenticacao para lidar melhor com contexto/empresa.
- Estatistica do commit: 90 insercoes, 22 delecoes.

Arquivos:

- `apps/api/src/modules/strategy/strategy.service.spec.ts`
- `apps/api/src/modules/strategy/strategy.service.ts`
- `apps/web/app/(app)/strategy/[id]/page.tsx`
- `apps/web/components/auth/auth-provider.tsx`

## Arquivos novos criados no periodo

- `apps/api/prisma/migrations/20260605100000_document_ged_foundation/migration.sql`
- `apps/api/prisma/migrations/20260605113000_audit_compliance_foundation/migration.sql`
- `apps/api/prisma/migrations/20260605143000_forms_operational_platform/migration.sql`
- `apps/api/prisma/migrations/20260605160000_fix_document_relation_index_names/migration.sql`
- `apps/api/prisma/migrations/20260606193000_platform_admin_global/migration.sql`
- `apps/api/src/modules/audits/audit-code.service.ts`
- `apps/api/src/modules/audits/audit-risk.service.ts`
- `apps/api/src/modules/audits/audit-storage.service.ts`
- `apps/api/src/modules/documents/document-code.service.ts`
- `apps/api/src/modules/documents/document-editor.service.ts`
- `apps/api/src/modules/documents/document-storage.service.ts`
- `apps/api/src/modules/documents/docx.util.ts`
- `apps/api/src/modules/documents/wopi.controller.ts`
- `apps/api/src/modules/forms/form-code.service.ts`
- `apps/api/src/modules/forms/form-storage.service.ts`
- `apps/api/src/modules/platform-admin/decorators/current-platform-admin.decorator.ts`
- `apps/api/src/modules/platform-admin/decorators/platform-permissions.decorator.ts`
- `apps/api/src/modules/platform-admin/guards/platform-admin-auth.guard.ts`
- `apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts`
- `apps/api/src/modules/platform-admin/platform-admin.access.spec.ts`
- `apps/api/src/modules/platform-admin/platform-admin.access.ts`
- `apps/api/src/modules/platform-admin/platform-admin.catalog.ts`
- `apps/api/src/modules/platform-admin/platform-admin.controller.ts`
- `apps/api/src/modules/platform-admin/platform-admin.module.ts`
- `apps/api/src/modules/platform-admin/platform-admin.types.ts`
- `apps/api/src/modules/platform-admin/services/platform-admin-audit.service.ts`
- `apps/api/src/modules/platform-admin/services/platform-admin-auth.service.ts`
- `apps/api/src/modules/platform-admin/services/platform-admin-bootstrap.service.ts`
- `apps/api/src/modules/platform-admin/services/platform-admin.service.ts`
- `apps/web/app/(app)/audit/layout.tsx`
- `apps/web/app/(app)/integracoes/layout.tsx`
- `apps/web/app/(app)/settings/layout.tsx`
- `apps/web/app/platform-admin/login/page.tsx`
- `apps/web/app/platform-admin/page.tsx`
- `apps/web/components/database-admin/table-detail-content.tsx`
- `apps/web/components/platform-admin/platform-admin-app.tsx`
- `apps/web/lib/platform-admin-api.ts`
- `docs/AUDITORIAS_COMPLIANCE.md`
- `docs/FORMULARIOS_CHECKLISTS.md`
- `docs/GED_DOCUMENTOS.md`
- `docs/PORTAL_ADMIN_GLOBAL.md`

## Estatistica liquida por arquivo

| Insercoes | Delecoes | Arquivo |
|---:|---:|---|
| 31 | 2 | `.env.droplet.example` |
| 19 | 0 | `.env.example` |
| 20 | 0 | `.env.production.example` |
| 28 | 0 | `Caddyfile` |
| 4 | 3 | `README.md` |
| 4 | 1 | `apps/api/Dockerfile` |
| 597 | 0 | `apps/api/prisma/migrations/20260605100000_document_ged_foundation/migration.sql` |
| 1274 | 0 | `apps/api/prisma/migrations/20260605113000_audit_compliance_foundation/migration.sql` |
| 1590 | 0 | `apps/api/prisma/migrations/20260605143000_forms_operational_platform/migration.sql` |
| 10 | 0 | `apps/api/prisma/migrations/20260605160000_fix_document_relation_index_names/migration.sql` |
| 464 | 0 | `apps/api/prisma/migrations/20260606193000_platform_admin_global/migration.sql` |
| 3514 | 249 | `apps/api/prisma/schema.prisma` |
| 490 | 81 | `apps/api/prisma/seed-demo-company.ts` |
| 333 | 3 | `apps/api/prisma/seed.ts` |
| 2 | 0 | `apps/api/src/app.module.ts` |
| 8 | 1 | `apps/api/src/common/interceptors/audit.interceptor.ts` |
| 1 | 1 | `apps/api/src/modules/access/access.module.ts` |
| 323 | 0 | `apps/api/src/modules/audits/audit-code.service.ts` |
| 97 | 0 | `apps/api/src/modules/audits/audit-risk.service.ts` |
| 62 | 0 | `apps/api/src/modules/audits/audit-storage.service.ts` |
| 241 | 12 | `apps/api/src/modules/audits/audits.controller.ts` |
| 4 | 1 | `apps/api/src/modules/audits/audits.module.ts` |
| 16 | 1 | `apps/api/src/modules/audits/audits.service.spec.ts` |
| 1605 | 79 | `apps/api/src/modules/audits/audits.service.ts` |
| 15 | 1 | `apps/api/src/modules/database-admin/database-admin.module.ts` |
| 210 | 0 | `apps/api/src/modules/documents/document-code.service.ts` |
| 306 | 0 | `apps/api/src/modules/documents/document-editor.service.ts` |
| 90 | 0 | `apps/api/src/modules/documents/document-storage.service.ts` |
| 198 | 2 | `apps/api/src/modules/documents/documents.controller.ts` |
| 6 | 2 | `apps/api/src/modules/documents/documents.module.ts` |
| 144 | 15 | `apps/api/src/modules/documents/documents.service.spec.ts` |
| 1090 | 55 | `apps/api/src/modules/documents/documents.service.ts` |
| 162 | 0 | `apps/api/src/modules/documents/docx.util.ts` |
| 170 | 0 | `apps/api/src/modules/documents/wopi.controller.ts` |
| 160 | 0 | `apps/api/src/modules/forms/form-code.service.ts` |
| 31 | 0 | `apps/api/src/modules/forms/form-storage.service.ts` |
| 102 | 0 | `apps/api/src/modules/forms/forms.controller.ts` |
| 3 | 1 | `apps/api/src/modules/forms/forms.module.ts` |
| 38 | 1 | `apps/api/src/modules/forms/forms.service.spec.ts` |
| 1044 | 49 | `apps/api/src/modules/forms/forms.service.ts` |
| 1 | 0 | `apps/api/src/modules/help/help.module.ts` |
| 11 | 0 | `apps/api/src/modules/platform-admin/decorators/current-platform-admin.decorator.ts` |
| 8 | 0 | `apps/api/src/modules/platform-admin/decorators/platform-permissions.decorator.ts` |
| 122 | 0 | `apps/api/src/modules/platform-admin/guards/platform-admin-auth.guard.ts` |
| 827 | 0 | `apps/api/src/modules/platform-admin/platform-admin-legacy.controller.ts` |
| 20 | 0 | `apps/api/src/modules/platform-admin/platform-admin.access.spec.ts` |
| 41 | 0 | `apps/api/src/modules/platform-admin/platform-admin.access.ts` |
| 220 | 0 | `apps/api/src/modules/platform-admin/platform-admin.catalog.ts` |
| 287 | 0 | `apps/api/src/modules/platform-admin/platform-admin.controller.ts` |
| 60 | 0 | `apps/api/src/modules/platform-admin/platform-admin.module.ts` |
| 13 | 0 | `apps/api/src/modules/platform-admin/platform-admin.types.ts` |
| 123 | 0 | `apps/api/src/modules/platform-admin/services/platform-admin-audit.service.ts` |
| 194 | 0 | `apps/api/src/modules/platform-admin/services/platform-admin-auth.service.ts` |
| 150 | 0 | `apps/api/src/modules/platform-admin/services/platform-admin-bootstrap.service.ts` |
| 1120 | 0 | `apps/api/src/modules/platform-admin/services/platform-admin.service.ts` |
| 47 | 6 | `apps/api/src/modules/portal-admin/guards/portal-gate.guard.ts` |
| 17 | 1 | `apps/api/src/modules/portal-admin/portal-admin.module.ts` |
| 23 | 8 | `apps/api/src/modules/portal-admin/services/portal-config.service.ts` |
| 9 | 0 | `apps/api/src/modules/strategy/strategy.service.spec.ts` |
| 31 | 16 | `apps/api/src/modules/strategy/strategy.service.ts` |
| 77 | 0 | `apps/api/src/modules/users/permission-catalog.ts` |
| 21 | 0 | `apps/web/app/(app)/audit/layout.tsx` |
| 829 | 261 | `apps/web/app/(app)/audits/page.tsx` |
| 866 | 201 | `apps/web/app/(app)/documents/page.tsx` |
| 1113 | 268 | `apps/web/app/(app)/forms/page.tsx` |
| 21 | 0 | `apps/web/app/(app)/integracoes/layout.tsx` |
| 3 | 3 | `apps/web/app/(app)/plataforma/page.tsx` |
| 7 | 1 | `apps/web/app/(app)/settings/database/structure/page.tsx` |
| 2 | 173 | `apps/web/app/(app)/settings/database/tables/[table]/page.tsx` |
| 21 | 0 | `apps/web/app/(app)/settings/layout.tsx` |
| 15 | 6 | `apps/web/app/(app)/settings/page.tsx` |
| 21 | 1 | `apps/web/app/(app)/settings/portal/page.tsx` |
| 26 | 5 | `apps/web/app/(app)/strategy/[id]/page.tsx` |
| 7 | 7 | `apps/web/app/(app)/users/page.tsx` |
| 1 | 1 | `apps/web/app/login/page.tsx` |
| 319 | 713 | `apps/web/app/page.tsx` |
| 87 | 0 | `apps/web/app/platform-admin/login/page.tsx` |
| 5 | 0 | `apps/web/app/platform-admin/page.tsx` |
| 28 | 2 | `apps/web/components/auth/auth-provider.tsx` |
| 186 | 0 | `apps/web/components/database-admin/table-detail-content.tsx` |
| 2023 | 0 | `apps/web/components/platform-admin/platform-admin-app.tsx` |
| 14 | 14 | `apps/web/components/portal-admin/tabs/navigation-tab.tsx` |
| 1 | 1 | `apps/web/components/portal-admin/types.ts` |
| 12 | 12 | `apps/web/components/shell/accordion-navigation.tsx` |
| 22 | 40 | `apps/web/components/shell/navigation.ts` |
| 46 | 5 | `apps/web/lib/api.ts` |
| 90 | 0 | `apps/web/lib/platform-admin-api.ts` |
| 48 | 0 | `docker-compose.droplet.yml` |
| 222 | 0 | `docs/AUDITORIAS_COMPLIANCE.md` |
| 46 | 27 | `docs/FASE6_MODULOS_CORPORATIVOS.md` |
| 94 | 0 | `docs/FORMULARIOS_CHECKLISTS.md` |
| 217 | 0 | `docs/GED_DOCUMENTOS.md` |
| 119 | 0 | `docs/PORTAL_ADMIN_GLOBAL.md` |
| 88 | 2 | `docs/ROTAS_E_APIS.md` |

## Comandos usados para conferir

```bash
git status --short
git log --since="2026-06-05 00:00:00 -0300" --date=iso --pretty=format:"%H%x09%an%x09%ae%x09%ad%x09%s" --stat
git rev-list --before="2026-06-05 00:00:00 -0300" -n 1 HEAD
git diff --shortstat aa0891873e095b46e2948ab4679fea77a8716348..HEAD
git diff --numstat aa0891873e095b46e2948ab4679fea77a8716348..HEAD
git diff --output=docs/RELATORIO_MUDANCAS_CODEX_ULTIMOS_3_DIAS.diff aa0891873e095b46e2948ab4679fea77a8716348..HEAD
```

