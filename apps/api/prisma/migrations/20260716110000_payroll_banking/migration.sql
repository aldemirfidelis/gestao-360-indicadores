-- Folha / Fase 6: pagamento bancário (CNAB 240). Aditiva.
-- Dados bancários no prontuário + conta pagadora da empresa + lote/itens.

ALTER TABLE "personnel_employee_profiles" ADD COLUMN IF NOT EXISTS "bankCode" TEXT;
ALTER TABLE "personnel_employee_profiles" ADD COLUMN IF NOT EXISTS "bankAgency" TEXT;
ALTER TABLE "personnel_employee_profiles" ADD COLUMN IF NOT EXISTS "bankAccount" TEXT;
ALTER TABLE "personnel_employee_profiles" ADD COLUMN IF NOT EXISTS "bankAccountDigit" TEXT;
ALTER TABLE "personnel_employee_profiles" ADD COLUMN IF NOT EXISTS "pixKey" TEXT;
ALTER TABLE "personnel_employee_profiles" ADD COLUMN IF NOT EXISTS "bankUpdatedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "payroll_bank_configs" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "bankCode" TEXT NOT NULL,
  "agency" TEXT NOT NULL,
  "account" TEXT NOT NULL,
  "accountDigit" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payroll_bank_configs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_bank_configs_companyId_key" ON "payroll_bank_configs"("companyId");

CREATE TABLE IF NOT EXISTS "payroll_bank_batches" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "periodRef" TEXT NOT NULL,
  "paymentDate" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "itemCount" INTEGER NOT NULL DEFAULT 0,
  "totalCents" INTEGER NOT NULL DEFAULT 0,
  "antifraud" JSONB,
  "remessaContent" TEXT,
  "remessaHash" TEXT,
  "returnContent" TEXT,
  "createdById" TEXT,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "exportedById" TEXT,
  "exportedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payroll_bank_batches_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "payroll_bank_batches_companyId_runId_idx" ON "payroll_bank_batches"("companyId", "runId");
CREATE INDEX IF NOT EXISTS "payroll_bank_batches_companyId_status_idx" ON "payroll_bank_batches"("companyId", "status");

CREATE TABLE IF NOT EXISTS "payroll_bank_items" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "bankCode" TEXT,
  "agency" TEXT,
  "account" TEXT,
  "accountDigit" TEXT,
  "pixKey" TEXT,
  "netCents" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "returnCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payroll_bank_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "payroll_bank_items_companyId_batchId_idx" ON "payroll_bank_items"("companyId", "batchId");
ALTER TABLE "payroll_bank_items" ADD CONSTRAINT "payroll_bank_items_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "payroll_bank_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
