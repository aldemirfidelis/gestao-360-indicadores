ALTER TABLE "ActionTask" ADD COLUMN "completionNote" TEXT;

CREATE TABLE "GeneralApprovalRequest" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "requesterId" TEXT,
  "approverId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "reason" TEXT,
  "decisionNote" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GeneralApprovalRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GeneralApprovalRequest_companyId_status_idx" ON "GeneralApprovalRequest"("companyId", "status");
CREATE INDEX "GeneralApprovalRequest_entityType_entityId_idx" ON "GeneralApprovalRequest"("entityType", "entityId");
CREATE INDEX "GeneralApprovalRequest_requesterId_idx" ON "GeneralApprovalRequest"("requesterId");
CREATE INDEX "GeneralApprovalRequest_approverId_idx" ON "GeneralApprovalRequest"("approverId");
