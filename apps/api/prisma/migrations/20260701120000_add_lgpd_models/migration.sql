-- LGPD: RoPA (DataProcessingRecord), suboperadores (Subprocessor) e incidentes de dados (DataIncident).
-- Migracao aditiva (apenas novas tabelas). NAO aplicada automaticamente em producao.

-- CreateTable
CREATE TABLE "DataProcessingRecord" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "area" TEXT,
    "purpose" TEXT NOT NULL,
    "legalBasis" TEXT NOT NULL,
    "dataSubjects" TEXT[],
    "dataCategories" TEXT[],
    "hasSensitiveData" BOOLEAN NOT NULL DEFAULT false,
    "sharedWith" TEXT[],
    "retentionPeriod" TEXT,
    "securityMeasures" TEXT,
    "internationalTransfer" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DataProcessingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subprocessor" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "country" TEXT,
    "internationalTransfer" BOOLEAN NOT NULL DEFAULT false,
    "transferSafeguard" TEXT,
    "contractRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Subprocessor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataIncident" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "affectedData" TEXT[],
    "affectedSubjects" INTEGER,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "containedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "anpdNotified" BOOLEAN NOT NULL DEFAULT false,
    "anpdNotifiedAt" TIMESTAMP(3),
    "subjectsNotified" BOOLEAN NOT NULL DEFAULT false,
    "subjectsNotifiedAt" TIMESTAMP(3),
    "measures" TEXT,
    "responsibleUserId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DataIncident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DataProcessingRecord_companyId_idx" ON "DataProcessingRecord"("companyId");

-- CreateIndex
CREATE INDEX "DataProcessingRecord_companyId_status_idx" ON "DataProcessingRecord"("companyId", "status");

-- CreateIndex
CREATE INDEX "DataProcessingRecord_companyId_deletedAt_idx" ON "DataProcessingRecord"("companyId", "deletedAt");

-- CreateIndex
CREATE INDEX "Subprocessor_companyId_idx" ON "Subprocessor"("companyId");

-- CreateIndex
CREATE INDEX "Subprocessor_companyId_status_idx" ON "Subprocessor"("companyId", "status");

-- CreateIndex
CREATE INDEX "Subprocessor_companyId_deletedAt_idx" ON "Subprocessor"("companyId", "deletedAt");

-- CreateIndex
CREATE INDEX "DataIncident_companyId_idx" ON "DataIncident"("companyId");

-- CreateIndex
CREATE INDEX "DataIncident_companyId_status_idx" ON "DataIncident"("companyId", "status");

-- CreateIndex
CREATE INDEX "DataIncident_companyId_severity_idx" ON "DataIncident"("companyId", "severity");

-- CreateIndex
CREATE INDEX "DataIncident_companyId_deletedAt_idx" ON "DataIncident"("companyId", "deletedAt");

-- AddForeignKey
ALTER TABLE "DataProcessingRecord" ADD CONSTRAINT "DataProcessingRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subprocessor" ADD CONSTRAINT "Subprocessor_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataIncident" ADD CONSTRAINT "DataIncident_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

