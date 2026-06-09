-- Migration: Gestao de Premio (Fase 2 - Lancamento do Realizado)
-- Aditiva e reversivel. Cria enum PrizeActualStatus + tabelas PrizeActualResult e
-- PrizeActualEvidence. NAO altera tabelas existentes.
-- Rollback: DROP TABLE "PrizeActualEvidence","PrizeActualResult" CASCADE; DROP TYPE "PrizeActualStatus";

-- CreateEnum
CREATE TYPE "PrizeActualStatus" AS ENUM ('NOT_STARTED', 'IN_FILLING', 'PENDING', 'IN_VALIDATION', 'PRE_CLOSE', 'CLOSED', 'REOPENED', 'CORRECTED');

-- CreateTable
CREATE TABLE "PrizeActualResult" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "competenceId" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "parameterId" TEXT,
    "scopeKey" TEXT NOT NULL DEFAULT '',
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL DEFAULT 0,
    "week" INTEGER NOT NULL DEFAULT 0,
    "day" INTEGER NOT NULL DEFAULT 0,
    "realized" DECIMAL(18,4),
    "accumulated" DECIMAL(18,4),
    "source" "PrizeIndicatorSource" NOT NULL DEFAULT 'MANUAL',
    "status" "PrizeActualStatus" NOT NULL DEFAULT 'IN_FILLING',
    "comment" TEXT,
    "justification" TEXT,
    "responsibleUserId" TEXT,
    "createdById" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrizeActualResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrizeActualEvidence" (
    "id" TEXT NOT NULL,
    "actualResultId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT,
    "note" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrizeActualEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrizeActualResult_companyId_idx" ON "PrizeActualResult"("companyId");

-- CreateIndex
CREATE INDEX "PrizeActualResult_competenceId_idx" ON "PrizeActualResult"("competenceId");

-- CreateIndex
CREATE INDEX "PrizeActualResult_indicatorId_idx" ON "PrizeActualResult"("indicatorId");

-- CreateIndex
CREATE INDEX "PrizeActualResult_competenceId_status_idx" ON "PrizeActualResult"("competenceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PrizeActualResult_competenceId_indicatorId_scopeKey_week_da_key" ON "PrizeActualResult"("competenceId", "indicatorId", "scopeKey", "week", "day");

-- CreateIndex
CREATE INDEX "PrizeActualEvidence_actualResultId_idx" ON "PrizeActualEvidence"("actualResultId");

-- AddForeignKey
ALTER TABLE "PrizeActualResult" ADD CONSTRAINT "PrizeActualResult_competenceId_fkey" FOREIGN KEY ("competenceId") REFERENCES "PrizeCompetence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeActualResult" ADD CONSTRAINT "PrizeActualResult_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "PrizeIndicator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeActualEvidence" ADD CONSTRAINT "PrizeActualEvidence_actualResultId_fkey" FOREIGN KEY ("actualResultId") REFERENCES "PrizeActualResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

