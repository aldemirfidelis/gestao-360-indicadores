-- Migration: Gestao de Premio (Fase 5 - Integracao com a Folha)
-- Aditiva e reversivel. Cria 2 enums + 2 tabelas (PrizePayrollBatch, PrizePayrollBatchItem).
-- Rollback: DROP TABLE "PrizePayrollBatchItem","PrizePayrollBatch" CASCADE; DROP TYPE "PrizePayrollItemStatus","PrizePayrollBatchStatus";

-- CreateEnum
CREATE TYPE "PrizePayrollBatchStatus" AS ENUM ('DRAFT', 'GENERATED', 'SENT', 'RETURNED', 'RECONCILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PrizePayrollItemStatus" AS ENUM ('PENDING', 'SENT', 'ACCEPTED', 'REJECTED', 'BLOCKED');

-- CreateTable
CREATE TABLE "PrizePayrollBatch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "competenceId" TEXT NOT NULL,
    "runId" TEXT,
    "code" TEXT NOT NULL,
    "rubric" TEXT,
    "status" "PrizePayrollBatchStatus" NOT NULL DEFAULT 'GENERATED',
    "protocol" TEXT,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "totalValue" DECIMAL(16,2),
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "generatedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrizePayrollBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrizePayrollBatchItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "registration" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rubric" TEXT,
    "value" DECIMAL(14,2) NOT NULL,
    "status" "PrizePayrollItemStatus" NOT NULL DEFAULT 'PENDING',
    "blockReason" TEXT,
    "calcResultId" TEXT,
    "returnCode" TEXT,
    "returnMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrizePayrollBatchItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrizePayrollBatch_companyId_idx" ON "PrizePayrollBatch"("companyId");

-- CreateIndex
CREATE INDEX "PrizePayrollBatch_companyId_competenceId_idx" ON "PrizePayrollBatch"("companyId", "competenceId");

-- CreateIndex
CREATE INDEX "PrizePayrollBatch_status_idx" ON "PrizePayrollBatch"("status");

-- CreateIndex
CREATE INDEX "PrizePayrollBatchItem_batchId_idx" ON "PrizePayrollBatchItem"("batchId");

-- CreateIndex
CREATE INDEX "PrizePayrollBatchItem_batchId_status_idx" ON "PrizePayrollBatchItem"("batchId", "status");

-- AddForeignKey
ALTER TABLE "PrizePayrollBatchItem" ADD CONSTRAINT "PrizePayrollBatchItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PrizePayrollBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

