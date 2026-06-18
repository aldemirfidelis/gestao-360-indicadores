-- Catalogo de Areas/Cargos por ID (linkagem deterministica da apuracao).
-- Migracao ADITIVA: cria PrizeOrgRef/PrizeCargoRef e colunas opcionais de ID em
-- PrizeEmployeeSnapshot e PrizeRuleGroup. Nao altera nem remove nada existente.
-- Rollback: DROP TABLE "PrizeOrgRef","PrizeCargoRef"; ALTER TABLE remove as colunas;
--           DROP TYPE "PrizeOrgRefKind".

-- CreateEnum
CREATE TYPE "PrizeOrgRefKind" AS ENUM ('AREA', 'SECTOR');

-- CreateTable
CREATE TABLE "PrizeOrgRef" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedKey" TEXT NOT NULL,
    "kind" "PrizeOrgRefKind" NOT NULL DEFAULT 'AREA',
    "source" TEXT NOT NULL DEFAULT 'IMPORT',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PrizeOrgRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrizeCargoRef" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedKey" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'IMPORT',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PrizeCargoRef_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "PrizeEmployeeSnapshot" ADD COLUMN "areaRefId" TEXT,
ADD COLUMN "sectorRefId" TEXT,
ADD COLUMN "cargoRefId" TEXT;

-- AlterTable
ALTER TABLE "PrizeRuleGroup" ADD COLUMN "areaRefIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "cargoRefIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE UNIQUE INDEX "PrizeOrgRef_companyId_normalizedKey_key" ON "PrizeOrgRef"("companyId", "normalizedKey");

-- CreateIndex
CREATE UNIQUE INDEX "PrizeOrgRef_companyId_code_key" ON "PrizeOrgRef"("companyId", "code");

-- CreateIndex
CREATE INDEX "PrizeOrgRef_companyId_idx" ON "PrizeOrgRef"("companyId");

-- CreateIndex
CREATE INDEX "PrizeOrgRef_companyId_active_idx" ON "PrizeOrgRef"("companyId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "PrizeCargoRef_companyId_normalizedKey_key" ON "PrizeCargoRef"("companyId", "normalizedKey");

-- CreateIndex
CREATE UNIQUE INDEX "PrizeCargoRef_companyId_code_key" ON "PrizeCargoRef"("companyId", "code");

-- CreateIndex
CREATE INDEX "PrizeCargoRef_companyId_idx" ON "PrizeCargoRef"("companyId");

-- CreateIndex
CREATE INDEX "PrizeCargoRef_companyId_active_idx" ON "PrizeCargoRef"("companyId", "active");

-- CreateIndex
CREATE INDEX "PrizeEmployeeSnapshot_companyId_cargoRefId_idx" ON "PrizeEmployeeSnapshot"("companyId", "cargoRefId");

-- CreateIndex
CREATE INDEX "PrizeEmployeeSnapshot_companyId_areaRefId_idx" ON "PrizeEmployeeSnapshot"("companyId", "areaRefId");
