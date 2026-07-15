# Diagnóstico + Mapa de Impacto — Módulo de Recrutamento e Seleção (ATS)

Data: 2026-07-15 · Autor: engenharia (sessão Claude) · Status: análise/planejamento (nenhum código alterado)

Atende à Seção 1 do prompt-mestre: análise do projeto e mapa de impacto ANTES de implementar.
Princípio central: **reuso máximo, zero cadastro paralelo** (mesma diretriz de
[[employee_360_integration]] e do módulo de Folha).

---

## 1. Inventário do que JÁ EXISTE e será REUSADO (sem duplicar)

| Necessidade do ATS | Onde já existe (reuso direto) |
|---|---|
| Empresa / estabelecimento | `Company` (tem `slug` único + `customDomain`) / `Branch` |
| Organograma (área/setor) | `OrgNode` (árvore, branch, tipo) |
| Cargo (descrição/CBO/faixa) | `OrgJob` (com `cbo`) + `CompensationJobCatalog`/`JobDescription`/`SalaryRange` (Cargos e Salários) |
| **Posição / quadro / orçamento** | **`CompensationPosition`** (code, orgJob, orgNode, costCenter, band, plannedSalary, budgetAmount, status OPEN, positionType, budgetStatus, `currentEmployeeId`) + **`CompensationBudget`** (plannedHeadcount por período/nó/CC) |
| Colaborador (alvo da admissão) | `OrgEmployee` + `PersonnelEmployeeProfile` (admissão via `EmployeesService.create` — já cria perfil de remuneração + evento) |
| Movimentação (recrutamento interno) | `CompensationMovementRequest` (promoção/transferência/mudança de cargo) |
| eSocial admissão (S-2190/2200/2220) | **módulo `payroll` eSocial** que acabei de construir: certificado A1 cifrado, assinatura XML-DSig, envelope/lote/transmissão SOAP, `PayrollEsocialEvent/Batch` — adaptável (S-2200 já gera XML) |
| Saúde ocupacional (ASO) | `MedicalExam` (lifecycle DP: ADMISSIONAL/PERIODICO/…) — estender, mantendo separação de acesso |
| GED / arquivos | `DocumentsModule` + `StorageService` (S3, URL assinada) + `EmployeeDossierFile` |
| Tarefas / SLA | módulo `tasks` (+ `WorkflowTask`) |
| Notificações / push | `NotificationsService` + `PushService` |
| Automações | módulo `automations` (motor + `SlaPolicy`) |
| Meu Dia | `WorkItemIndex` (caixa corporativa) |
| Auditoria | `AuditWriterService` (padrão central) |
| Permissões / perfis | `permission-catalog.ts` + `AccessProfile` + visibilidade por área (módulo access) |
| Multiempresa | isolamento manual por `companyId` (scoped-read-before-mutate) |
| Portal público por empresa | módulo `public` + `tenant.service` + rotas web fora do grupo `(app)` (ex.: `/contato`, `/login`); `Company.slug` p/ `/carreiras/{slug}` |
| IA (extração/resumo) | assistente Gemini (`ai` module) — reuso opcional, desligável por empresa |
| Cifra de segredos | `common/crypto.ts` (AES-256-GCM) |

**Conclusão:** posição, quadro, orçamento, cargo, colaborador, eSocial, ASO, GED, tarefas,
notificações, automações e auditoria JÁ EXISTEM. O ATS orquestra esses recursos; cria apenas o
que é próprio de recrutamento (requisição, vaga, candidato, candidatura, pipeline, avaliação,
proposta, pré-admissão, onboarding, banco de talentos, portal público/candidato).

---

## 2. Tabelas NOVAS (próprias do recrutamento) — prefixo `recruit_`/`Recruit*`

Requisição/vaga: `RecruitRequisition`, `RecruitRequisitionOpening`, `RecruitRequisitionApproval`,
`RecruitRequisitionSnapshot` (fotografia versionada da descrição/requisitos), `RecruitJobPosting`,
`RecruitPostingChannel`. **NÃO** cria cargo/posição — aponta para `CompensationPosition`/`OrgJob`.

