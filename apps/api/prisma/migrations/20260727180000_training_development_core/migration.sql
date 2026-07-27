-- =====================================================================
-- Treinamento e Desenvolvimento (T&D) — nucleo do modulo
--
-- Migracao ADITIVA: nenhuma tabela ou coluna existente e alterada. O modulo
-- consome os cadastros oficiais (OrgEmployee, OrgJob, OrgNode, Document, User)
-- por chave estrangeira, sem duplicar cadastro.
-- =====================================================================

-- ---------- Enums ----------
CREATE TYPE "TrainingModality" AS ENUM ('PRESENCIAL', 'ONLINE', 'HIBRIDO', 'LEITURA_ORIENTADA', 'DIALOGO_SEGURANCA', 'INTEGRACAO', 'PRATICO', 'EXTERNO', 'RECICLAGEM', 'CIENCIA');
CREATE TYPE "TrainingStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DRAFT');
CREATE TYPE "TrainingValidityKind" AS ENUM ('NONE', 'DAYS', 'MONTHS', 'YEARS', 'FROM_DOCUMENT');
CREATE TYPE "TrainingRequirementTarget" AS ENUM ('ALL_COMPANY', 'ORG_NODE', 'JOB', 'EMPLOYEE');
CREATE TYPE "TrainingAssignmentStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'AWAITING_ASSESSMENT', 'AWAITING_EFFECTIVENESS', 'AWAITING_VALIDATION', 'VALID', 'DUE_SOON', 'EXPIRED', 'FAILED', 'ABSENT', 'WAIVED', 'NOT_APPLICABLE', 'SUPERSEDED');
CREATE TYPE "TrainingClassStatus" AS ENUM ('PLANNED', 'OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED');
CREATE TYPE "TrainingAttendanceStatus" AS ENUM ('INVITED', 'CONFIRMED', 'PRESENT', 'ABSENT', 'EXCUSED');
CREATE TYPE "TrainingResult" AS ENUM ('PENDING', 'APPROVED', 'FAILED', 'NOT_APPLICABLE');
CREATE TYPE "TrainingAttendanceMethod" AS ENUM ('INSTRUCTOR', 'DIGITAL_SIGNATURE', 'DEVICE_SIGNATURE', 'SCANNED_LIST', 'QR_CODE', 'FACIAL', 'IMPORT');
CREATE TYPE "TrainingCertificateOrigin" AS ENUM ('INTERNAL', 'EXTERNAL');
CREATE TYPE "TrainingCertificateStatus" AS ENUM ('PENDING_VALIDATION', 'VALID', 'REJECTED', 'EXPIRED');
CREATE TYPE "TrainingRevisionAction" AS ENUM ('NONE', 'ACKNOWLEDGE', 'RETRAIN_SPECIFIC_JOBS', 'RETRAIN_ALL', 'RECYCLE_PREVIOUS_VERSIONS');

-- ---------- Categorias ----------
CREATE TABLE "training_categories" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "training_categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "training_categories_companyId_slug_key" ON "training_categories"("companyId", "slug");
CREATE INDEX "training_categories_companyId_active_idx" ON "training_categories"("companyId", "active");
ALTER TABLE "training_categories" ADD CONSTRAINT "training_categories_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------- Instrutores ----------
CREATE TABLE "training_instructors" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "institution" TEXT,
    "email" TEXT,
    "external" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "training_instructors_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "training_instructors_companyId_active_idx" ON "training_instructors"("companyId", "active");
ALTER TABLE "training_instructors" ADD CONSTRAINT "training_instructors_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "training_instructors" ADD CONSTRAINT "training_instructors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------- Treinamentos ----------
CREATE TABLE "trainings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT,
    "modality" "TrainingModality" NOT NULL DEFAULT 'PRESENCIAL',
    "status" "TrainingStatus" NOT NULL DEFAULT 'ACTIVE',
    "workloadMinutes" INTEGER NOT NULL DEFAULT 60,
    "validityKind" "TrainingValidityKind" NOT NULL DEFAULT 'NONE',
    "validityValue" INTEGER,
    "dueSoonDays" INTEGER NOT NULL DEFAULT 30,
    "deadlineDays" INTEGER,
    "documentId" TEXT,
    "documentVersion" INTEGER,
    "requiresAssessment" BOOLEAN NOT NULL DEFAULT false,
    "minimumScore" DECIMAL(5,2),
    "maxAttempts" INTEGER,
    "requiresAttendance" BOOLEAN NOT NULL DEFAULT true,
    "requiresEffectiveness" BOOLEAN NOT NULL DEFAULT false,
    "effectivenessDays" INTEGER,
    "requiresCertificate" BOOLEAN NOT NULL DEFAULT false,
    "allowsOnline" BOOLEAN NOT NULL DEFAULT false,
    "plannedCostCents" INTEGER,
    "responsibleUserId" TEXT,
    "defaultInstructorId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "trainings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "trainings_companyId_code_key" ON "trainings"("companyId", "code");
