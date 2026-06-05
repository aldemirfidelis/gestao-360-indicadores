# Rotas e APIs

Resumo das principais rotas HTTP da API e rotas web do Gestão 360.

## Convenções

- API base local: `http://localhost:3333/api`.
- Web local: `http://localhost:3000`.
- Autenticação: JWT via header `Authorization: Bearer <token>`.
- Escopo multiempresa: `companyId` vem do usuário autenticado/empresa ativa.
- Escopo por área: aplicado por `AccessService` nos módulos operacionais.

## Autenticação e usuário

| Método | API | Uso |
| --- | --- | --- |
| `POST` | `/auth/login` | Login |
| `POST` | `/auth/refresh` | Renovar token |
| `GET` | `/auth/me` | Perfil autenticado |
| `GET` | `/users` | Usuários e permissões |

## Fluxo principal

| Web | API principal | Permissão base |
| --- | --- | --- |
| `/indicators` | `/indicators` | `indicators:view` |
| `/indicators/[id]` | `/indicators/:id`, `/traceability/indicators/:id` | `indicators:view` |
| `/deviations` | `/deviations` | `deviations:view` |
| `/actions` | `/actions` | `actions:view` |
| `/meetings` | `/meetings` | `meetings:view` |
| `/eficacia` | `/actions/:id/effectiveness` | `eficacia:view`, `actions:effectiveness` |

## Estratégia, OKR e PMO

| Web | API principal | Permissão base |
| --- | --- | --- |
| `/strategy` | `/strategy` | `strategy:view` |
| `/okrs` | `/okrs` | `okrs:view` |
| `/projects` | `/projects` | `projects:view` |
| `/visualization` | `/dashboard`, `/strategy` | `visualization:view`, `dashboard:view` |

## Módulos corporativos FASE 6

| Web | API principal | Sub-recursos | Permissão base |
| --- | --- | --- | --- |
| `/risks` | `/risks` | resumo, opções | `risks:view` |
| `/nonconformities` | `/nonconformities` | CAPA, eficácia, ação corretiva | `nc:view` |
| `/documents` | `/documents` | validade, aprovação, publicação | `doc:view` |
| `/audits` | `/audits` | programas, universo, auditores, checklists, evidencias, constatacoes, relatorios, IA | `audits:view` |
| `/processes` | `/processes` | `/processes/:id/steps`, `/processes/steps/:stepId` | `processes:view` |
| `/forms` | `/forms` | dashboard, biblioteca, builder, versoes, execucoes, registros, evidencias, aprovacoes, pendencias, IA | `forms:view` |

## Administração e suporte

| Web | API principal | Permissão base |
| --- | --- | --- |
| `/settings` | `/settings` e módulos correlatos | `settings:view` |
| `/settings/database` | `/database-admin/*` | `database:admin` (somente Super Admin) |
| `/settings/portal` | `/portal-admin/*` | `portal:admin` (somente Super Admin) |
| `/reports` | `/reports` | `reports:view` |
| `/audit` | `/audit` | `audit:view` |
| `/comunicacao` | `/communication/*` | autenticado |
| `/pessoas` | `/communication/directory` | autenticado |
| `/integracoes` | `/integrations` | autenticado |
| `/ajuda` | `/help` | autenticado |

## Deep-links de rastreabilidade

Eventos da timeline do indicador navegam para:

- `ACTION_PLAN` -> `/actions/:id`
- `DEVIATION` -> `/deviations/:id`
- `MEETING` -> `/meetings/:id`
- `RISK` -> `/risks?focus=:id`
- `NON_CONFORMITY` -> `/nonconformities?focus=:id`
- `DOCUMENT` -> `/documents?focus=:id`
- `PROCESS`/`PROCESS_STEP` -> `/processes?focus=:processId`
- `FORM_TEMPLATE`/`FORM_SUBMISSION` -> `/forms?focus=:templateId`

## GED Documentos

Rotas adicionais do modulo Documentos:

- `GET /documents/matrix`
- `GET /documents/dashboard`
- `GET|POST /documents/types`
- `GET|POST /documents/templates`
- `POST /documents/generate-code`
- `POST /documents/:id/submit-review`
- `POST /documents/:id/start-review`
- `POST /documents/:id/request-adjustments`
- `POST /documents/:id/complete-review`
- `POST /documents/:id/send-approval`
- `POST /documents/:id/start-approval`
- `POST /documents/:id/approve`
- `POST /documents/:id/reject`
- `POST /documents/:id/publish`
- `POST /documents/:id/new-revision`
- `POST /documents/:id/autosave`
- `POST /documents/:id/files`
- `GET /documents/:id/files/:fileId/download`
- `POST /documents/jobs/expiration`
- `GET /documents/diagnostics`

## Formularios e Checklists

Rotas adicionais do modulo Formularios:

- `GET /forms/dashboard`
- `GET /forms/library`
- `GET /forms/:id/builder`
- `POST /forms/:id/versions`
- `POST /forms/:id/publish`
- `POST /forms/:id/duplicate`
- `GET|POST /forms/executions`
- `GET /forms/executions/:executionId`
- `POST /forms/executions/:executionId/responses`
- `POST /forms/executions/:executionId/complete`
- `GET|POST /forms/:id/submissions`
- `PATCH /forms/submissions/:submissionId`
- `POST /forms/submissions/:submissionId/evidence`
- `POST /forms/submissions/:submissionId/signatures`
- `POST /forms/submissions/:submissionId/approvals`
- `POST /forms/submissions/:submissionId/issues`
- `POST /forms/ai/suggestions`

## Auditorias e Compliance

Rotas adicionais do modulo Auditorias:

- `GET /audits/dashboard`
- `GET /audits/options`
- `POST /audits/:id/transition`
- `POST /audits/:id/start`
- `POST /audits/:id/complete`
- `POST /audits/:id/reopen`
- `GET|POST /audits/programs`
- `PATCH /audits/programs/:programId`
- `GET|POST /audits/universe`
- `PATCH /audits/universe/:itemId`
- `GET|POST /audits/risk-criteria`
- `PATCH /audits/risk-criteria/:criterionId`
- `GET|POST /audits/types`
- `PATCH /audits/types/:typeId`
- `GET|POST /audits/auditors`
- `PATCH /audits/auditors/:auditorId`
- `POST /audits/auditors/suggest`
- `GET|POST /audits/standards`
- `PATCH /audits/standards/:standardId`
- `GET|POST /audits/checklist-templates`
- `PATCH /audits/checklist-templates/:templateId`
- `POST /audits/:id/checklists`
- `POST /audits/checklist-executions/:executionId/responses`
- `POST /audits/checklist-executions/:executionId/complete`
- `GET|POST /audits/:id/evidence`
- `POST /audits/:id/findings`
- `PATCH|DELETE /audits/findings/:findingId`
- `POST /audits/findings/:findingId/nonconformity`
- `POST /audits/:id/report`
- `PATCH /audits/reports/:reportId/decision`
- `POST /audits/:id/follow-ups`
- `PATCH /audits/follow-ups/:followUpId`
- `POST /audits/:id/ai/suggestions`
- `PATCH /audits/ai/suggestions/:suggestionId/decision`
