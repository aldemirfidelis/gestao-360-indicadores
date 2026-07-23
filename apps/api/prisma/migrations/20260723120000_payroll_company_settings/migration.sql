-- Parâmetros da folha por empresa (modelo SaaS): DSR sobre variáveis opcional
-- + registro da conferência das tabelas legais pela contabilidade da empresa.
CREATE TABLE IF NOT EXISTS "payroll_company_settings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "dsrOnVariables" BOOLEAN NOT NULL DEFAULT false,
    "legalTablesConfirmedAt" TIMESTAMP(3),
    "legalTablesConfirmedById" TEXT,
    "legalTablesConfirmNote" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_company_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payroll_company_settings_companyId_key" ON "payroll_company_settings"("companyId");
