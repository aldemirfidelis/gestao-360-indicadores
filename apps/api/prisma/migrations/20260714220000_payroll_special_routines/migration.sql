-- Folha de Pagamento — Fase 3 (rotinas especiais: férias, 13º, rescisão,
-- benefícios, consignados, pensões) + adiantamento (Fase 2). Aditiva.
-- Reconstrói em migração versionada as tabelas que estavam só no schema/dev
-- (haviam sido aplicadas no dev via db push, sem SQL versionado).

ALTER TABLE "payroll_worker_settings" ADD COLUMN IF NOT EXISTS "advancePercentage" INTEGER NOT NULL DEFAULT 40;

CREATE TABLE IF NOT EXISTS "payroll_vacation_periods" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "startAquisition" TIMESTAMP(3) NOT NULL,
  "endAquisition" TIMESTAMP(3) NOT NULL,
  "concessionLimit" TIMESTAMP(3) NOT NULL,
  "totalDays" INTEGER NOT NULL DEFAULT 30,
  "takenDays" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'ACQUIRING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payroll_vacation_periods_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "payroll_vacation_periods_companyId_employeeId_idx" ON "payroll_vacation_periods"("companyId", "employeeId");

CREATE TABLE IF NOT EXISTS "payroll_vacation_requests" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "vacationPeriodId" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "takenDays" INTEGER NOT NULL,
  "sellDays" INTEGER NOT NULL DEFAULT 0,
  "advanceThirteenth" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "calculatedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payroll_vacation_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "payroll_vacation_requests_companyId_vacationPeriodId_idx" ON "payroll_vacation_requests"("companyId", "vacationPeriodId");

CREATE TABLE IF NOT EXISTS "payroll_terminations" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "terminationDate" TIMESTAMP(3) NOT NULL,
  "kind" TEXT NOT NULL,
  "noticeType" TEXT NOT NULL,
  "noticeDays" INTEGER NOT NULL DEFAULT 30,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "resultsJson" JSONB,
  "calculatedById" TEXT,
  "calculatedAt" TIMESTAMP(3),
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "closedById" TEXT,
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payroll_terminations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_terminations_employeeId_key" ON "payroll_terminations"("employeeId");
CREATE INDEX IF NOT EXISTS "payroll_terminations_companyId_idx" ON "payroll_terminations"("companyId");

CREATE TABLE IF NOT EXISTS "payroll_benefits" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'VALOR_FIXO',
  "value" DECIMAL(14,2) NOT NULL,
  "copayRateBp" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payroll_benefits_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_benefits_companyId_name_key" ON "payroll_benefits"("companyId", "name");

CREATE TABLE IF NOT EXISTS "payroll_benefit_enrollments" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "benefitId" TEXT NOT NULL,
  "customValue" DECIMAL(14,2),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payroll_benefit_enrollments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_benefit_enrollments_employeeId_benefitId_key" ON "payroll_benefit_enrollments"("employeeId", "benefitId");
CREATE INDEX IF NOT EXISTS "payroll_benefit_enrollments_companyId_idx" ON "payroll_benefit_enrollments"("companyId");

CREATE TABLE IF NOT EXISTS "payroll_loans" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "bankName" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "totalAmount" DECIMAL(14,2) NOT NULL,
  "installmentAmount" DECIMAL(14,2) NOT NULL,
  "totalInstallments" INTEGER NOT NULL,
  "paidInstallments" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payroll_loans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_loans_companyId_employeeId_contractId_key" ON "payroll_loans"("companyId", "employeeId", "contractId");

CREATE TABLE IF NOT EXISTS "payroll_pensions" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "dependentId" TEXT NOT NULL,
  "percentage" DECIMAL(6,4) NOT NULL,
  "baseType" TEXT NOT NULL DEFAULT 'NET',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payroll_pensions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_pensions_dependentId_key" ON "payroll_pensions"("dependentId");
CREATE INDEX IF NOT EXISTS "payroll_pensions_companyId_employeeId_idx" ON "payroll_pensions"("companyId", "employeeId");

ALTER TABLE "payroll_vacation_requests" ADD CONSTRAINT "payroll_vacation_requests_vacationPeriodId_fkey"
  FOREIGN KEY ("vacationPeriodId") REFERENCES "payroll_vacation_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_benefit_enrollments" ADD CONSTRAINT "payroll_benefit_enrollments_benefitId_fkey"
  FOREIGN KEY ("benefitId") REFERENCES "payroll_benefits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