CREATE INDEX "trainings_companyId_status_idx" ON "trainings"("companyId", "status");
CREATE INDEX "trainings_documentId_idx" ON "trainings"("documentId");
ALTER TABLE "trainings" ADD CONSTRAINT "trainings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trainings" ADD CONSTRAINT "trainings_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "training_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "trainings" ADD CONSTRAINT "trainings_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "trainings" ADD CONSTRAINT "trainings_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "trainings" ADD CONSTRAINT "trainings_defaultInstructorId_fkey" FOREIGN KEY ("defaultInstructorId") REFERENCES "training_instructors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------- Exigencias (regras que geram a matriz) ----------
CREATE TABLE "training_requirements" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "target" "TrainingRequirementTarget" NOT NULL,
    "targetId" TEXT,
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "admissionDeadlineDays" INTEGER,
    "movementDeadlineDays" INTEGER,
    "validityKind" "TrainingValidityKind",
    "validityValue" INTEGER,
    "originDocumentId" TEXT,
    "originRiskId" TEXT,
    "originProcessId" TEXT,
    "originNonConformityId" TEXT,
    "originAuditId" TEXT,
    "activity" TEXT,
    "justification" TEXT,
    "blocksOperation" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "training_requirements_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "training_requirements_trainingId_target_targetId_key" ON "training_requirements"("trainingId", "target", "targetId");
