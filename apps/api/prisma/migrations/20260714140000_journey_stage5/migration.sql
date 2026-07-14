-- Etapa 5 da Gestão de Jornada: eventos para a folha (rubricas configuráveis
-- e histórico de exportações). Aditiva.

CREATE TABLE "payroll_rubric_maps" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL,
  "payrollCode" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "unit" TEXT NOT NULL DEFAULT 'HORAS',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payroll_rubric_maps_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payroll_rubric_maps_companyId_eventKey_key" ON "payroll_rubric_maps"("companyId", "eventKey");

CREATE TABLE "payroll_exports" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "periodRef" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "employees" INTEGER NOT NULL,
  "lineCount" INTEGER NOT NULL,
  "totalsJson" JSONB NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payroll_exports_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "payroll_exports_companyId_periodRef_idx" ON "payroll_exports"("companyId", "periodRef");
