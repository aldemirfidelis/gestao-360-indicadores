-- CreateEnum
CREATE TYPE "RiskCategory" AS ENUM ('STRATEGIC', 'OPERATIONAL', 'FINANCIAL', 'COMPLIANCE', 'SAFETY', 'ENVIRONMENTAL', 'QUALITY', 'PROJECT', 'PROCESS', 'OTHER');

-- CreateEnum
CREATE TYPE "RiskStatus" AS ENUM ('IDENTIFIED', 'ANALYZING', 'MITIGATING', 'MONITORING', 'ACCEPTED', 'CLOSED');

-- AlterEnum
ALTER TYPE "TraceEntityType" ADD VALUE 'RISK';

-- CreateTable
CREATE TABLE "RiskRegister" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "orgNodeId" TEXT,
    "indicatorId" TEXT,
    "projectId" TEXT,
    "mitigationActionId" TEXT,
    "responsibleUserId" TEXT,
    "createdById" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "RiskCategory" NOT NULL DEFAULT 'OPERATIONAL',
    "status" "RiskStatus" NOT NULL DEFAULT 'IDENTIFIED',
    "probability" INTEGER NOT NULL DEFAULT 3,
    "impact" INTEGER NOT NULL DEFAULT 3,
    "mitigationPlan" TEXT,
    "contingencyPlan" TEXT,
    "dueDate" TIMESTAMP(3),
    "identifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "RiskRegister_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RiskRegister_companyId_idx" ON "RiskRegister"("companyId");

-- CreateIndex
CREATE INDEX "RiskRegister_companyId_status_idx" ON "RiskRegister"("companyId", "status");

-- CreateIndex
CREATE INDEX "RiskRegister_category_idx" ON "RiskRegister"("category");

-- CreateIndex
CREATE INDEX "RiskRegister_orgNodeId_idx" ON "RiskRegister"("orgNodeId");

-- CreateIndex
CREATE INDEX "RiskRegister_indicatorId_idx" ON "RiskRegister"("indicatorId");

-- CreateIndex
CREATE INDEX "RiskRegister_projectId_idx" ON "RiskRegister"("projectId");

-- CreateIndex
CREATE INDEX "RiskRegister_mitigationActionId_idx" ON "RiskRegister"("mitigationActionId");

-- CreateIndex
CREATE INDEX "RiskRegister_responsibleUserId_idx" ON "RiskRegister"("responsibleUserId");

-- CreateIndex
CREATE INDEX "RiskRegister_dueDate_idx" ON "RiskRegister"("dueDate");

-- AddForeignKey
ALTER TABLE "RiskRegister" ADD CONSTRAINT "RiskRegister_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskRegister" ADD CONSTRAINT "RiskRegister_orgNodeId_fkey" FOREIGN KEY ("orgNodeId") REFERENCES "OrgNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskRegister" ADD CONSTRAINT "RiskRegister_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "Indicator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskRegister" ADD CONSTRAINT "RiskRegister_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskRegister" ADD CONSTRAINT "RiskRegister_mitigationActionId_fkey" FOREIGN KEY ("mitigationActionId") REFERENCES "ActionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskRegister" ADD CONSTRAINT "RiskRegister_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskRegister" ADD CONSTRAINT "RiskRegister_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
