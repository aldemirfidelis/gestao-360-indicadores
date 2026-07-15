-- Folha / Fase 5: obrigações trabalhistas assistidas (FGTS Digital, DCTFWeb,
-- EFD-Reinf, Qualificação Cadastral, DET). Aditiva.

CREATE TABLE IF NOT EXISTS "payroll_obligations" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "periodRef" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "dueDate" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "amountCents" INTEGER,
  "protocol" TEXT,
  "officialUrl" TEXT,
  "checklist" JSONB,
  "attachments" JSONB,
  "resultJson" JSONB,
  "notes" TEXT,
  "responsibleId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payroll_obligations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_obligations_companyId_kind_periodRef_key" ON "payroll_obligations"("companyId", "kind", "periodRef");
CREATE INDEX IF NOT EXISTS "payroll_obligations_companyId_periodRef_idx" ON "payroll_obligations"("companyId", "periodRef");
CREATE INDEX IF NOT EXISTS "payroll_obligations_companyId_status_idx" ON "payroll_obligations"("companyId", "status");
