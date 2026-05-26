-- Career approval workflow: cargo pretendido + solicitacoes de aprovacao
-- Idempotente: pode ter sido aplicado parcialmente via `prisma db push` em dev.

-- 1. Add jobPretendedId to OrgEmployee
ALTER TABLE "OrgEmployee" ADD COLUMN IF NOT EXISTS "jobPretendedId" TEXT;
CREATE INDEX IF NOT EXISTS "OrgEmployee_jobPretendedId_idx" ON "OrgEmployee"("jobPretendedId");
DO $$ BEGIN
    ALTER TABLE "OrgEmployee" ADD CONSTRAINT "OrgEmployee_jobPretendedId_fkey" FOREIGN KEY ("jobPretendedId") REFERENCES "OrgJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Create OrgJobApprovalRequest
CREATE TABLE IF NOT EXISTS "OrgJobApprovalRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "currentJobId" TEXT NOT NULL,
    "targetJobId" TEXT NOT NULL,
    "currentBand" TEXT NOT NULL,
    "targetBand" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "decisionNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgJobApprovalRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OrgJobApprovalRequest_companyId_idx" ON "OrgJobApprovalRequest"("companyId");
CREATE INDEX IF NOT EXISTS "OrgJobApprovalRequest_employeeId_idx" ON "OrgJobApprovalRequest"("employeeId");
CREATE INDEX IF NOT EXISTS "OrgJobApprovalRequest_approverId_idx" ON "OrgJobApprovalRequest"("approverId");
CREATE INDEX IF NOT EXISTS "OrgJobApprovalRequest_requesterId_idx" ON "OrgJobApprovalRequest"("requesterId");
CREATE INDEX IF NOT EXISTS "OrgJobApprovalRequest_status_idx" ON "OrgJobApprovalRequest"("status");

DO $$ BEGIN
    ALTER TABLE "OrgJobApprovalRequest" ADD CONSTRAINT "OrgJobApprovalRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "OrgJobApprovalRequest" ADD CONSTRAINT "OrgJobApprovalRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "OrgEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "OrgJobApprovalRequest" ADD CONSTRAINT "OrgJobApprovalRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "OrgJobApprovalRequest" ADD CONSTRAINT "OrgJobApprovalRequest_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "OrgJobApprovalRequest" ADD CONSTRAINT "OrgJobApprovalRequest_currentJobId_fkey" FOREIGN KEY ("currentJobId") REFERENCES "OrgJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "OrgJobApprovalRequest" ADD CONSTRAINT "OrgJobApprovalRequest_targetJobId_fkey" FOREIGN KEY ("targetJobId") REFERENCES "OrgJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
