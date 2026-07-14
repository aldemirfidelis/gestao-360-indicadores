-- Folha de Pagamento - Fase 4: fundacao eSocial + central de certificados.
-- Aditiva. Nao armazena PFX/senha: apenas referencias externas a cofre/env.

CREATE TABLE "payroll_digital_certificates" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "holderName" TEXT,
  "holderCpfCnpj" TEXT,
  "kind" TEXT NOT NULL DEFAULT 'A1',
  "storageMode" TEXT NOT NULL DEFAULT 'EXTERNAL_REF',
  "pfxSecretRef" TEXT,
  "passwordSecretRef" TEXT,
  "serialNumber" TEXT,
  "validFrom" TIMESTAMP(3),
  "validUntil" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "lastTestedAt" TIMESTAMP(3),
  "lastTestStatus" TEXT,
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payroll_digital_certificates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payroll_esocial_batches" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "runId" TEXT,
  "competenceId" TEXT,
  "periodRef" TEXT,
  "certificateId" TEXT,
  "environment" TEXT NOT NULL DEFAULT 'PRODUCTION_RESTRICTED',
  "layoutVersion" TEXT NOT NULL DEFAULT 'S-1.3',
  "status" TEXT NOT NULL DEFAULT 'STAGED_UNSIGNED',
  "eventCount" INTEGER NOT NULL DEFAULT 0,
  "xml" TEXT,
  "xmlHash" TEXT,
  "protocolNumber" TEXT,
  "receiptJson" JSONB,
  "issues" JSONB,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payroll_esocial_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payroll_esocial_events" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "runId" TEXT,
  "runWorkerId" TEXT,
  "employeeId" TEXT,
  "competenceId" TEXT,
  "periodRef" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "environment" TEXT NOT NULL DEFAULT 'PRODUCTION_RESTRICTED',
  "layoutVersion" TEXT NOT NULL DEFAULT 'S-1.3',
  "eventId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'XML_GENERATED',
  "xml" TEXT NOT NULL,
  "xmlHash" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "issues" JSONB,
  "batchId" TEXT,
  "receiptNumber" TEXT,
  "protocolNumber" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payroll_esocial_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payroll_digital_certificates_companyId_status_idx" ON "payroll_digital_certificates"("companyId", "status");
CREATE INDEX "payroll_digital_certificates_companyId_validUntil_idx" ON "payroll_digital_certificates"("companyId", "validUntil");

CREATE INDEX "payroll_esocial_batches_companyId_status_idx" ON "payroll_esocial_batches"("companyId", "status");
CREATE INDEX "payroll_esocial_batches_companyId_runId_idx" ON "payroll_esocial_batches"("companyId", "runId");
CREATE INDEX "payroll_esocial_batches_companyId_periodRef_idx" ON "payroll_esocial_batches"("companyId", "periodRef");

CREATE UNIQUE INDEX "payroll_esocial_events_companyId_eventId_key" ON "payroll_esocial_events"("companyId", "eventId");
CREATE UNIQUE INDEX "payroll_esocial_events_runWorkerId_eventType_environment_key" ON "payroll_esocial_events"("runWorkerId", "eventType", "environment");
CREATE INDEX "payroll_esocial_events_companyId_eventType_status_idx" ON "payroll_esocial_events"("companyId", "eventType", "status");
CREATE INDEX "payroll_esocial_events_companyId_runId_idx" ON "payroll_esocial_events"("companyId", "runId");
CREATE INDEX "payroll_esocial_events_companyId_periodRef_idx" ON "payroll_esocial_events"("companyId", "periodRef");

ALTER TABLE "payroll_esocial_batches"
  ADD CONSTRAINT "payroll_esocial_batches_certificateId_fkey"
  FOREIGN KEY ("certificateId") REFERENCES "payroll_digital_certificates"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payroll_esocial_events"
  ADD CONSTRAINT "payroll_esocial_events_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "payroll_esocial_batches"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
