-- Migration: Gestao de Premio (Fase 4 - Motor de Calculo + suportes)
-- Aditiva e reversivel. Cria 4 enums + 7 tabelas (moderadores, ajustes, excecoes,
-- transitoriedade, run/result/line da apuracao). NAO altera tabelas existentes.
-- Rollback: DROP TABLE "PrizeCalculationLine","PrizeCalculationResult","PrizeCalculationRun","PrizeTemporaryAllocation","PrizeException","PrizeManualAdjustment","PrizeModeratorRule" CASCADE;
--   DROP TYPE "PrizeExceptionStatus","PrizeExceptionType","PrizeAdjustmentStatus","PrizeCalcRunStatus";

-- CreateEnum
CREATE TYPE "PrizeCalcRunStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'PARTIAL', 'ERROR', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "PrizeAdjustmentStatus" AS ENUM ('DRAFT', 'REQUESTED', 'IN_ANALYSIS', 'APPROVED', 'REJECTED', 'APPLIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PrizeExceptionType" AS ENUM ('IMPOSSIBILITY', 'TRAINING', 'TERMINATION', 'OTHER');

-- CreateEnum
CREATE TYPE "PrizeExceptionStatus" AS ENUM ('DRAFT', 'REQUESTED', 'APPROVED', 'REJECTED', 'APPLIED');

-- CreateTable
CREATE TABLE "PrizeModeratorRule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "programId" TEXT,
    "name" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "criterion" TEXT,
    "reductionPercent" DECIMAL(9,4),
    "reductionValue" DECIMAL(14,2),
    "cap" DECIMAL(9,4),
    "cumulative" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrizeModeratorRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrizeManualAdjustment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "competenceId" TEXT NOT NULL,
    "registration" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "amount" DECIMAL(14,2),
    "reason" TEXT NOT NULL,
    "evidenceRef" TEXT,
    "status" "PrizeAdjustmentStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedById" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrizeManualAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrizeException" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "competenceId" TEXT NOT NULL,
    "registration" TEXT,
    "type" "PrizeExceptionType" NOT NULL,
    "scope" TEXT,
    "avgMonths" INTEGER DEFAULT 6,
    "gratificationValue" DECIMAL(14,2),
    "reason" TEXT NOT NULL,
    "evidenceRef" TEXT,
    "status" "PrizeExceptionStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedById" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrizeException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrizeTemporaryAllocation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "competenceId" TEXT NOT NULL,
    "registration" TEXT NOT NULL,
    "originArea" TEXT,
    "originPosition" TEXT,
    "destArea" TEXT,
    "destPosition" TEXT,
    "costCenterRef" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "days" INTEGER NOT NULL DEFAULT 0,
    "ruleApplied" TEXT,
    "hasRight" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "evidenceRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REGISTERED',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrizeTemporaryAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrizeCalculationRun" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "competenceId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "PrizeCalcRunStatus" NOT NULL DEFAULT 'PENDING',
    "engineVersion" TEXT NOT NULL,
    "params" JSONB,
    "totalEmployees" INTEGER NOT NULL DEFAULT 0,
    "totalGross" DECIMAL(16,2),
    "totalReductions" DECIMAL(16,2),
    "totalFinal" DECIMAL(16,2),
    "errorsCount" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrizeCalculationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrizeCalculationResult" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "competenceId" TEXT NOT NULL,
    "registration" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseSalary" DECIMAL(14,2),
    "potential" DECIMAL(14,2),
    "weightedGain" DECIMAL(9,4),
    "proportionality" DECIMAL(9,4),
    "grossValue" DECIMAL(14,2),
    "totalReductions" DECIMAL(14,2),
    "adjustments" DECIMAL(14,2),
    "gratification" DECIMAL(14,2),
    "finalValue" DECIMAL(14,2),
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "blockReason" TEXT,
    "exceptionType" TEXT,
    "hash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrizeCalculationResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrizeCalculationLine" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "detail" TEXT,
    "value" DECIMAL(18,4),
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrizeCalculationLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrizeModeratorRule_companyId_idx" ON "PrizeModeratorRule"("companyId");

-- CreateIndex
CREATE INDEX "PrizeModeratorRule_companyId_programId_idx" ON "PrizeModeratorRule"("companyId", "programId");

-- CreateIndex
CREATE INDEX "PrizeModeratorRule_companyId_eventType_idx" ON "PrizeModeratorRule"("companyId", "eventType");

-- CreateIndex
CREATE INDEX "PrizeManualAdjustment_companyId_competenceId_idx" ON "PrizeManualAdjustment"("companyId", "competenceId");

-- CreateIndex
CREATE INDEX "PrizeManualAdjustment_competenceId_registration_idx" ON "PrizeManualAdjustment"("competenceId", "registration");

-- CreateIndex
CREATE INDEX "PrizeManualAdjustment_status_idx" ON "PrizeManualAdjustment"("status");

-- CreateIndex
CREATE INDEX "PrizeException_companyId_competenceId_idx" ON "PrizeException"("companyId", "competenceId");

-- CreateIndex
CREATE INDEX "PrizeException_competenceId_registration_idx" ON "PrizeException"("competenceId", "registration");

-- CreateIndex
CREATE INDEX "PrizeException_status_idx" ON "PrizeException"("status");

-- CreateIndex
CREATE INDEX "PrizeTemporaryAllocation_companyId_competenceId_idx" ON "PrizeTemporaryAllocation"("companyId", "competenceId");

-- CreateIndex
CREATE INDEX "PrizeTemporaryAllocation_competenceId_registration_idx" ON "PrizeTemporaryAllocation"("competenceId", "registration");

-- CreateIndex
CREATE INDEX "PrizeCalculationRun_companyId_idx" ON "PrizeCalculationRun"("companyId");

-- CreateIndex
CREATE INDEX "PrizeCalculationRun_competenceId_idx" ON "PrizeCalculationRun"("competenceId");

-- CreateIndex
CREATE INDEX "PrizeCalculationRun_competenceId_status_idx" ON "PrizeCalculationRun"("competenceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PrizeCalculationRun_competenceId_version_key" ON "PrizeCalculationRun"("competenceId", "version");

-- CreateIndex
CREATE INDEX "PrizeCalculationResult_runId_idx" ON "PrizeCalculationResult"("runId");

-- CreateIndex
CREATE INDEX "PrizeCalculationResult_companyId_competenceId_idx" ON "PrizeCalculationResult"("companyId", "competenceId");

-- CreateIndex
CREATE INDEX "PrizeCalculationResult_competenceId_registration_idx" ON "PrizeCalculationResult"("competenceId", "registration");

-- CreateIndex
CREATE INDEX "PrizeCalculationLine_resultId_idx" ON "PrizeCalculationLine"("resultId");

-- AddForeignKey
ALTER TABLE "PrizeCalculationResult" ADD CONSTRAINT "PrizeCalculationResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PrizeCalculationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeCalculationLine" ADD CONSTRAINT "PrizeCalculationLine_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "PrizeCalculationResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

