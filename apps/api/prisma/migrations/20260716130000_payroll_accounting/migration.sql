-- Folha / Fase 6b: contabilização (plano de contas por categoria). Aditiva.

CREATE TABLE IF NOT EXISTS "payroll_accounting_configs" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "accounts" JSONB NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payroll_accounting_configs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_accounting_configs_companyId_key" ON "payroll_accounting_configs"("companyId");