Pipeline/candidato: `RecruitPipelineTemplate`, `RecruitPipelineStage`, `RecruitCandidate` (pessoa,
dedup por email/cpf/telefone/hash), `RecruitCandidateFile` (currículo/anexos via StorageService),
`RecruitApplication` (candidatura = candidato×vaga), `RecruitStageTransition`,
`RecruitScreeningQuestion`/`Answer`, `RecruitScorecard`/`Criteria`/`Evaluation`, `RecruitInterview`/
`Participant`, `RecruitAssessment`/`Result`, `RecruitMessage`, `RecruitNote`.

Talentos/origem: `RecruitTalentPool`/`Member`, `RecruitReferral`, `RecruitAgency`,
`RecruitApplicationSource`.

Proposta/pré-admissão: `RecruitOffer`/`OfferVersion`/`OfferApproval`, `RecruitPreHire`,
`RecruitDocumentRequirement`, `RecruitCandidateDocument`/`DocumentValidation`.

LGPD: `RecruitPrivacyNotice`, `RecruitConsent`, `RecruitAcknowledgement`, `RecruitDataSubjectRequest`.

Saúde ocupacional (domínio separado): `RecruitOccupationalExamRequest`, `RecruitOccupationalAppointment`,
`RecruitAsoRecord` (dados clínicos/CID NUNCA visíveis ao recrutador).

Onboarding/experiência: `RecruitOnboardingPlan`/`Task`, `RecruitProbationReview`.

Infra de eventos: `RecruitDomainEvent` + `RecruitOutboxEvent` (outbox p/ automações/eSocial idempotentes).

Todas com `companyId`, índices, unicidade, `createdAt/updatedAt`, soft-delete só onde apropriado.

---

## 3. Fases de implementação (o módulo NÃO cabe em um PR)

- **F1 — Fundação + Requisição + travas (quadro/orçamento).** Schema-núcleo; requisição a partir de
  `CompensationPosition`; snapshot versionado do cargo; workflow de aprovação configurável com
  segregação; reserva provisória de quadro/orçamento (e liberação no cancelamento). Permissões
  `recruit:*`. Sem UI pública ainda.
- **F2 — Vaga + Pipeline + Portal público de carreiras.** `/carreiras/{slug}` (listagem/detalhe,
  responsivo, sem dados internos), publicação de vaga, canais, pipeline Kanban/lista.
- **F3 — Candidato + Candidatura + Portal do candidato + LGPD.** Perfil reutilizável, upload seguro
  (MIME/antivírus/URL assinada), consentimentos versionados, dedup, direitos do titular.
- **F4 — Triagem/Avaliação/Entrevistas/Testes/Comunicação + IA opcional.** Scorecards, perguntas
  eliminatórias, agenda (calendário), avaliação cega, IA explicável e desligável.
- **F5 — Decisão → Proposta → Pré-admissão → Documentos.** Proposta na faixa (fora da faixa exige
  reaprovação), aceite/assinatura, checklist configurável, validação documental.
- **F6 — Saúde Ocupacional (ASO admissional) com acesso segregado** + preparação p/ evolução
  (periódico/retorno/demissional/S-2210/2220/2240).
- **F7 — Admissão → Serviço de Pessoal → eSocial → Onboarding → Experiência.** `Autorizar admissão`
  cria `OrgEmployee` (reusa `EmployeesService`), ocupa a posição (`currentEmployeeId`), converte a
  reserva, dispara S-2190/2200 (reusa o eSocial da folha), inicia onboarding e avaliações de experiência.

---

## 4. Endpoints (amostra), eventos e permissões

