-- Migration: Gestao de Premio v2 - regras em matriz + apuracao do setor
-- Aditiva e reversivel. Cria catalogo unico, combinacoes area/cargo, parametros
-- e faixas mensais, realizado por catalogo, regua coletiva e nao-casados.
-- Nao remove nem altera dados do modelo v1.
-- Rollback:
--   DROP TABLE "PrizeUnmatchedEmployee","PrizeCellResult","PrizeCatalogActualResult","PrizeRuleAlias","PrizeRuleBand","PrizeRuleParameter","PrizeRuleIndicator","PrizeRuleGroup","PrizeIndicatorCatalog" CASCADE;
--   DROP TYPE "PrizeCellResultStatus","PrizeRuleAliasKind","PrizeRuleValidityKind","PrizeRuleIndicatorType";

-- CreateEnum
CREATE TYPE "PrizeRuleIndicatorType" AS ENUM ('FIXED', 'VARIABLE');

-- CreateEnum
CREATE TYPE "PrizeRuleValidityKind" AS ENUM ('CALENDAR_YEAR', 'CROP_YEAR');

-- CreateEnum
CREATE TYPE "PrizeRuleAliasKind" AS ENUM ('AREA', 'POSITION');

-- CreateEnum
CREATE TYPE "PrizeCellResultStatus" AS ENUM ('CALCULATED', 'PENDING_INPUT', 'BLOCKED');

