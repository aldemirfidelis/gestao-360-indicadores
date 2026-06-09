-- Migration: Gestao de Premio (Fase 1 - Fundacao)
-- Aditiva e reversivel. Cria 8 enums + 10 tabelas do modulo de premio.
-- NAO altera nenhuma tabela existente (verificado: sem DROP/ALTER em tabelas legadas).
-- Tenancy por companyId escalar (mesmo padrao de PlatformCompanyModule).
-- Rollback: DROP TABLE "PrizeAuditLog","PrizeIndicatorRange","PrizeIndicatorParameter",
--   "PrizeIndicator","PrizeAnnexApproval","PrizeAnnexVersion","PrizeAnnex",
--   "PrizeCompetence","PrizeProgramVersion","PrizeProgram" CASCADE;
--   DROP TYPE "PrizeIndicatorSource","PrizeIndicatorDirection","PrizeIndicatorKind",
--   "PrizeApprovalStatus","PrizeAnnexStatus","PrizeCompetenceStatus",
--   "PrizePeriodicity","PrizeProgramStatus";

-- CreateEnum
CREATE TYPE "PrizeProgramStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PrizePeriodicity" AS ENUM ('MONTHLY', 'WEEKLY', 'DAILY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL');

-- CreateEnum
CREATE TYPE "PrizeCompetenceStatus" AS ENUM ('PLANNED', 'OPEN', 'FILLING', 'IN_VALIDATION', 'PRE_CLOSE', 'CLOSED_FOR_CALC', 'IN_CALCULATION', 'IN_REVIEW', 'IN_APPROVAL', 'APPROVED', 'SENT_TO_PAYROLL', 'PAYSLIPS_PUBLISHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "PrizeAnnexStatus" AS ENUM ('DRAFT', 'IN_ELABORATION', 'IN_VALIDATION', 'IN_APPROVAL', 'APPROVED', 'EFFECTIVE', 'SUPERSEDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PrizeApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'RETURNED');

-- CreateEnum
CREATE TYPE "PrizeIndicatorKind" AS ENUM ('COLLECTIVE', 'INDIVIDUAL', 'BEHAVIORAL_COLLECTIVE', 'BEHAVIORAL_INDIVIDUAL');

-- CreateEnum
CREATE TYPE "PrizeIndicatorDirection" AS ENUM ('HIGHER_BETTER', 'LOWER_BETTER', 'TARGET');

-- CreateEnum
CREATE TYPE "PrizeIndicatorSource" AS ENUM ('MANUAL', 'BSC', 'INTERNAL_API', 'FILE_IMPORT', 'AUTO_CALC');