- Endpoints base `/api/recruitment/*` (autenticado) e `/api/careers/*` (público por slug).
- Eventos de domínio (outbox): RequisitionSubmitted/Approved, HeadcountReserved, BudgetReserved,
  JobPublished, ApplicationSubmitted, CandidateMoved, OfferAccepted, PreHireStarted, AsoCleared,
  AdmissionAuthorized, EmployeeCreated, PositionOccupied, EsocialEventAccepted, OnboardingStarted…
- Permissões novas (grupo "Recrutamento"): `recruit:view`, `recruit:requisition:create/approve`,
  `recruit:vacancy:manage`, `recruit:pipeline:operate`, `recruit:interview`, `recruit:offer:approve`,
  `recruit:prehire`, `recruit:admit`, `recruit:config`, `recruit:agency`, `recruit:candidate:self`
  (candidato) e `saude:occupational` (dados médicos, isolado). Segregação: solicitante ≠ aprovador;
  recrutador não vê ASO/CID; financeiro vê orçamento, não documentos pessoais.

## 5. Riscos de regressão e mitigação

- **Cargos e Salários (posições/orçamento):** o ATS ESCREVE em `CompensationPosition.currentEmployeeId`
  e reserva quadro — risco de conflito com o fluxo de movimentação existente. Mitigação: reserva via
  campo/estado próprio do ATS + transação; não alterar as telas de C&S existentes.
- **Admissão (EmployeesService):** reuso do `create` — risco de efeitos colaterais. Mitigação: chamar
  o serviço existente, não reescrever; cobrir com teste E2E.
- **eSocial:** reuso do adaptador da folha — risco de acoplar recrutamento a payroll. Mitigação:
  chamar via serviço exportado do `PayrollModule`, sem duplicar lógica.
- **Portal público:** superfície nova sem auth — risco de vazamento/spam. Mitigação: rate limit,
  sem dados internos, URLs assinadas, honeypot/captcha, isolamento por tenant.
- **Migrações:** todas aditivas; nenhuma altera tabela existente exceto ADD COLUMN se necessário
  (ex.: marcar posição reservada). ⚠️ tabelas antigas usam PascalCase ("OrgJob"), novas usam @@map snake.

## 6. Plano de testes

Unitários (lógica pura: travas de quadro/orçamento, dedup, transições de pipeline, cálculo de SLA/
métricas do funil); autorização/multiempresa; workflow de aprovação; upload seguro; automações
idempotentes; **E2E** do fluxo completo (posição→requisição→aprovação→vaga→candidatura→pipeline→
entrevista→proposta→pré-admissão→documentos→ASO→admissão→eSocial→onboarding).

## 7. Recomendação

Implementar por fases, começando pela **F1 (fundação + requisição + travas)**, que é a base correta
e de menor risco, com commits locais por fase (padrão desta plataforma) e deploy só sob autorização.

## 8. Decisões de arquitetura do usuário (2026-07-15)

1. **Identidade do candidato SEPARADA**: `RecruitCandidate` com autenticação própria (e-mail +
   código OTP/senha) e sessão isolada; o candidato NUNCA vira `User` interno nem acessa o app
   autenticado. Portal do candidato em rotas próprias.
2. **Travas de quadro/orçamento FLEXÍVEIS**: posição (`CompensationPosition`) é OPCIONAL — uma
   requisição de "aumento de quadro" pode criar a posição no próprio fluxo (com aprovação);
   saldo de quadro/orçamento indisponível vira AVISO + exceção aprovável e AUDITADA (não bloqueia
   duro). Mantém rastreabilidade das exceções.
3. **Portal público por SUBDOMÍNIO**: `empresa.gestao360.org/carreiras` reusando o multi-tenant por
   host já existente (branding por `Company.slug`/`customDomain`). Depende do DNS curinga
   *.gestao360.org (já pendente na infra multitenant).
4. **IA na F4 (triagem)**: reusa o assistente Gemini; explicável (critérios/evidências/confiança/
   versão/revisão humana obrigatória) e DESLIGÁVEL por empresa. Não decide sozinha.
