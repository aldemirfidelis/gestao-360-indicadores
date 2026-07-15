-- F6: saude ocupacional do ATS, com ASO admissional segregado.

CREATE TABLE "recruit_occupational_exam_requests" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "preAdmissionId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "examType" TEXT NOT NULL DEFAULT 'ADMISSIONAL',
  "dueAt" TIMESTAMP(3),
  "requestedById" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cancelledById" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancellationReason" TEXT,
  "operationalNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recruit_occupational_exam_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recruit_occupational_appointments" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "location" TEXT,
  "providerName" TEXT,
  "instructions" TEXT,
  "candidateNotifiedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recruit_occupational_appointments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recruit_aso_records" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "result" TEXT NOT NULL,
  "examDate" TIMESTAMP(3) NOT NULL,
  "validUntil" TIMESTAMP(3),
  "physicianName" TEXT,
  "physicianRegistry" TEXT,
  "clinicalNotes" TEXT,
  "restrictionNotes" TEXT,
  "cidCodes" JSONB,
  "reportedById" TEXT,
  "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recruit_aso_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "recruit_occupational_exam_requests_companyId_applicationId_idx" ON "recruit_occupational_exam_requests"("companyId", "applicationId");
CREATE INDEX "recruit_occupational_exam_requests_companyId_preAdmissionId_idx" ON "recruit_occupational_exam_requests"("companyId", "preAdmissionId");
CREATE INDEX "recruit_occupational_exam_requests_companyId_status_idx" ON "recruit_occupational_exam_requests"("companyId", "status");

CREATE UNIQUE INDEX "recruit_occupational_appointments_requestId_key" ON "recruit_occupational_appointments"("requestId");
CREATE INDEX "recruit_occupational_appointments_companyId_scheduledAt_idx" ON "recruit_occupational_appointments"("companyId", "scheduledAt");
CREATE INDEX "recruit_occupational_appointments_companyId_status_idx" ON "recruit_occupational_appointments"("companyId", "status");

CREATE UNIQUE INDEX "recruit_aso_records_requestId_key" ON "recruit_aso_records"("requestId");
CREATE INDEX "recruit_aso_records_companyId_result_idx" ON "recruit_aso_records"("companyId", "result");
CREATE INDEX "recruit_aso_records_companyId_examDate_idx" ON "recruit_aso_records"("companyId", "examDate");

ALTER TABLE "recruit_occupational_exam_requests" ADD CONSTRAINT "recruit_occupational_exam_requests_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "recruit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recruit_occupational_exam_requests" ADD CONSTRAINT "recruit_occupational_exam_requests_preAdmissionId_fkey" FOREIGN KEY ("preAdmissionId") REFERENCES "recruit_pre_admissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recruit_occupational_appointments" ADD CONSTRAINT "recruit_occupational_appointments_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "recruit_occupational_exam_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recruit_aso_records" ADD CONSTRAINT "recruit_aso_records_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "recruit_occupational_exam_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
