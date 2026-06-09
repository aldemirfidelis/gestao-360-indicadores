-- Migration: Gestao de Premio (Fase 3 - Base Elegivel + Conectores)
-- Aditiva e reversivel. Cria enums PrizeConnectorType, PrizeJobStatus + tabelas
-- PrizeIntegrationConfig, PrizeIntegrationJob, PrizeEmployeeSnapshot, PrizeEmployeeEvent.
-- NAO altera tabelas existentes.
-- Rollback: DROP TABLE "PrizeEmployeeEvent","PrizeEmployeeSnapshot","PrizeIntegrationJob","PrizeIntegrationConfig" CASCADE; DROP TYPE "PrizeJobStatus","PrizeConnectorType";

-- CreateEnum
CREATE TYPE "PrizeConnectorType" AS ENUM ('API', 'FILE_CSV', 'FILE_XLSX', 'DB_BRIDGE', 'MANUAL');

-- CreateEnum
CREATE TYPE "PrizeJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'ERROR', 'PARTIAL');

-- CreateTable
CREATE TABLE "PrizeIntegrationConfig" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PrizeConnectorType" NOT NULL DEFAULT 'MANUAL',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "secretRef" TEXT,
    "schedule" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "processedTotal" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrizeIntegrationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrizeIntegrationJob" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "configId" TEXT,
    "kind" TEXT NOT NULL,
    "competenceId" TEXT,
    "type" "PrizeConnectorType" NOT NULL DEFAULT 'MANUAL',
    "status" "PrizeJobStatus" NOT NULL DEFAULT 'PENDING',
    "processed" INTEGER NOT NULL DEFAULT 0,
    "errorsCount" INTEGER NOT NULL DEFAULT 0,
    "retries" INTEGER NOT NULL DEFAULT 0,
    "lotVersion" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "log" TEXT,
    "summary" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrizeIntegrationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrizeEmployeeSnapshot" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "competenceId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "lotVersion" INTEGER NOT NULL DEFAULT 1,
    "current" BOOLEAN NOT NULL DEFAULT true,
    "registration" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cpfMasked" TEXT,
    "bond" TEXT,
    "branchRef" TEXT,
    "unitRef" TEXT,
    "positionRef" TEXT,
    "functionRef" TEXT,
    "areaRef" TEXT,
    "sectorRef" TEXT,
    "costCenterRef" TEXT,
    "baseSalary" DECIMAL(14,2),
    "admissionDate" TIMESTAMP(3),
    "terminationDate" TIMESTAMP(3),
    "situation" TEXT NOT NULL DEFAULT 'ACTIVE',
    "workedDays" INTEGER,
    "eligible" BOOLEAN NOT NULL DEFAULT true,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "source" "PrizeConnectorType" NOT NULL DEFAULT 'MANUAL',
    "raw" JSONB,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "PrizeEmployeeSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrizeEmployeeEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "competenceId" TEXT NOT NULL,
    "snapshotId" TEXT,
    "registration" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "days" INTEGER,
    "value" DECIMAL(14,2),
    "description" TEXT,
    "source" "PrizeConnectorType" NOT NULL DEFAULT 'MANUAL',
    "raw" JSONB,
    "batchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrizeEmployeeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrizeIntegrationConfig_companyId_idx" ON "PrizeIntegrationConfig"("companyId");

-- CreateIndex
CREATE INDEX "PrizeIntegrationConfig_companyId_kind_idx" ON "PrizeIntegrationConfig"("companyId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "PrizeIntegrationConfig_companyId_kind_name_key" ON "PrizeIntegrationConfig"("companyId", "kind", "name");

-- CreateIndex
CREATE INDEX "PrizeIntegrationJob_companyId_idx" ON "PrizeIntegrationJob"("companyId");

-- CreateIndex
CREATE INDEX "PrizeIntegrationJob_companyId_kind_idx" ON "PrizeIntegrationJob"("companyId", "kind");

-- CreateIndex
CREATE INDEX "PrizeIntegrationJob_competenceId_idx" ON "PrizeIntegrationJob"("competenceId");

-- CreateIndex
CREATE INDEX "PrizeEmployeeSnapshot_companyId_idx" ON "PrizeEmployeeSnapshot"("companyId");

-- CreateIndex
CREATE INDEX "PrizeEmployeeSnapshot_competenceId_idx" ON "PrizeEmployeeSnapshot"("competenceId");

-- CreateIndex
CREATE INDEX "PrizeEmployeeSnapshot_competenceId_current_idx" ON "PrizeEmployeeSnapshot"("competenceId", "current");

-- CreateIndex
CREATE UNIQUE INDEX "PrizeEmployeeSnapshot_competenceId_registration_lotVersion_key" ON "PrizeEmployeeSnapshot"("competenceId", "registration", "lotVersion");

-- CreateIndex
CREATE INDEX "PrizeEmployeeEvent_companyId_idx" ON "PrizeEmployeeEvent"("companyId");

-- CreateIndex
CREATE INDEX "PrizeEmployeeEvent_competenceId_idx" ON "PrizeEmployeeEvent"("competenceId");

-- CreateIndex
CREATE INDEX "PrizeEmployeeEvent_snapshotId_idx" ON "PrizeEmployeeEvent"("snapshotId");

-- CreateIndex
CREATE INDEX "PrizeEmployeeEvent_competenceId_registration_idx" ON "PrizeEmployeeEvent"("competenceId", "registration");

-- AddForeignKey
ALTER TABLE "PrizeIntegrationJob" ADD CONSTRAINT "PrizeIntegrationJob_configId_fkey" FOREIGN KEY ("configId") REFERENCES "PrizeIntegrationConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeEmployeeEvent" ADD CONSTRAINT "PrizeEmployeeEvent_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "PrizeEmployeeSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

