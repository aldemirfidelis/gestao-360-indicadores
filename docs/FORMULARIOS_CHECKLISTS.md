# Formularios, Checklists e Registros Operacionais

## Diagnostico

Antes desta evolucao o modulo possuia:

- `FormTemplate` com numero, titulo, tipo, status e vinculos com area/processo/indicador.
- `FormField` simples.
- `FormSubmission` e `FormAnswer` para preenchimentos.
- Isolamento por `companyId` e escopo de area via `AccessService`.

## O Que Foi Criado

Migration: `20260605143000_forms_operational_platform`.

Novas familias de dados:

- Catalogo: `FormTypeConfig`, `FormCategory`, `FormFolder`, `FormTag`, `FormTemplateTagRelation`.
- Versionamento: `FormTemplateVersion`, `FormTemplateSection`, `FormFieldOption`.
- Construtor e governanca: `FormReusableBlock`, `FormTemplateRule`, `FormTemplateFormula`, `FormWorkflow`, `FormPermission`, `FormPrintLayout`.
- Planejamento e execucao: `FormSchedule`, `FormExecution`, `FormExecutionAssignment`, `FormExecutionResponseItem`.
- Registro operacional: `FormOperationalRecord`, `FormRecordCorrection`, `FormRecordTimeline`.
- Evidencias e assinaturas: `FormEvidence`, `FormSignature`, `FormApproval`.
- Pendencias e integracoes: `FormIssue`, `FormExternalLink`, `FormQrCode`, `FormKiosk`.
- Offline, notificacoes, importacao/exportacao e IA: `FormOfflineSyncQueue`, `FormOfflineSyncConflict`, `FormNotificationRule`, `FormExportJob`, `FormImportJob`, `FormAiSuggestion`, `FormRetentionPolicy`.

## Camadas Do Motor

```text
Template
  -> Versao publicada do template
  -> Execucao / preenchimento
  -> Registro operacional imutavel
```

Cada preenchimento passa a guardar `templateVersionId` e `snapshot`, preservando a estrutura usada no momento do registro.

## O Que Foi Reaproveitado

- Empresas, usuarios, areas, processos e indicadores continuam sendo as fontes oficiais.
- Permissoes seguem o RBAC existente, com `forms:manage` como curinga do modulo.
- Area vinculada ao formulario, execucao ou preenchimento continua validada pelo `AccessService`.
- Pendencias podem apontar para plano de acao ou nao conformidade, mas nao criam NC automaticamente.

## APIs Principais

- `GET /forms/dashboard`
- `GET /forms/library`
- `GET /forms/options`
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

## Permissoes

Base legada mantida:

- `forms:view`
- `forms:create`
- `forms:update`
- `forms:delete`
- `forms:manage`

Permissoes granulares adicionadas:

- `forms:dashboard`
- `forms:templates`
- `forms:builder`
- `forms:versions`
- `forms:publish`
- `forms:execute`
- `forms:records`
- `forms:evidence`
- `forms:approve`
- `forms:issues`
- `forms:export`
- `forms:external`
- `forms:kiosk`
- `forms:offline`
- `forms:rules`
- `forms:settings`
- `forms:ai`
