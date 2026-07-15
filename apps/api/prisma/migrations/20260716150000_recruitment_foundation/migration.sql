-- Recrutamento e Seleção — Fase 1 (fundação: requisição + openings + aprovações
-- + snapshot versionado). Aditiva. Reusa CompensationPosition/OrgJob/OrgNode.

CREATE TABLE IF NOT EXISTS "recruit_requisitions" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "branchId" TEXT,
  "orgNodeId" TEXT,
  "costCenter" TEXT,
  "positionId" TEXT,
  "orgJobId" TEXT,
  "jobCatalogId" TEXT,
  "openingsRequested" INTEGER NOT NULL DEFAULT 1,
  "requesterId" TEXT NOT NULL,
  "reason" TEXT,
  "vacancyType" TEXT NOT NULL DEFAULT 'AUMENTO',
  "replacedEmployeeId" TEXT,
  "desiredAdmissionAt" TIMESTAMP(3),
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "criticality" TEXT,
  "workMode" TEXT,
  "city" TEXT,
  "location" TEXT,
  "shift" TEXT,
  "schedule" TEXT,
  "contractType" TEXT,
  "salaryMin" DECIMAL(14,2),
  "salaryMax" DECIMAL(14,2),
  "monthlyBudgetCents" INTEGER,
  "confidential" BOOLEAN NOT NULL DEFAULT false,
  "slaDays" INTEGER,
  "recruitmentScope" TEXT NOT NULL DEFAULT 'EXTERNAL',
  "allowsReferral" BOOLEAN NOT NULL DEFAULT true,
  "allowsFormerEmployees" BOOLEAN NOT NULL DEFAULT true,
  "allowsAgency" BOOLEAN NOT NULL DEFAULT false,
  "recruiterId" TEXT,
  "pipelineTemplateId" TEXT,
  "details" JSONB,
  "gateExceptions" JSONB,
  "reservedHeadcount" INTEGER NOT NULL DEFAULT 0,
  "reservedBudgetCents" INTEGER NOT NULL DEFAULT 0,
  "attachments" JSONB,
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "recruit_requisitions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "recruit_requisitions_companyId_code_key" ON "recruit_requisitions"("companyId", "code");
CREATE INDEX IF NOT EXISTS "recruit_requisitions_companyId_status_idx" ON "recruit_requisitions"("companyId", "status");
CREATE INDEX IF NOT EXISTS "recruit_requisitions_companyId_orgNodeId_idx" ON "recruit_requisitions"("companyId", "orgNodeId");
CREATE INDEX IF NOT EXISTS "recruit_requisitions_companyId_positionId_idx" ON "recruit_requisitions"("companyId", "positionId");

CREATE TABLE IF NOT EXISTS "recruit_requisition_openings" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "requisitionId" TEXT NOT NULL,
  "positionId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "filledByEmployeeId" TEXT,
  "filledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recruit_requisition_openings_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "recruit_requisition_openings_companyId_requisitionId_idx" ON "recruit_requisition_openings"("companyId", "requisitionId");
ALTER TABLE "recruit_requisition_openings" ADD CONSTRAINT "recruit_requisition_openings_requisitionId_fkey"
  FOREIGN KEY ("requisitionId") REFERENCES "recruit_requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "recruit_requisition_approvals" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "requisitionId" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "role" TEXT NOT NULL,
  "approverId" TEXT,
  "decision" TEXT,
  "comment" TEXT,
  "decidedAt" TIMESTAMP(3),
  "beforeJson" JSONB,
  "afterJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recruit_requisition_approvals_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "recruit_requisition_approvals_companyId_requisitionId_idx" ON "recruit_requisition_approvals"("companyId", "requisitionId");
ALTER TABLE "recruit_requisition_approvals" ADD CONSTRAINT "recruit_requisition_approvals_requisitionId_fkey"
  FOREIGN KEY ("requisitionId") REFERENCES "recruit_requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "recruit_requisition_snapshots" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "requisitionId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "jobData" JSONB NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recruit_requisition_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "recruit_requisition_snapshots_requisitionId_version_key" ON "recruit_requisition_snapshots"("requisitionId", "version");
ALTER TABLE "recruit_requisition_snapshots" ADD CONSTRAINT "recruit_requisition_snapshots_requisitionId_fkey"
  FOREIGN KEY ("requisitionId") REFERENCES "recruit_requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
