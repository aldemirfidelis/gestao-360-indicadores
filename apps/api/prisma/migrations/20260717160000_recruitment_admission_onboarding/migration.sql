-- F7: autorizacao de admissao, ponte com colaborador, onboarding e experiencia.

CREATE TABLE "recruit_admissions" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "preAdmissionId" TEXT,
  "offerId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'AUTHORIZED',
  "employeeId" TEXT,
  "positionId" TEXT,
  "openingId" TEXT,
  "onboardingProcessId" TEXT,
  "esocialEventId" TEXT,
  "esocialStatus" TEXT NOT NULL DEFAULT 'NOT_GENERATED',
  "admissionDate" TIMESTAMP(3) NOT NULL,
  "authorizedById" TEXT,
  "authorizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recruit_admissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recruit_probation_reviews" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "admissionId" TEXT NOT NULL,
  "employeeId" TEXT,
  "cycleDay" INTEGER NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "reviewerId" TEXT,
  "completedAt" TIMESTAMP(3),
  "recommendation" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recruit_probation_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recruit_admissions_applicationId_key" ON "recruit_admissions"("applicationId");
CREATE UNIQUE INDEX "recruit_admissions_preAdmissionId_key" ON "recruit_admissions"("preAdmissionId");
CREATE INDEX "recruit_admissions_companyId_status_idx" ON "recruit_admissions"("companyId", "status");
CREATE INDEX "recruit_admissions_companyId_employeeId_idx" ON "recruit_admissions"("companyId", "employeeId");

CREATE UNIQUE INDEX "recruit_probation_reviews_admissionId_cycleDay_key" ON "recruit_probation_reviews"("admissionId", "cycleDay");
CREATE INDEX "recruit_probation_reviews_companyId_dueAt_idx" ON "recruit_probation_reviews"("companyId", "dueAt");
CREATE INDEX "recruit_probation_reviews_companyId_status_idx" ON "recruit_probation_reviews"("companyId", "status");

ALTER TABLE "recruit_admissions" ADD CONSTRAINT "recruit_admissions_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "recruit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recruit_admissions" ADD CONSTRAINT "recruit_admissions_preAdmissionId_fkey" FOREIGN KEY ("preAdmissionId") REFERENCES "recruit_pre_admissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recruit_probation_reviews" ADD CONSTRAINT "recruit_probation_reviews_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "recruit_admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
