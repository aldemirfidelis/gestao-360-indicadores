# Diagnóstico + Mapa de Impacto — Módulo de Recrutamento e Seleção (ATS)

Data: 2026-07-15 · Autor: engenharia (sessão Claude) · Status: F1-F7 implementadas (módulo completo); commit/deploy conforme autorização do usuário

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

> Lista atualizada para refletir o que foi **efetivamente implementado** (algumas tabelas do plano
> original foram simplificadas ou fundidas durante a construção — ver notas `[impl]`).

Requisição/vaga: `RecruitRequisition`, `RecruitRequisitionOpening`, `RecruitRequisitionApproval`,
`RecruitRequisitionSnapshot` (fotografia versionada da descrição/requisitos), `RecruitJobPosting`,
`RecruitPostingChannel`. **NÃO** cria cargo/posição — aponta para `CompensationPosition`/`OrgJob`.

Pipeline/candidato: `RecruitPipelineTemplate`, `RecruitPipelineStage`, `RecruitCandidate` (identidade
separada, dedup por `companyId+emailNormalized`, JWT próprio), `RecruitCandidateOtp` (login sem
senha), `RecruitApplication` (candidatura = candidato×vaga, dedupe por posting+candidato),
`RecruitApplicationEvent` (timeline única — substitui o `RecruitStageTransition`/`RecruitNote`/
`RecruitMessage` planejados `[impl]`), `RecruitScreeningQuestion`/`Answer`,
`RecruitScorecardCriterion`/`RecruitEvaluation`/`RecruitEvaluationRating` (avaliação cega),
`RecruitInterview`/`Participant`, `RecruitAssessment`, `RecruitAiSetting`/`RecruitAiAnalysis`
(IA explicável, `humanReviewRequired` sempre true).

Talentos/origem: **não implementado** `[impl]` — banco de talentos/indicação/agência ficaram fora
do escopo entregue; se necessário, é uma fase futura própria.

Documentos do candidato: `RecruitCandidateDocument` (currículo/anexos via `DocumentStorageService`,
MIME allowlist + limite de tamanho, `scanStatus` explícito quando não há antivírus configurado).

Proposta/pré-admissão: `RecruitOffer` (faixa salarial + aprovação fora da banda),
`RecruitPreAdmission`/`RecruitPreAdmissionDocument` (checklist documental configurável) —
substituem o `OfferVersion`/`OfferApproval`/`RecruitPreHire`/`DocumentValidation` planejados
`[impl]`: versionamento vira `revision` no próprio `RecruitOffer`, aprovação vira
`status=PENDING_APPROVAL/APPROVED`.

LGPD: `RecruitConsent` (consentimento versionado por `CONSENT_VERSION`) + `RecruitDataRequest`
(direitos do titular: ACCESS/DELETION/RECTIFICATION/PORTABILITY) — substituem o
`RecruitPrivacyNotice`/`RecruitAcknowledgement`/`RecruitDataSubjectRequest` planejados `[impl]`.
Candidato abre a solicitação pelo portal; equipe atende em
`/servico-pessoal/recrutamento/lgpd` (`RecruitLgpdService`): exporta os dados (acesso/
portabilidade) ou anonimiza o candidato (exclusão — irreversível, preserva só o histórico da
candidatura sem PII).

Saúde ocupacional (domínio separado): `RecruitOccupationalExamRequest`, `RecruitOccupationalAppointment`,
`RecruitAsoRecord` (dados clínicos/CID só na permissão `saude:occupational`, nunca em `recruit:view`).

Admissão/experiência: `RecruitAdmission`, `RecruitProbationReview` (D+45/D+90) — onboarding em si
reusa o `LifecycleService.startProcess` (processo `ONBOARDING` do DP) em vez de tabelas próprias
`RecruitOnboardingPlan`/`Task` `[impl]`.

Infra de eventos: **não implementado** `[impl]` — não há outbox dedicado; efeitos colaterais
(notificações, e-mail, eSocial) disparam direto nos services, dentro das mesmas transações onde
fez sentido (ex.: admissão).

Todas com `companyId`, índices, unicidade, `createdAt/updatedAt`, soft-delete só onde apropriado.

---

## 3. Fases de implementação (o módulo NÃO cabe em um PR)

- **F1 — Fundação + Requisição + travas (quadro/orçamento).** ✅ CONCLUÍDA (commit bc14ccb).
  Schema-núcleo; requisição a partir de `CompensationPosition`; snapshot versionado do cargo;
  workflow de aprovação configurável com segregação; reserva provisória de quadro/orçamento (e
  liberação no cancelamento). Permissões `recruit:*`. Sem UI pública ainda.
- **F2 — Vaga + Pipeline + Portal público de carreiras.** ✅ CONCLUÍDA. Vaga nasce da requisição
  encaminhada (snapshot protegido + texto público editável); pipeline padrão de 10 etapas; publicação
  exige descrição + pipeline; portal `/carreiras` (lista) e `/carreiras/vagas/{slug}` (detalhe),
  responsivo, resolvido por subdomínio ou `?empresa={slug}`, expondo **apenas** campos públicos
  (`toPublicVacancy`) — nunca orçamento/CC/aprovadores/salário interno. UI interna em
  `/servico-pessoal/recrutamento/vagas`. Candidatura ainda é stub (F3).
