-- CreateEnum
CREATE TYPE "FoodSafetyHazardCategory" AS ENUM ('BIOLOGICAL', 'CHEMICAL', 'PHYSICAL', 'ALLERGENIC', 'RADIOLOGICAL', 'FRAUD', 'SABOTAGE', 'CROSS_CONTAMINATION', 'OTHER');

-- CreateEnum
CREATE TYPE "FoodSafetyRiskLevel" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "FoodSafetyControlType" AS ENUM ('NONE', 'PRP', 'OPRP', 'CCP');

-- CreateEnum
CREATE TYPE "FoodSafetyHazardStatus" AS ENUM ('OPEN', 'ASSESSED', 'CONTROLLED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "FoodSafetyRiskMatrix" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Matriz padrao',
    "severityScale" INTEGER NOT NULL DEFAULT 5,
    "probabilityScale" INTEGER NOT NULL DEFAULT 5,
    "useDetection" BOOLEAN NOT NULL DEFAULT false,
    "detectionScale" INTEGER NOT NULL DEFAULT 5,
    "thresholdLow" INTEGER NOT NULL DEFAULT 4,
    "thresholdModerate" INTEGER NOT NULL DEFAULT 9,
    "thresholdHigh" INTEGER NOT NULL DEFAULT 15,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FoodSafetyRiskMatrix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodSafetyHazard" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "stepId" TEXT,
    "responsibleUserId" TEXT,
    "number" INTEGER NOT NULL,
    "code" TEXT,
    "category" "FoodSafetyHazardCategory" NOT NULL DEFAULT 'BIOLOGICAL',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "source" TEXT,
    "consequence" TEXT,
    "justification" TEXT,
    "severity" INTEGER,
    "probability" INTEGER,
    "detection" INTEGER,
    "riskIndex" INTEGER,
    "riskLevel" "FoodSafetyRiskLevel",
    "controlType" "FoodSafetyControlType" NOT NULL DEFAULT 'NONE',
    "controlJustification" TEXT,
    "existingControls" TEXT,
    "additionalControls" TEXT,
    "status" "FoodSafetyHazardStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FoodSafetyHazard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FoodSafetyRiskMatrix_companyId_idx" ON "FoodSafetyRiskMatrix"("companyId");

-- CreateIndex
CREATE INDEX "FoodSafetyHazard_companyId_idx" ON "FoodSafetyHazard"("companyId");

-- CreateIndex
CREATE INDEX "FoodSafetyHazard_processId_idx" ON "FoodSafetyHazard"("processId");

-- CreateIndex
CREATE INDEX "FoodSafetyHazard_stepId_idx" ON "FoodSafetyHazard"("stepId");

-- CreateIndex
CREATE INDEX "FoodSafetyHazard_category_idx" ON "FoodSafetyHazard"("category");

-- CreateIndex
CREATE INDEX "FoodSafetyHazard_controlType_idx" ON "FoodSafetyHazard"("controlType");

-- CreateIndex
CREATE UNIQUE INDEX "FoodSafetyHazard_companyId_number_key" ON "FoodSafetyHazard"("companyId", "number");

-- AddForeignKey
ALTER TABLE "FoodSafetyRiskMatrix" ADD CONSTRAINT "FoodSafetyRiskMatrix_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyHazard" ADD CONSTRAINT "FoodSafetyHazard_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyHazard" ADD CONSTRAINT "FoodSafetyHazard_processId_fkey" FOREIGN KEY ("processId") REFERENCES "FoodSafetyProcess"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyHazard" ADD CONSTRAINT "FoodSafetyHazard_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "FoodSafetyProcessStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyHazard" ADD CONSTRAINT "FoodSafetyHazard_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