-- CreateTable
CREATE TABLE "PrizeIndicatorCatalog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "bscNumber" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT,
    "direction" "PrizeIndicatorDirection" NOT NULL DEFAULT 'HIGHER_BETTER',
    "source" "PrizeIndicatorSource" NOT NULL DEFAULT 'MANUAL',
    "platformIndicatorId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PrizeIndicatorCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrizeRuleGroup" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "annexVersionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "areaRefs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "positionRefs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "normalizedAreaKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "normalizedPositionKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "salaryPercent" DECIMAL(9,4) NOT NULL,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PrizeRuleGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrizeRuleIndicator" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,
    "weight" DECIMAL(9,4) NOT NULL,
    "kind" "PrizeIndicatorKind" NOT NULL DEFAULT 'COLLECTIVE',
    "type" "PrizeRuleIndicatorType" NOT NULL DEFAULT 'VARIABLE',
    "validityKind" "PrizeRuleValidityKind" NOT NULL DEFAULT 'CALENDAR_YEAR',
    "startMonth" INTEGER NOT NULL DEFAULT 1,
    "monthsCount" INTEGER NOT NULL DEFAULT 12,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PrizeRuleIndicator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrizeRuleParameter" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ruleIndicatorId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "zero" DECIMAL(18,4),
    "target" DECIMAL(18,4),
    "changeReason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrizeRuleParameter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrizeRuleBand" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "parameterId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "minLimit" DECIMAL(18,4),
    "maxLimit" DECIMAL(18,4),
    "achievementPercent" DECIMAL(9,4),
    "gainPercent" DECIMAL(9,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrizeRuleBand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrizeRuleAlias" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" "PrizeRuleAliasKind" NOT NULL,
    "sourceValue" TEXT NOT NULL,
    "normalizedKey" TEXT NOT NULL,
    "canonicalRef" TEXT,
    "canonicalName" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrizeRuleAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrizeCatalogActualResult" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "competenceId" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "realized" DECIMAL(18,4),
    "accumulated" DECIMAL(18,4),
    "source" "PrizeIndicatorSource" NOT NULL DEFAULT 'MANUAL',
    "status" "PrizeActualStatus" NOT NULL DEFAULT 'IN_FILLING',
    "comment" TEXT,
    "justification" TEXT,
    "responsibleUserId" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrizeCatalogActualResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrizeCellResult" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "competenceId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "annexVersionId" TEXT NOT NULL,
    "areaRef" TEXT NOT NULL,
    "positionRef" TEXT NOT NULL,
    "normalizedAreaKey" TEXT NOT NULL,
    "normalizedPositionKey" TEXT NOT NULL,
    "possibleSalaryPercent" DECIMAL(9,4) NOT NULL,
    "achievedSalaryPercent" DECIMAL(9,4) NOT NULL,
    "weightedGainPercent" DECIMAL(9,4),
    "status" "PrizeCellResultStatus" NOT NULL DEFAULT 'CALCULATED',
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrizeCellResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrizeUnmatchedEmployee" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "competenceId" TEXT NOT NULL,
    "registration" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "areaRef" TEXT,
    "positionRef" TEXT,
    "normalizedAreaKey" TEXT,
    "normalizedPositionKey" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrizeUnmatchedEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PrizeIndicatorCatalog_companyId_code_key" ON "PrizeIndicatorCatalog"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "PrizeIndicatorCatalog_companyId_bscNumber_key" ON "PrizeIndicatorCatalog"("companyId", "bscNumber");

-- CreateIndex
CREATE INDEX "PrizeIndicatorCatalog_companyId_idx" ON "PrizeIndicatorCatalog"("companyId");

-- CreateIndex
CREATE INDEX "PrizeIndicatorCatalog_companyId_active_idx" ON "PrizeIndicatorCatalog"("companyId", "active");

-- CreateIndex
CREATE INDEX "PrizeIndicatorCatalog_platformIndicatorId_idx" ON "PrizeIndicatorCatalog"("platformIndicatorId");

-- CreateIndex
CREATE INDEX "PrizeRuleGroup_companyId_idx" ON "PrizeRuleGroup"("companyId");

-- CreateIndex
CREATE INDEX "PrizeRuleGroup_annexVersionId_idx" ON "PrizeRuleGroup"("annexVersionId");

-- CreateIndex
CREATE INDEX "PrizeRuleGroup_companyId_active_idx" ON "PrizeRuleGroup"("companyId", "active");

-- CreateIndex
CREATE INDEX "PrizeRuleIndicator_companyId_idx" ON "PrizeRuleIndicator"("companyId");

-- CreateIndex
CREATE INDEX "PrizeRuleIndicator_groupId_idx" ON "PrizeRuleIndicator"("groupId");

-- CreateIndex
CREATE INDEX "PrizeRuleIndicator_catalogId_idx" ON "PrizeRuleIndicator"("catalogId");

-- CreateIndex
CREATE INDEX "PrizeRuleIndicator_companyId_active_idx" ON "PrizeRuleIndicator"("companyId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "PrizeRuleParameter_ruleIndicatorId_year_month_key" ON "PrizeRuleParameter"("ruleIndicatorId", "year", "month");

-- CreateIndex
CREATE INDEX "PrizeRuleParameter_companyId_idx" ON "PrizeRuleParameter"("companyId");

-- CreateIndex
CREATE INDEX "PrizeRuleParameter_ruleIndicatorId_idx" ON "PrizeRuleParameter"("ruleIndicatorId");

-- CreateIndex
CREATE INDEX "PrizeRuleParameter_year_month_idx" ON "PrizeRuleParameter"("year", "month");

-- CreateIndex
CREATE INDEX "PrizeRuleBand_companyId_idx" ON "PrizeRuleBand"("companyId");

-- CreateIndex
CREATE INDEX "PrizeRuleBand_parameterId_idx" ON "PrizeRuleBand"("parameterId");

-- CreateIndex
CREATE UNIQUE INDEX "PrizeRuleAlias_companyId_kind_normalizedKey_key" ON "PrizeRuleAlias"("companyId", "kind", "normalizedKey");

-- CreateIndex
CREATE INDEX "PrizeRuleAlias_companyId_idx" ON "PrizeRuleAlias"("companyId");

-- CreateIndex
CREATE INDEX "PrizeRuleAlias_companyId_kind_active_idx" ON "PrizeRuleAlias"("companyId", "kind", "active");

-- CreateIndex
CREATE UNIQUE INDEX "PrizeCatalogActualResult_competenceId_catalogId_key" ON "PrizeCatalogActualResult"("competenceId", "catalogId");

-- CreateIndex
CREATE INDEX "PrizeCatalogActualResult_companyId_idx" ON "PrizeCatalogActualResult"("companyId");

-- CreateIndex
CREATE INDEX "PrizeCatalogActualResult_competenceId_idx" ON "PrizeCatalogActualResult"("competenceId");

-- CreateIndex
CREATE INDEX "PrizeCatalogActualResult_catalogId_idx" ON "PrizeCatalogActualResult"("catalogId");

-- CreateIndex
CREATE INDEX "PrizeCatalogActualResult_competenceId_status_idx" ON "PrizeCatalogActualResult"("competenceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PrizeCellResult_runId_areaRef_positionRef_groupId_key" ON "PrizeCellResult"("runId", "areaRef", "positionRef", "groupId");

-- CreateIndex
CREATE INDEX "PrizeCellResult_companyId_idx" ON "PrizeCellResult"("companyId");

-- CreateIndex
CREATE INDEX "PrizeCellResult_runId_idx" ON "PrizeCellResult"("runId");

-- CreateIndex
CREATE INDEX "PrizeCellResult_competenceId_idx" ON "PrizeCellResult"("competenceId");

-- CreateIndex
CREATE INDEX "PrizeCellResult_normalizedAreaKey_normalizedPositionKey_idx" ON "PrizeCellResult"("normalizedAreaKey", "normalizedPositionKey");

-- CreateIndex
CREATE UNIQUE INDEX "PrizeUnmatchedEmployee_runId_registration_key" ON "PrizeUnmatchedEmployee"("runId", "registration");

-- CreateIndex
CREATE INDEX "PrizeUnmatchedEmployee_companyId_idx" ON "PrizeUnmatchedEmployee"("companyId");

-- CreateIndex
CREATE INDEX "PrizeUnmatchedEmployee_runId_idx" ON "PrizeUnmatchedEmployee"("runId");

-- CreateIndex
CREATE INDEX "PrizeUnmatchedEmployee_competenceId_idx" ON "PrizeUnmatchedEmployee"("competenceId");

-- AddForeignKey
ALTER TABLE "PrizeRuleGroup" ADD CONSTRAINT "PrizeRuleGroup_annexVersionId_fkey" FOREIGN KEY ("annexVersionId") REFERENCES "PrizeAnnexVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeRuleIndicator" ADD CONSTRAINT "PrizeRuleIndicator_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "PrizeRuleGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeRuleIndicator" ADD CONSTRAINT "PrizeRuleIndicator_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "PrizeIndicatorCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeRuleParameter" ADD CONSTRAINT "PrizeRuleParameter_ruleIndicatorId_fkey" FOREIGN KEY ("ruleIndicatorId") REFERENCES "PrizeRuleIndicator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeRuleBand" ADD CONSTRAINT "PrizeRuleBand_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "PrizeRuleParameter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeCatalogActualResult" ADD CONSTRAINT "PrizeCatalogActualResult_competenceId_fkey" FOREIGN KEY ("competenceId") REFERENCES "PrizeCompetence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeCatalogActualResult" ADD CONSTRAINT "PrizeCatalogActualResult_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "PrizeIndicatorCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeCellResult" ADD CONSTRAINT "PrizeCellResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PrizeCalculationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeCellResult" ADD CONSTRAINT "PrizeCellResult_competenceId_fkey" FOREIGN KEY ("competenceId") REFERENCES "PrizeCompetence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeCellResult" ADD CONSTRAINT "PrizeCellResult_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "PrizeRuleGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeUnmatchedEmployee" ADD CONSTRAINT "PrizeUnmatchedEmployee_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PrizeCalculationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
