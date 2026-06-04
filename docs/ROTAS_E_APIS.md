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
| `/audits` | `/audits` | `/audits/:id/findings`, `/audits/findings/:id/nonconformity` | `audits:view` |
| `/processes` | `/processes` | `/processes/:id/steps`, `/processes/steps/:stepId` | `processes:view` |
| `/forms` | `/forms` | `/forms/:id/submissions`, `/forms/submissions/:submissionId` | `forms:view` |

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