CREATE INDEX "training_requirements_companyId_active_idx" ON "training_requirements"("companyId", "active");
CREATE INDEX "training_requirements_originDocumentId_idx" ON "training_requirements"("originDocumentId");
ALTER TABLE "training_requirements" ADD CONSTRAINT "training_requirements_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "training_requirements" ADD CONSTRAINT "training_requirements_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "trainings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_requirements" ADD CONSTRAINT "training_requirements_originDocumentId_fkey" FOREIGN KEY ("originDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------- Turmas ----------
CREATE TABLE "training_classes" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "code" TEXT,
    "instructorId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "location" TEXT,
    "meetingUrl" TEXT,
    "capacity" INTEGER,
    "status" "TrainingClassStatus" NOT NULL DEFAULT 'PLANNED',
    "attendanceMethod" "TrainingAttendanceMethod" NOT NULL DEFAULT 'INSTRUCTOR',
    "actualCostCents" INTEGER,
    "notes" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "training_classes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "training_classes_companyId_status_idx" ON "training_classes"("companyId", "status");
CREATE INDEX "training_classes_companyId_startsAt_idx" ON "training_classes"("companyId", "startsAt");
CREATE INDEX "training_classes_trainingId_idx" ON "training_classes"("trainingId");
ALTER TABLE "training_classes" ADD CONSTRAINT "training_classes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "training_classes" ADD CONSTRAINT "training_classes_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "trainings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "training_classes" ADD CONSTRAINT "training_classes_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "training_instructors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------- Matriz materializada (colaborador x treinamento) ----------
CREATE TABLE "training_assignments" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "requirementId" TEXT,
    "status" "TrainingAssignmentStatus" NOT NULL DEFAULT 'PENDING',
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "trainedDocumentVersion" INTEGER,
    "score" DECIMAL(5,2),
    "result" "TrainingResult" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "classId" TEXT,
    "waivedById" TEXT,
    "waivedAt" TIMESTAMP(3),
    "waiverReason" TEXT,
    "supersededById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "training_assignments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "training_assignments_employeeId_trainingId_requirementId_key" ON "training_assignments"("employeeId", "trainingId", "requirementId");
CREATE INDEX "training_assignments_companyId_status_idx" ON "training_assignments"("companyId", "status");
CREATE INDEX "training_assignments_companyId_dueAt_idx" ON "training_assignments"("companyId", "dueAt");
CREATE INDEX "training_assignments_companyId_validUntil_idx" ON "training_assignments"("companyId", "validUntil");
CREATE INDEX "training_assignments_trainingId_status_idx" ON "training_assignments"("trainingId", "status");
CREATE INDEX "training_assignments_employeeId_idx" ON "training_assignments"("employeeId");
ALTER TABLE "training_assignments" ADD CONSTRAINT "training_assignments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "training_assignments" ADD CONSTRAINT "training_assignments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "OrgEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_assignments" ADD CONSTRAINT "training_assignments_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "trainings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_assignments" ADD CONSTRAINT "training_assignments_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "training_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "training_assignments" ADD CONSTRAINT "training_assignments_classId_fkey" FOREIGN KEY ("classId") REFERENCES "training_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------- Participantes da turma ----------
CREATE TABLE "training_class_participants" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "attendance" "TrainingAttendanceStatus" NOT NULL DEFAULT 'INVITED',
    "attendanceMethod" "TrainingAttendanceMethod",
    "attendedAt" TIMESTAMP(3),
    "score" DECIMAL(5,2),
    "result" "TrainingResult" NOT NULL DEFAULT 'PENDING',
    "absenceReason" TEXT,
    "waitlisted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "training_class_participants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "training_class_participants_classId_employeeId_key" ON "training_class_participants"("classId", "employeeId");
CREATE INDEX "training_class_participants_companyId_employeeId_idx" ON "training_class_participants"("companyId", "employeeId");
ALTER TABLE "training_class_participants" ADD CONSTRAINT "training_class_participants_classId_fkey" FOREIGN KEY ("classId") REFERENCES "training_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_class_participants" ADD CONSTRAINT "training_class_participants_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "OrgEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------- Certificados ----------
CREATE TABLE "training_certificates" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "trainingId" TEXT,
    "assignmentId" TEXT,
    "origin" "TrainingCertificateOrigin" NOT NULL DEFAULT 'INTERNAL',
    "status" "TrainingCertificateStatus" NOT NULL DEFAULT 'PENDING_VALIDATION',
    "number" TEXT,
    "institution" TEXT,
    "workloadMinutes" INTEGER,
    "issuedAt" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "documentId" TEXT,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "validatedById" TEXT,
    "validatedAt" TIMESTAMP(3),
    "rejectionNote" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "training_certificates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "training_certificates_companyId_status_idx" ON "training_certificates"("companyId", "status");
CREATE INDEX "training_certificates_employeeId_idx" ON "training_certificates"("employeeId");
ALTER TABLE "training_certificates" ADD CONSTRAINT "training_certificates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "training_certificates" ADD CONSTRAINT "training_certificates_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "OrgEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_certificates" ADD CONSTRAINT "training_certificates_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "trainings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "training_certificates" ADD CONSTRAINT "training_certificates_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "training_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "training_certificates" ADD CONSTRAINT "training_certificates_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------- Evidencias da turma ----------
CREATE TABLE "training_evidences" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fileName" TEXT,
    "fileUrl" TEXT,
    "note" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "training_evidences_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "training_evidences_companyId_classId_idx" ON "training_evidences"("companyId", "classId");
ALTER TABLE "training_evidences" ADD CONSTRAINT "training_evidences_classId_fkey" FOREIGN KEY ("classId") REFERENCES "training_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------- Avaliacao de eficacia ----------
CREATE TABLE "training_effectiveness_reviews" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "reviewerUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "effective" BOOLEAN,
    "criteria" JSONB,
    "score" DECIMAL(5,2),
    "note" TEXT,
    "actionPlanId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "training_effectiveness_reviews_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "training_effectiveness_reviews_companyId_dueAt_idx" ON "training_effectiveness_reviews"("companyId", "dueAt");
CREATE INDEX "training_effectiveness_reviews_assignmentId_idx" ON "training_effectiveness_reviews"("assignmentId");
ALTER TABLE "training_effectiveness_reviews" ADD CONSTRAINT "training_effectiveness_reviews_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "training_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------- Historico auditavel ----------
CREATE TABLE "training_history_entries" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "trainingId" TEXT,
    "classId" TEXT,
    "event" TEXT NOT NULL,
    "description" TEXT,
    "previousValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT,
    "actorUserId" TEXT,
    "source" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "training_history_entries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "training_history_entries_companyId_employeeId_createdAt_idx" ON "training_history_entries"("companyId", "employeeId", "createdAt");
CREATE INDEX "training_history_entries_assignmentId_idx" ON "training_history_entries"("assignmentId");
ALTER TABLE "training_history_entries" ADD CONSTRAINT "training_history_entries_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "OrgEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_history_entries" ADD CONSTRAINT "training_history_entries_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "training_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Acao padrao aplicada a quem ja foi treinado quando o documento e revisado.
ALTER TABLE "trainings" ADD COLUMN "revisionAction" "TrainingRevisionAction" NOT NULL DEFAULT 'ACKNOWLEDGE';