-- CreateTable
CREATE TABLE "PrizeProgram" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "orgNodeId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "programType" TEXT,
    "periodicity" "PrizePeriodicity" NOT NULL DEFAULT 'MONTHLY',
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "status" "PrizeProgramStatus" NOT NULL DEFAULT 'DRAFT',
    "roundingRule" TEXT,
    "closeDay" INTEGER,
    "approvalDeadlineDay" INTEGER,
    "payrollDeadlineDay" INTEGER,
    "defaultRubric" TEXT,
    "ownerUserId" TEXT,
    "approvers" JSONB,
    "eligibility" JSONB,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PrizeProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrizeProgramVersion" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrizeProgramVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrizeCompetence" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "launchDeadline" TIMESTAMP(3),
    "validationDeadline" TIMESTAMP(3),
    "approvalDeadline" TIMESTAMP(3),
    "payrollDate" TIMESTAMP(3),
    "paymentDate" TIMESTAMP(3),
    "status" "PrizeCompetenceStatus" NOT NULL DEFAULT 'PLANNED',
    "responsibles" JSONB,
    "checklist" JSONB,
    "notes" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrizeCompetence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrizeAnnex" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orgNodeId" TEXT,
    "positionRef" TEXT,
    "costCenterRef" TEXT,
    "currentVersionId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PrizeAnnex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrizeAnnexVersion" (
    "id" TEXT NOT NULL,
    "annexId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "PrizeAnnexStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "salaryPercent" DECIMAL(9,4),
    "gainPotential" DECIMAL(14,2),
    "gainChance" DECIMAL(9,4),
    "formula" JSONB,
    "rules" JSONB,
    "criteria" JSONB,
    "changeReason" TEXT,
    "createdById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "supersededByVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrizeAnnexVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrizeAnnexApproval" (
    "id" TEXT NOT NULL,
    "annexVersionId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL DEFAULT 1,
    "approverUserId" TEXT,
    "approverRole" TEXT,
    "status" "PrizeApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrizeAnnexApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrizeIndicator" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "annexVersionId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT,
    "kind" "PrizeIndicatorKind" NOT NULL DEFAULT 'COLLECTIVE',
    "direction" "PrizeIndicatorDirection" NOT NULL DEFAULT 'HIGHER_BETTER',
    "source" "PrizeIndicatorSource" NOT NULL DEFAULT 'MANUAL',
    "bscNumber" TEXT,
    "weight" DECIMAL(9,4),
    "formula" TEXT,
    "roundingRule" TEXT,
    "orgNodeId" TEXT,
    "positionRef" TEXT,
    "costCenterRef" TEXT,
    "periodicity" "PrizePeriodicity" NOT NULL DEFAULT 'MONTHLY',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PrizeIndicator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrizeIndicatorParameter" (
    "id" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "competenceId" TEXT,
    "year" INTEGER,
    "month" INTEGER,
    "week" INTEGER,
    "day" INTEGER,
    "scopeKey" TEXT,
    "target" DECIMAL(18,4),
    "zero" DECIMAL(18,4),
    "weight" DECIMAL(9,4),
    "changeReason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrizeIndicatorParameter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrizeIndicatorRange" (
    "id" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "parameterId" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "minLimit" DECIMAL(18,4),
    "maxLimit" DECIMAL(18,4),
    "achievementPercent" DECIMAL(9,4),
    "gainPercent" DECIMAL(9,4),
    "weight" DECIMAL(9,4),
    "behaviorAbove" TEXT,
    "behaviorBelow" TEXT,
    "cap" DECIMAL(9,4),
    "floor" DECIMAL(9,4),
    "cumulative" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrizeIndicatorRange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrizeAuditLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "competenceId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "justification" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrizeAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrizeProgram_companyId_idx" ON "PrizeProgram"("companyId");

-- CreateIndex
CREATE INDEX "PrizeProgram_companyId_status_idx" ON "PrizeProgram"("companyId", "status");

-- CreateIndex
CREATE INDEX "PrizeProgram_orgNodeId_idx" ON "PrizeProgram"("orgNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "PrizeProgram_companyId_code_key" ON "PrizeProgram"("companyId", "code");

-- CreateIndex
CREATE INDEX "PrizeProgramVersion_programId_idx" ON "PrizeProgramVersion"("programId");

-- CreateIndex
CREATE UNIQUE INDEX "PrizeProgramVersion_programId_version_key" ON "PrizeProgramVersion"("programId", "version");

-- CreateIndex
CREATE INDEX "PrizeCompetence_companyId_idx" ON "PrizeCompetence"("companyId");

-- CreateIndex
CREATE INDEX "PrizeCompetence_companyId_status_idx" ON "PrizeCompetence"("companyId", "status");

-- CreateIndex
CREATE INDEX "PrizeCompetence_programId_year_month_idx" ON "PrizeCompetence"("programId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "PrizeCompetence_programId_year_month_key" ON "PrizeCompetence"("programId", "year", "month");

-- CreateIndex
CREATE INDEX "PrizeAnnex_companyId_idx" ON "PrizeAnnex"("companyId");

-- CreateIndex
CREATE INDEX "PrizeAnnex_programId_idx" ON "PrizeAnnex"("programId");

-- CreateIndex
CREATE INDEX "PrizeAnnex_orgNodeId_idx" ON "PrizeAnnex"("orgNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "PrizeAnnex_companyId_code_key" ON "PrizeAnnex"("companyId", "code");

-- CreateIndex
CREATE INDEX "PrizeAnnexVersion_annexId_idx" ON "PrizeAnnexVersion"("annexId");

-- CreateIndex
CREATE INDEX "PrizeAnnexVersion_status_idx" ON "PrizeAnnexVersion"("status");

-- CreateIndex
CREATE INDEX "PrizeAnnexVersion_annexId_status_idx" ON "PrizeAnnexVersion"("annexId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PrizeAnnexVersion_annexId_version_key" ON "PrizeAnnexVersion"("annexId", "version");

-- CreateIndex
CREATE INDEX "PrizeAnnexApproval_annexVersionId_idx" ON "PrizeAnnexApproval"("annexVersionId");

-- CreateIndex
CREATE INDEX "PrizeAnnexApproval_status_idx" ON "PrizeAnnexApproval"("status");

-- CreateIndex
CREATE INDEX "PrizeIndicator_companyId_idx" ON "PrizeIndicator"("companyId");

-- CreateIndex
CREATE INDEX "PrizeIndicator_programId_idx" ON "PrizeIndicator"("programId");

-- CreateIndex
CREATE INDEX "PrizeIndicator_annexVersionId_idx" ON "PrizeIndicator"("annexVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "PrizeIndicator_programId_code_key" ON "PrizeIndicator"("programId", "code");

-- CreateIndex
CREATE INDEX "PrizeIndicatorParameter_indicatorId_idx" ON "PrizeIndicatorParameter"("indicatorId");

-- CreateIndex
CREATE INDEX "PrizeIndicatorParameter_competenceId_idx" ON "PrizeIndicatorParameter"("competenceId");

-- CreateIndex
CREATE INDEX "PrizeIndicatorParameter_indicatorId_year_month_idx" ON "PrizeIndicatorParameter"("indicatorId", "year", "month");

-- CreateIndex
CREATE INDEX "PrizeIndicatorRange_indicatorId_idx" ON "PrizeIndicatorRange"("indicatorId");

-- CreateIndex
CREATE INDEX "PrizeIndicatorRange_parameterId_idx" ON "PrizeIndicatorRange"("parameterId");

-- CreateIndex
CREATE INDEX "PrizeAuditLog_companyId_entityType_entityId_idx" ON "PrizeAuditLog"("companyId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "PrizeAuditLog_companyId_createdAt_idx" ON "PrizeAuditLog"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "PrizeAuditLog_competenceId_idx" ON "PrizeAuditLog"("competenceId");

-- AddForeignKey
ALTER TABLE "PrizeProgramVersion" ADD CONSTRAINT "PrizeProgramVersion_programId_fkey" FOREIGN KEY ("programId") REFERENCES "PrizeProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeCompetence" ADD CONSTRAINT "PrizeCompetence_programId_fkey" FOREIGN KEY ("programId") REFERENCES "PrizeProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeAnnex" ADD CONSTRAINT "PrizeAnnex_programId_fkey" FOREIGN KEY ("programId") REFERENCES "PrizeProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeAnnexVersion" ADD CONSTRAINT "PrizeAnnexVersion_annexId_fkey" FOREIGN KEY ("annexId") REFERENCES "PrizeAnnex"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeAnnexApproval" ADD CONSTRAINT "PrizeAnnexApproval_annexVersionId_fkey" FOREIGN KEY ("annexVersionId") REFERENCES "PrizeAnnexVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeIndicator" ADD CONSTRAINT "PrizeIndicator_programId_fkey" FOREIGN KEY ("programId") REFERENCES "PrizeProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeIndicator" ADD CONSTRAINT "PrizeIndicator_annexVersionId_fkey" FOREIGN KEY ("annexVersionId") REFERENCES "PrizeAnnexVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeIndicatorParameter" ADD CONSTRAINT "PrizeIndicatorParameter_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "PrizeIndicator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeIndicatorParameter" ADD CONSTRAINT "PrizeIndicatorParameter_competenceId_fkey" FOREIGN KEY ("competenceId") REFERENCES "PrizeCompetence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeIndicatorRange" ADD CONSTRAINT "PrizeIndicatorRange_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "PrizeIndicator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeIndicatorRange" ADD CONSTRAINT "PrizeIndicatorRange_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "PrizeIndicatorParameter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

