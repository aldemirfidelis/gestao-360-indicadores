-- CreateEnum
CREATE TYPE "FoodSafetyControlPlanStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "FoodSafetyMonitoringResult" AS ENUM ('OK', 'ALERT', 'OUT');

-- CreateTable
CREATE TABLE "FoodSafetyControlPlan" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "hazardId" TEXT NOT NULL,
    "responsibleUserId" TEXT,
    "controlType" "FoodSafetyControlType" NOT NULL DEFAULT 'CCP',
    "parameter" TEXT,
    "unit" TEXT,
    "criticalLimitText" TEXT,
    "criticalMin" DOUBLE PRECISION,
    "criticalMax" DOUBLE PRECISION,
    "alertMin" DOUBLE PRECISION,
    "alertMax" DOUBLE PRECISION,
    "method" TEXT,
    "instrument" TEXT,
    "frequency" TEXT,
    "correction" TEXT,
    "correctiveAction" TEXT,
    "requiresLotBlock" BOOLEAN NOT NULL DEFAULT false,
    "requiresNonConformity" BOOLEAN NOT NULL DEFAULT true,
    "status" "FoodSafetyControlPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FoodSafetyControlPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodSafetyMonitoringRecord" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "controlPlanId" TEXT NOT NULL,
    "recordedById" TEXT,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valueNum" DOUBLE PRECISION,
    "valueText" TEXT,
    "result" "FoodSafetyMonitoringResult" NOT NULL DEFAULT 'OK',
    "notes" TEXT,
    "evidenceUrl" TEXT,
    "lotBlocked" BOOLEAN NOT NULL DEFAULT false,
    "nonConformityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FoodSafetyMonitoringRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FoodSafetyControlPlan_companyId_idx" ON "FoodSafetyControlPlan"("companyId");

-- CreateIndex
CREATE INDEX "FoodSafetyControlPlan_hazardId_idx" ON "FoodSafetyControlPlan"("hazardId");

-- CreateIndex
CREATE INDEX "FoodSafetyControlPlan_companyId_status_idx" ON "FoodSafetyControlPlan"("companyId", "status");

-- CreateIndex
CREATE INDEX "FoodSafetyMonitoringRecord_companyId_idx" ON "FoodSafetyMonitoringRecord"("companyId");

-- CreateIndex
CREATE INDEX "FoodSafetyMonitoringRecord_controlPlanId_idx" ON "FoodSafetyMonitoringRecord"("controlPlanId");

-- CreateIndex
CREATE INDEX "FoodSafetyMonitoringRecord_result_idx" ON "FoodSafetyMonitoringRecord"("result");

-- AddForeignKey
ALTER TABLE "FoodSafetyControlPlan" ADD CONSTRAINT "FoodSafetyControlPlan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyControlPlan" ADD CONSTRAINT "FoodSafetyControlPlan_hazardId_fkey" FOREIGN KEY ("hazardId") REFERENCES "FoodSafetyHazard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyControlPlan" ADD CONSTRAINT "FoodSafetyControlPlan_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyMonitoringRecord" ADD CONSTRAINT "FoodSafetyMonitoringRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyMonitoringRecord" ADD CONSTRAINT "FoodSafetyMonitoringRecord_controlPlanId_fkey" FOREIGN KEY ("controlPlanId") REFERENCES "FoodSafetyControlPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyMonitoringRecord" ADD CONSTRAINT "FoodSafetyMonitoringRecord_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

