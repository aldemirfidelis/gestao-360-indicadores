-- Folha de Pagamento — Fase 1 (fundação). Aditiva.
-- Ver docs/diagnostico-folha-pagamento.md. Reusa OrgEmployee/CompensationSalarySnapshot/ponto.

CREATE TABLE "payroll_legal_table_versions" (
  "id" TEXT NOT NULL,
  "companyId" TEXT,
  "kind" TEXT NOT NULL,
  "effectiveFrom" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "source" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payroll_legal_table_versions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "payroll_legal_table_versions_kind_effectiveFrom_idx" ON "payroll_legal_table_versions"("kind", "effectiveFrom");
CREATE INDEX "payroll_legal_table_versions_companyId_kind_idx" ON "payroll_legal_table_versions"("companyId", "kind");

CREATE TABLE "payroll_rubric_defs" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "nature" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payroll_rubric_defs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payroll_rubric_defs_companyId_code_key" ON "payroll_rubric_defs"("companyId", "code");

CREATE TABLE "payroll_rubric_versions" (
  "id" TEXT NOT NULL,
  "rubricId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "spec" JSONB NOT NULL,
  "effectiveFrom" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payroll_rubric_versions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payroll_rubric_versions_rubricId_version_key" ON "payroll_rubric_versions"("rubricId", "version");
ALTER TABLE "payroll_rubric_versions" ADD CONSTRAINT "payroll_rubric_versions_rubricId_fkey"
  FOREIGN KEY ("rubricId") REFERENCES "payroll_rubric_defs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "payroll_competences" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payroll_competences_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payroll_competences_companyId_year_month_key" ON "payroll_competences"("companyId", "year", "month");

CREATE TABLE "payroll_runs" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "competenceId" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'MENSAL',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "legalRefs" JSONB,
  "issues" JSONB,
  "totals" JSONB,
  "calculatedAt" TIMESTAMP(3),
  "calculatedById" TEXT,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "closedById" TEXT,
  "closedAt" TIMESTAMP(3),
  "reopenNote" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "payroll_runs_companyId_competenceId_idx" ON "payroll_runs"("companyId", "competenceId");
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_competenceId_fkey"
  FOREIGN KEY ("competenceId") REFERENCES "payroll_competences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "payroll_timekeeping_snapshots" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "userId" TEXT,
  "data" JSONB NOT NULL,
  "hash" TEXT NOT NULL,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payroll_timekeeping_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payroll_timekeeping_snapshots_runId_employeeId_key" ON "payroll_timekeeping_snapshots"("runId", "employeeId");
ALTER TABLE "payroll_timekeeping_snapshots" ADD CONSTRAINT "payroll_timekeeping_snapshots_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "payroll_run_workers" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "userId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'CALCULATED',
  "baseSalary" DECIMAL(14,2) NOT NULL,
  "totalEarnings" DECIMAL(14,2) NOT NULL,
  "totalDeductions" DECIMAL(14,2) NOT NULL,
  "netPay" DECIMAL(14,2) NOT NULL,
  "inssBase" DECIMAL(14,2) NOT NULL,
  "inssValue" DECIMAL(14,2) NOT NULL,
  "irrfBase" DECIMAL(14,2) NOT NULL,
  "irrfValue" DECIMAL(14,2) NOT NULL,
  "fgtsBase" DECIMAL(14,2) NOT NULL,
  "fgtsValue" DECIMAL(14,2) NOT NULL,
  "memory" JSONB NOT NULL,
  "issues" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payroll_run_workers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payroll_run_workers_runId_employeeId_key" ON "payroll_run_workers"("runId", "employeeId");
CREATE INDEX "payroll_run_workers_companyId_runId_idx" ON "payroll_run_workers"("companyId", "runId");
ALTER TABLE "payroll_run_workers" ADD CONSTRAINT "payroll_run_workers_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "payroll_run_items" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "runWorkerId" TEXT NOT NULL,
  "rubricCode" TEXT NOT NULL,
  "rubricName" TEXT NOT NULL,
  "rubricVersionId" TEXT,
  "nature" TEXT NOT NULL,
  "reference" TEXT,
  "amount" DECIMAL(14,2) NOT NULL,
  "origin" TEXT NOT NULL DEFAULT 'MOTOR',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "payroll_run_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "payroll_run_items_companyId_runWorkerId_idx" ON "payroll_run_items"("companyId", "runWorkerId");
ALTER TABLE "payroll_run_items" ADD CONSTRAINT "payroll_run_items_runWorkerId_fkey"
  FOREIGN KEY ("runWorkerId") REFERENCES "payroll_run_workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "payroll_worker_settings" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "salaryType" TEXT NOT NULL DEFAULT 'MENSAL',
  "monthlyHours" INTEGER NOT NULL DEFAULT 220,
  "irDependentsOverride" INTEGER,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payroll_worker_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payroll_worker_settings_employeeId_key" ON "payroll_worker_settings"("employeeId");
CREATE INDEX "payroll_worker_settings_companyId_idx" ON "payroll_worker_settings"("companyId");
