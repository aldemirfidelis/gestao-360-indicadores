-- CreateEnum
CREATE TYPE "ProcessType" AS ENUM ('CORE', 'SUPPORT', 'MANAGEMENT');

-- CreateEnum
CREATE TYPE "ProcessStatus" AS ENUM ('DRAFT', 'ACTIVE', 'UNDER_REVIEW', 'ARCHIVED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TraceEntityType" ADD VALUE 'PROCESS';
ALTER TYPE "TraceEntityType" ADD VALUE 'PROCESS_STEP';

-- CreateTable
CREATE TABLE "Process" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "code" TEXT,
    "orgNodeId" TEXT,
    "indicatorId" TEXT,
    "ownerUserId" TEXT,
    "createdById" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "objective" TEXT,
    "type" "ProcessType" NOT NULL DEFAULT 'CORE',
    "status" "ProcessStatus" NOT NULL DEFAULT 'DRAFT',
    "version" TEXT,
    "suppliers" TEXT,
    "inputs" TEXT,
    "outputs" TEXT,
    "customers" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Process_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessStep" (
    "id" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "responsible" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Process_companyId_idx" ON "Process"("companyId");

-- CreateIndex
CREATE INDEX "Process_companyId_status_idx" ON "Process"("companyId", "status");

-- CreateIndex
CREATE INDEX "Process_type_idx" ON "Process"("type");

-- CreateIndex
CREATE INDEX "Process_orgNodeId_idx" ON "Process"("orgNodeId");

-- CreateIndex
CREATE INDEX "Process_indicatorId_idx" ON "Process"("indicatorId");

-- CreateIndex
CREATE INDEX "Process_ownerUserId_idx" ON "Process"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Process_companyId_number_key" ON "Process"("companyId", "number");

-- CreateIndex
CREATE INDEX "ProcessStep_processId_idx" ON "ProcessStep"("processId");

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "Process_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "Process_orgNodeId_fkey" FOREIGN KEY ("orgNodeId") REFERENCES "OrgNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "Process_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "Indicator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "Process_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "Process_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessStep" ADD CONSTRAINT "ProcessStep_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE CASCADE ON UPDATE CASCADE;

