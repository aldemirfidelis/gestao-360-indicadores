-- CreateEnum
CREATE TYPE "NonConformityStatus" AS ENUM ('OPEN', 'TRIAGE', 'ANALYSIS', 'ACTION', 'VERIFICATION', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NonConformitySource" AS ENUM ('INDICATOR', 'AUDIT', 'PROCESS', 'CUSTOMER', 'SUPPLIER', 'PROJECT', 'CHECKLIST', 'INSPECTION', 'DOCUMENT', 'MANUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "NonConformitySeverity" AS ENUM ('MINOR', 'MAJOR', 'CRITICAL');

-- AlterEnum
ALTER TYPE "TraceEntityType" ADD VALUE 'NON_CONFORMITY';

-- CreateTable
CREATE TABLE "NonConformity" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "orgNodeId" TEXT,
    "indicatorId" TEXT,
    "deviationId" TEXT,
    "correctiveActionId" TEXT,
    "responsibleUserId" TEXT,
    "createdById" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "source" "NonConformitySource" NOT NULL DEFAULT 'INDICATOR',
    "severity" "NonConformitySeverity" NOT NULL DEFAULT 'MAJOR',
    "status" "NonConformityStatus" NOT NULL DEFAULT 'OPEN',
    "immediateAction" TEXT,
    "rootCause" TEXT,
    "correctivePlan" TEXT,
    "effectivenessCheck" TEXT,
    "effectivenessOk" BOOLEAN,
    "dueDate" TIMESTAMP(3),
    "identifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "NonConformity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NonConformity_companyId_idx" ON "NonConformity"("companyId");

-- CreateIndex
CREATE INDEX "NonConformity_companyId_status_idx" ON "NonConformity"("companyId", "status");

-- CreateIndex
CREATE INDEX "NonConformity_source_idx" ON "NonConformity"("source");

-- CreateIndex
CREATE INDEX "NonConformity_orgNodeId_idx" ON "NonConformity"("orgNodeId");

-- CreateIndex
CREATE INDEX "NonConformity_indicatorId_idx" ON "NonConformity"("indicatorId");

-- CreateIndex
CREATE INDEX "NonConformity_deviationId_idx" ON "NonConformity"("deviationId");

-- CreateIndex
CREATE INDEX "NonConformity_correctiveActionId_idx" ON "NonConformity"("correctiveActionId");

-- CreateIndex
CREATE INDEX "NonConformity_responsibleUserId_idx" ON "NonConformity"("responsibleUserId");

-- CreateIndex
CREATE INDEX "NonConformity_dueDate_idx" ON "NonConformity"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "NonConformity_companyId_number_key" ON "NonConformity"("companyId", "number");

-- AddForeignKey
ALTER TABLE "NonConformity" ADD CONSTRAINT "NonConformity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NonConformity" ADD CONSTRAINT "NonConformity_orgNodeId_fkey" FOREIGN KEY ("orgNodeId") REFERENCES "OrgNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NonConformity" ADD CONSTRAINT "NonConformity_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "Indicator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NonConformity" ADD CONSTRAINT "NonConformity_deviationId_fkey" FOREIGN KEY ("deviationId") REFERENCES "Deviation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NonConformity" ADD CONSTRAINT "NonConformity_correctiveActionId_fkey" FOREIGN KEY ("correctiveActionId") REFERENCES "ActionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NonConformity" ADD CONSTRAINT "NonConformity_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NonConformity" ADD CONSTRAINT "NonConformity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

