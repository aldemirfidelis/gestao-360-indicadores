-- Migration: Gestao de Premio (Fase 6 - Espelho do Premio)
-- Aditiva e reversivel. Cria enum PrizePayslipStatus + tabela PrizePayslip.
-- Rollback: DROP TABLE "PrizePayslip" CASCADE; DROP TYPE "PrizePayslipStatus";

-- CreateEnum
CREATE TYPE "PrizePayslipStatus" AS ENUM ('DRAFT', 'GENERATED', 'PUBLISHED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "PrizePayslip" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "competenceId" TEXT NOT NULL,
    "calcRunId" TEXT,
    "calcResultId" TEXT,
    "registration" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "PrizePayslipStatus" NOT NULL DEFAULT 'GENERATED',
    "data" JSONB NOT NULL,
    "finalValue" DECIMAL(14,2),
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedById" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrizePayslip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrizePayslip_companyId_competenceId_idx" ON "PrizePayslip"("companyId", "competenceId");

-- CreateIndex
CREATE INDEX "PrizePayslip_competenceId_registration_idx" ON "PrizePayslip"("competenceId", "registration");

-- CreateIndex
CREATE INDEX "PrizePayslip_status_idx" ON "PrizePayslip"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PrizePayslip_competenceId_registration_version_key" ON "PrizePayslip"("competenceId", "registration", "version");

