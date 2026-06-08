-- CreateEnum
CREATE TYPE "FoodSafetyProgramStatus" AS ENUM ('ACTIVE', 'DRAFT', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "FoodSafetyProcessStatus" AS ENUM ('DRAFT', 'IN_ANALYSIS', 'IN_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED', 'OBSOLETE');

-- CreateEnum
CREATE TYPE "FoodSafetyStepType" AS ENUM ('RECEIVING', 'STORAGE', 'PROCESSING', 'PACKAGING', 'TRANSPORT', 'DISTRIBUTION', 'OTHER');

-- CreateTable
CREATE TABLE "FoodSafetyProgram" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "orgNodeId" TEXT,
    "ownerUserId" TEXT,
    "createdById" TEXT,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "status" "FoodSafetyProgramStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FoodSafetyProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodSafetyProcess" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "orgNodeId" TEXT,
    "ownerUserId" TEXT,
    "createdById" TEXT,
    "number" INTEGER NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "objective" TEXT,
    "productName" TEXT,
    "productionLine" TEXT,
    "version" TEXT,
    "status" "FoodSafetyProcessStatus" NOT NULL DEFAULT 'DRAFT',
    "positionX" DOUBLE PRECISION,
    "positionY" DOUBLE PRECISION,
    "lastReviewAt" TIMESTAMP(3),
    "nextReviewAt" TIMESTAMP(3),
    "reviewPeriodicityDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FoodSafetyProcess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodSafetyProcessStep" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "FoodSafetyStepType" NOT NULL DEFAULT 'OTHER',
    "inputs" TEXT,
    "outputs" TEXT,
    "positionX" DOUBLE PRECISION,
    "positionY" DOUBLE PRECISION,
    "isControlPoint" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FoodSafetyProcessStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FoodSafetyProgram_companyId_idx" ON "FoodSafetyProgram"("companyId");

-- CreateIndex
CREATE INDEX "FoodSafetyProgram_companyId_status_idx" ON "FoodSafetyProgram"("companyId", "status");

-- CreateIndex
CREATE INDEX "FoodSafetyProgram_orgNodeId_idx" ON "FoodSafetyProgram"("orgNodeId");

-- CreateIndex
CREATE INDEX "FoodSafetyProgram_ownerUserId_idx" ON "FoodSafetyProgram"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "FoodSafetyProgram_companyId_code_key" ON "FoodSafetyProgram"("companyId", "code");

-- CreateIndex
CREATE INDEX "FoodSafetyProcess_companyId_idx" ON "FoodSafetyProcess"("companyId");

-- CreateIndex
CREATE INDEX "FoodSafetyProcess_companyId_status_idx" ON "FoodSafetyProcess"("companyId", "status");

-- CreateIndex
CREATE INDEX "FoodSafetyProcess_programId_idx" ON "FoodSafetyProcess"("programId");

-- CreateIndex
CREATE INDEX "FoodSafetyProcess_orgNodeId_idx" ON "FoodSafetyProcess"("orgNodeId");

-- CreateIndex
CREATE INDEX "FoodSafetyProcess_ownerUserId_idx" ON "FoodSafetyProcess"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "FoodSafetyProcess_companyId_number_key" ON "FoodSafetyProcess"("companyId", "number");

-- CreateIndex
CREATE INDEX "FoodSafetyProcessStep_companyId_idx" ON "FoodSafetyProcessStep"("companyId");

-- CreateIndex
CREATE INDEX "FoodSafetyProcessStep_processId_idx" ON "FoodSafetyProcessStep"("processId");

-- AddForeignKey
ALTER TABLE "FoodSafetyProgram" ADD CONSTRAINT "FoodSafetyProgram_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyProgram" ADD CONSTRAINT "FoodSafetyProgram_orgNodeId_fkey" FOREIGN KEY ("orgNodeId") REFERENCES "OrgNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyProgram" ADD CONSTRAINT "FoodSafetyProgram_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyProgram" ADD CONSTRAINT "FoodSafetyProgram_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyProcess" ADD CONSTRAINT "FoodSafetyProcess_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyProcess" ADD CONSTRAINT "FoodSafetyProcess_programId_fkey" FOREIGN KEY ("programId") REFERENCES "FoodSafetyProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyProcess" ADD CONSTRAINT "FoodSafetyProcess_orgNodeId_fkey" FOREIGN KEY ("orgNodeId") REFERENCES "OrgNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyProcess" ADD CONSTRAINT "FoodSafetyProcess_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyProcess" ADD CONSTRAINT "FoodSafetyProcess_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyProcessStep" ADD CONSTRAINT "FoodSafetyProcessStep_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyProcessStep" ADD CONSTRAINT "FoodSafetyProcessStep_processId_fkey" FOREIGN KEY ("processId") REFERENCES "FoodSafetyProcess"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

