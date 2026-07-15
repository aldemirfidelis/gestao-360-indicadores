-- F5: propostas, pre-admissao e checklist documental do ATS.

CREATE TABLE "recruit_offers" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "revision" INTEGER NOT NULL DEFAULT 1,
  "salaryAmountCents" INTEGER NOT NULL,
  "salaryPeriod" TEXT NOT NULL DEFAULT 'MONTHLY',
  "currency" TEXT NOT NULL DEFAULT 'BRL',
  "salaryMinCents" INTEGER,
  "salaryMaxCents" INTEGER,
  "withinSalaryBand" BOOLEAN NOT NULL DEFAULT true,
  "approvalRequired" BOOLEAN NOT NULL DEFAULT false,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "sentById" TEXT,
  "sentAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "declinedAt" TIMESTAMP(3),
  "declineReason" TEXT,
  "startDate" TIMESTAMP(3),
  "workMode" TEXT,
  "contractType" TEXT,
  "location" TEXT,
  "benefits" JSONB,
  "clauses" JSONB,
  "justification" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recruit_offers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recruit_pre_admissions" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "offerId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "admissionTargetDate" TIMESTAMP(3),
  "checklistVersion" TEXT NOT NULL DEFAULT 'default-2026-07-15',
  "createdById" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recruit_pre_admissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recruit_pre_admission_documents" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "preAdmissionId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "instructions" TEXT,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "candidateDocumentId" TEXT,
  "submittedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "dueAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recruit_pre_admission_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "recruit_offers_companyId_applicationId_idx" ON "recruit_offers"("companyId", "applicationId");
CREATE INDEX "recruit_offers_companyId_status_idx" ON "recruit_offers"("companyId", "status");
CREATE UNIQUE INDEX "recruit_pre_admissions_offerId_key" ON "recruit_pre_admissions"("offerId");
CREATE INDEX "recruit_pre_admissions_companyId_applicationId_idx" ON "recruit_pre_admissions"("companyId", "applicationId");
CREATE INDEX "recruit_pre_admissions_companyId_status_idx" ON "recruit_pre_admissions"("companyId", "status");
CREATE INDEX "recruit_pre_admission_documents_companyId_preAdmissionId_idx" ON "recruit_pre_admission_documents"("companyId", "preAdmissionId");
CREATE INDEX "recruit_pre_admission_documents_companyId_status_idx" ON "recruit_pre_admission_documents"("companyId", "status");

ALTER TABLE "recruit_offers" ADD CONSTRAINT "recruit_offers_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "recruit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recruit_pre_admissions" ADD CONSTRAINT "recruit_pre_admissions_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "recruit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recruit_pre_admissions" ADD CONSTRAINT "recruit_pre_admissions_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "recruit_offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recruit_pre_admission_documents" ADD CONSTRAINT "recruit_pre_admission_documents_preAdmissionId_fkey" FOREIGN KEY ("preAdmissionId") REFERENCES "recruit_pre_admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recruit_pre_admission_documents" ADD CONSTRAINT "recruit_pre_admission_documents_candidateDocumentId_fkey" FOREIGN KEY ("candidateDocumentId") REFERENCES "recruit_candidate_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