- **F3 — Candidato + Candidatura + Portal do candidato + LGPD.** ✅ CONCLUÍDA. `RecruitCandidate`
  com identidade separada (JWT próprio, derivado por scrypt de `JWT_ACCESS_SECRET`, nunca cruza
  com auth interno), login por e-mail+OTP ou senha opcional. `apply()` exige `consent:true`,
  dedupe por vaga+candidato, screening obrigatório bloqueia candidatura. Upload de currículo com
  allowlist de MIME + limite de tamanho (`DocumentStorageService`). Portal `/candidato` (perfil,
  candidaturas, documentos, ofertas, pré-admissão, ASO redigido, solicitações LGPD). LGPD tem as
  duas pontas: candidato abre o pedido pelo portal, equipe atende em
  `/servico-pessoal/recrutamento/lgpd` (exporta dados ou anonimiza — irreversível).
- **F4 — Triagem/Avaliação/Entrevistas/Testes/IA opcional.** ✅ CONCLUÍDA. Perguntas de triagem com
  eliminatórias (`knockout`), scorecard ponderado por vaga, **avaliação cega** (avaliador só vê as
  próprias notas até submeter as dele), entrevistas com notificação interna + e-mail ao candidato,
  testes/assessments, IA explicável (Gemini) com prompt que proíbe inferir atributos sensíveis
  (idade/raça/gênero/saúde) e marca `humanReviewRequired:true` sempre — decisão nunca é automática;
  fallback determinístico por termos quando a IA está desligada ou falha.
- **F5 — Decisão → Proposta → Pré-admissão → Documentos.** ✅ CONCLUÍDA. Proposta lida a faixa
  salarial da requisição (`evaluateSalaryBand`); fora da faixa exige `recruit:offer:approve`;
  candidato aceita/recusa pelo portal; checklist documental padrão (RG/CPF/comprovante/dados
  bancários) configurável por pré-admissão.
- **F6 — Saúde Ocupacional (ASO admissional) com acesso segregado.** ✅ CONCLUÍDA. Visão do
  recrutador só recebe resultado/data (redigido); prontuário clínico completo (CID, notas, médico)
  só é servido a quem tem a permissão dedicada `saude:occupational` — nunca `recruit:view`/`manage`.
  Evolução p/ periódico/retorno/demissional/S-2210/2220/2240 fica para quando o cliente operar
  saúde ocupacional continuamente (fora do escopo desta entrega).
- **F7 — Admissão → Serviço de Pessoal → eSocial → Onboarding → Experiência.** ✅ CONCLUÍDA.
  `Autorizar admissão` exige oferta ACEITA + pré-admissão + ASO apto, reusa `EmployeesService.create`
  (fonte única de colaborador — nunca cria cadastro paralelo), ocupa a posição
  (`currentEmployeeId`), converte a reserva de quadro/orçamento, dispara S-2200 via
  `PayrollEsocialService.generateAdmissionEventForEmployee` (não-bloqueante: falha no eSocial não
  impede a admissão), inicia onboarding (`LifecycleService.startProcess`) e agenda avaliações de
  experiência D+45/D+90. Idempotente (reexecutar não duplica colaborador).

---

## 4. Endpoints (amostra), eventos e permissões

- Endpoints base `/api/recruitment/*` (autenticado, `RolesGuard`) e `/api/careers/*` (`@Public`,
  parte pública por slug + parte do candidato protegida por `CandidateGuard` com token próprio).
- Timeline por evento (`RecruitApplicationEvent`, sem outbox dedicado — ver nota `[impl]` na seção 2):
  CREATED, SCREENING_FLAG, STAGE_MOVED, EVALUATION_SUBMITTED, INTERVIEW_SCHEDULED, AI_TRIAGE,
  OFFER_PREPARED/APPROVED/SENT/ACCEPTED/DECLINED/CANCELLED, PREHIRE_STARTED/DOC_REQUIRED/SUBMITTED/
  REVIEWED, ASO_REQUESTED/SCHEDULED/CLEARED/BLOCKED/CANCELLED, ADMISSION_AUTHORIZED, WITHDRAWN,
  REJECTED, NOTE, DOC_ADDED.
- Permissões efetivas (grupo "Recrutamento" + "Saude Ocupacional" no catálogo, semântica OR + wildcard
  `<módulo>:manage`): `recruit:view`, `recruit:requisition:create`, `recruit:requisition:approve`,
  `recruit:offer:approve` (proposta fora da faixa), `recruit:prehire` (validar documentos de
  pré-admissão), `recruit:admit` (autorizar admissão), `recruit:lgpd` (atender direitos do titular),
  `recruit:manage` (cobre as demais ações de configuração/pipeline/vaga) e `saude:occupational`
  (isolado — dados clínicos do ASO nunca aparecem em `recruit:view`/`recruit:manage`). Segregação
  real verificada: solicitante ≠ aprovador na requisição; recrutador não vê ASO/CID; admissão exige
  permissão própria distinta de `recruit:manage` (embora o wildcard `recruit:manage` também cubra).

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
