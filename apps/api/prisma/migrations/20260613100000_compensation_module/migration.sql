-- Migration: Cargos e Salarios - dominio corporativo de remuneracao
-- Aditiva: preserva OrgJob/OrgEmployee e cria o modulo em torno dos dados atuais.

CREATE TABLE "compensation_job_catalogs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "orgJobId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT,
    "family" TEXT,
    "careerTrack" TEXT,
    "hierarchyLevel" TEXT,
    "grade" TEXT,
    "salaryBand" TEXT,
    "cbo" TEXT,
    "jobType" TEXT NOT NULL DEFAULT 'administrativo',
    "defaultOrgNodeId" TEXT,
    "defaultCostCenter" TEXT,
    "managerUserId" TEXT,
    "unionCategory" TEXT,
    "workSchedule" TEXT,
    "shift" TEXT,
    "modality" TEXT,
    "criticality" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "effectiveFrom" TIMESTAMP(3),
    "inactiveAt" TIMESTAMP(3),
    "inactiveReason" TEXT,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "compensation_job_catalogs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "compensation_job_catalog_versions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobCatalogId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changeReason" TEXT,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compensation_job_catalog_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "compensation_job_descriptions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobCatalogId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "mission" TEXT,
    "responsibilities" TEXT,
    "detailedActivities" TEXT,
    "expectedDeliverables" TEXT,
    "relatedIndicators" JSONB,
    "technicalSkills" TEXT,
    "behavioralSkills" TEXT,
    "minimumEducation" TEXT,
    "desiredEducation" TEXT,
    "requiredExperience" TEXT,
    "requiredCourses" TEXT,
    "certifications" TEXT,
    "knowledge" TEXT,
    "tools" TEXT,
    "occupationalRisks" TEXT,
    "epis" TEXT,
    "legalRequirements" TEXT,
    "workSchedule" TEXT,
    "workEnvironment" TEXT,
    "autonomyLevel" TEXT,
    "directReports" TEXT,
    "immediateSuperior" TEXT,
    "internalInterfaces" TEXT,
    "externalInterfaces" TEXT,
    "notes" TEXT,
    "attachments" JSONB,
    "evidences" JSONB,
    "preparedById" TEXT,
    "approverIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdById" TEXT,
    "updatedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "replacedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "compensation_job_descriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "compensation_salary_tables" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unitId" TEXT,
    "region" TEXT,
    "unionCategory" TEXT,
    "tableType" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "responsibleId" TEXT,
    "justification" TEXT,
    "attachments" JSONB,
    "createdById" TEXT,
    "updatedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "compensation_salary_tables_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "compensation_salary_ranges" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "salaryTableId" TEXT NOT NULL,
    "jobCatalogId" TEXT,
    "orgJobId" TEXT,
    "family" TEXT,
    "grade" TEXT,
    "level" TEXT,
    "band" TEXT NOT NULL,
    "step" TEXT,
    "minSalary" DECIMAL(14,2) NOT NULL,
    "midpointSalary" DECIMAL(14,2) NOT NULL,
    "maxSalary" DECIMAL(14,2) NOT NULL,
    "amplitude" DECIMAL(8,4),
    "levelPercent" DECIMAL(8,4),
    "benefits" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compensation_salary_ranges_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "compensation_positions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "jobCatalogId" TEXT,
    "orgJobId" TEXT,
    "orgNodeId" TEXT,
    "costCenter" TEXT,
    "shift" TEXT,
    "band" TEXT,
    "plannedSalary" DECIMAL(14,2),
    "budgetAmount" DECIMAL(14,2),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "positionType" TEXT NOT NULL DEFAULT 'PERMANENT',
    "budgetStatus" TEXT NOT NULL DEFAULT 'IN_BUDGET',
    "currentEmployeeId" TEXT,
    "plannedOpenAt" TIMESTAMP(3),
    "activeFrom" TIMESTAMP(3),
    "inactiveAt" TIMESTAMP(3),
    "inactiveReason" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "compensation_positions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "compensation_allocation_history" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "positionId" TEXT,
    "employeeId" TEXT,
    "fromOrgNodeId" TEXT,
    "toOrgNodeId" TEXT,
    "fromJobId" TEXT,
    "toJobId" TEXT,
    "fromPositionId" TEXT,
    "toPositionId" TEXT,
    "reason" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compensation_allocation_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "compensation_salary_snapshots" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "orgJobId" TEXT,
    "jobCatalogId" TEXT,
    "salaryTableId" TEXT,
    "salaryRangeId" TEXT,
    "currentSalary" DECIMAL(14,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "reason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compensation_salary_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "compensation_movement_requests" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "protocol" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "employeeId" TEXT,
    "currentPositionId" TEXT,
    "targetPositionId" TEXT,
    "currentJobId" TEXT,
    "targetJobId" TEXT,
    "currentBand" TEXT,
    "targetBand" TEXT,
    "currentSalary" DECIMAL(14,2),
    "proposedSalary" DECIMAL(14,2),
    "changePercent" DECIMAL(8,4),
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "monthlyImpact" DECIMAL(14,2),
    "annualImpact" DECIMAL(14,2),
    "costCenter" TEXT,
    "availableBudget" DECIMAL(14,2),
    "requesterId" TEXT NOT NULL,
    "managerUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "approvalSteps" JSONB,
    "attachments" JSONB,
    "evidences" JSONB,
    "notes" TEXT,
    "decidedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compensation_movement_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "compensation_budgets" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "periodRef" TEXT NOT NULL,
    "orgNodeId" TEXT,
    "costCenter" TEXT,
    "plannedHeadcount" INTEGER NOT NULL DEFAULT 0,
    "plannedPayroll" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "plannedBenefits" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "plannedCharges" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "compensation_budgets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "compensation_cycles" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "referencePeriod" TEXT NOT NULL,
    "criteria" TEXT,
    "guidelinePercent" DECIMAL(8,4),
    "totalBudget" DECIMAL(14,2),
    "areaBudgets" JSONB,
    "calendar" JSONB,
    "workflow" JSONB,
    "eligibilityRules" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "compensation_cycles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "compensation_salary_surveys" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "provider" TEXT,
    "periodRef" TEXT NOT NULL,
    "region" TEXT,
    "segment" TEXT,
    "companySize" TEXT,
    "internalJobCatalogId" TEXT,
    "marketJobName" TEXT NOT NULL,
    "minSalary" DECIMAL(14,2),
    "medianSalary" DECIMAL(14,2),
    "averageSalary" DECIMAL(14,2),
    "percentile25" DECIMAL(14,2),
    "percentile50" DECIMAL(14,2),
    "percentile75" DECIMAL(14,2),
    "percentile90" DECIMAL(14,2),
    "benefits" JSONB,
    "notes" TEXT,
    "attachments" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "compensation_salary_surveys_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "compensation_simulations" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scenarioType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "assumptions" JSONB,
    "results" JSONB,
    "monthlyImpact" DECIMAL(14,2),
    "annualImpact" DECIMAL(14,2),
    "affectedCount" INTEGER NOT NULL DEFAULT 0,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "movementId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "compensation_simulations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "compensation_job_catalogs_companyId_code_key" ON "compensation_job_catalogs"("companyId", "code");
CREATE UNIQUE INDEX "compensation_job_catalogs_companyId_orgJobId_key" ON "compensation_job_catalogs"("companyId", "orgJobId");
CREATE INDEX "compensation_job_catalogs_companyId_status_idx" ON "compensation_job_catalogs"("companyId", "status");
CREATE INDEX "compensation_job_catalogs_companyId_name_idx" ON "compensation_job_catalogs"("companyId", "name");

CREATE UNIQUE INDEX "compensation_job_catalog_versions_jobCatalogId_version_key" ON "compensation_job_catalog_versions"("jobCatalogId", "version");
CREATE INDEX "compensation_job_catalog_versions_companyId_createdAt_idx" ON "compensation_job_catalog_versions"("companyId", "createdAt");

CREATE UNIQUE INDEX "compensation_job_descriptions_jobCatalogId_version_key" ON "compensation_job_descriptions"("jobCatalogId", "version");
CREATE INDEX "compensation_job_descriptions_companyId_status_idx" ON "compensation_job_descriptions"("companyId", "status");
CREATE INDEX "compensation_job_descriptions_companyId_jobCatalogId_idx" ON "compensation_job_descriptions"("companyId", "jobCatalogId");

CREATE UNIQUE INDEX "compensation_salary_tables_companyId_code_version_key" ON "compensation_salary_tables"("companyId", "code", "version");
CREATE INDEX "compensation_salary_tables_companyId_status_idx" ON "compensation_salary_tables"("companyId", "status");
CREATE INDEX "compensation_salary_tables_companyId_effectiveFrom_effectiveTo_idx" ON "compensation_salary_tables"("companyId", "effectiveFrom", "effectiveTo");

CREATE INDEX "compensation_salary_ranges_companyId_band_idx" ON "compensation_salary_ranges"("companyId", "band");
CREATE INDEX "compensation_salary_ranges_companyId_jobCatalogId_idx" ON "compensation_salary_ranges"("companyId", "jobCatalogId");
CREATE INDEX "compensation_salary_ranges_salaryTableId_idx" ON "compensation_salary_ranges"("salaryTableId");

CREATE UNIQUE INDEX "compensation_positions_companyId_code_key" ON "compensation_positions"("companyId", "code");
CREATE INDEX "compensation_positions_companyId_status_idx" ON "compensation_positions"("companyId", "status");
CREATE INDEX "compensation_positions_companyId_orgNodeId_idx" ON "compensation_positions"("companyId", "orgNodeId");
CREATE INDEX "compensation_positions_companyId_currentEmployeeId_idx" ON "compensation_positions"("companyId", "currentEmployeeId");

CREATE INDEX "compensation_allocation_history_companyId_employeeId_createdAt_idx" ON "compensation_allocation_history"("companyId", "employeeId", "createdAt");
CREATE INDEX "compensation_allocation_history_companyId_positionId_idx" ON "compensation_allocation_history"("companyId", "positionId");

CREATE INDEX "compensation_salary_snapshots_companyId_employeeId_effectiveFrom_idx" ON "compensation_salary_snapshots"("companyId", "employeeId", "effectiveFrom");
CREATE INDEX "compensation_salary_snapshots_companyId_salaryRangeId_idx" ON "compensation_salary_snapshots"("companyId", "salaryRangeId");

CREATE UNIQUE INDEX "compensation_movement_requests_companyId_protocol_key" ON "compensation_movement_requests"("companyId", "protocol");
CREATE INDEX "compensation_movement_requests_companyId_status_idx" ON "compensation_movement_requests"("companyId", "status");
CREATE INDEX "compensation_movement_requests_companyId_employeeId_idx" ON "compensation_movement_requests"("companyId", "employeeId");
CREATE INDEX "compensation_movement_requests_companyId_requesterId_idx" ON "compensation_movement_requests"("companyId", "requesterId");

CREATE UNIQUE INDEX "compensation_budgets_companyId_periodRef_orgNodeId_costCenter_key" ON "compensation_budgets"("companyId", "periodRef", "orgNodeId", "costCenter");
CREATE INDEX "compensation_budgets_companyId_periodRef_idx" ON "compensation_budgets"("companyId", "periodRef");

CREATE INDEX "compensation_cycles_companyId_status_idx" ON "compensation_cycles"("companyId", "status");
CREATE INDEX "compensation_cycles_companyId_referencePeriod_idx" ON "compensation_cycles"("companyId", "referencePeriod");

CREATE INDEX "compensation_salary_surveys_companyId_periodRef_idx" ON "compensation_salary_surveys"("companyId", "periodRef");
CREATE INDEX "compensation_salary_surveys_companyId_internalJobCatalogId_idx" ON "compensation_salary_surveys"("companyId", "internalJobCatalogId");

CREATE INDEX "compensation_simulations_companyId_status_idx" ON "compensation_simulations"("companyId", "status");
CREATE INDEX "compensation_simulations_companyId_scenarioType_idx" ON "compensation_simulations"("companyId", "scenarioType");

ALTER TABLE "compensation_job_catalogs" ADD CONSTRAINT "compensation_job_catalogs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "compensation_job_catalog_versions" ADD CONSTRAINT "compensation_job_catalog_versions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "compensation_job_catalog_versions" ADD CONSTRAINT "compensation_job_catalog_versions_jobCatalogId_fkey" FOREIGN KEY ("jobCatalogId") REFERENCES "compensation_job_catalogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compensation_job_descriptions" ADD CONSTRAINT "compensation_job_descriptions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "compensation_job_descriptions" ADD CONSTRAINT "compensation_job_descriptions_jobCatalogId_fkey" FOREIGN KEY ("jobCatalogId") REFERENCES "compensation_job_catalogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compensation_salary_tables" ADD CONSTRAINT "compensation_salary_tables_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "compensation_salary_ranges" ADD CONSTRAINT "compensation_salary_ranges_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "compensation_salary_ranges" ADD CONSTRAINT "compensation_salary_ranges_salaryTableId_fkey" FOREIGN KEY ("salaryTableId") REFERENCES "compensation_salary_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compensation_salary_ranges" ADD CONSTRAINT "compensation_salary_ranges_jobCatalogId_fkey" FOREIGN KEY ("jobCatalogId") REFERENCES "compensation_job_catalogs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "compensation_positions" ADD CONSTRAINT "compensation_positions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "compensation_positions" ADD CONSTRAINT "compensation_positions_jobCatalogId_fkey" FOREIGN KEY ("jobCatalogId") REFERENCES "compensation_job_catalogs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "compensation_allocation_history" ADD CONSTRAINT "compensation_allocation_history_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "compensation_allocation_history" ADD CONSTRAINT "compensation_allocation_history_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "compensation_positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "compensation_salary_snapshots" ADD CONSTRAINT "compensation_salary_snapshots_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "compensation_salary_snapshots" ADD CONSTRAINT "compensation_salary_snapshots_salaryRangeId_fkey" FOREIGN KEY ("salaryRangeId") REFERENCES "compensation_salary_ranges"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "compensation_movement_requests" ADD CONSTRAINT "compensation_movement_requests_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "compensation_movement_requests" ADD CONSTRAINT "compensation_movement_requests_currentPositionId_fkey" FOREIGN KEY ("currentPositionId") REFERENCES "compensation_positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "compensation_movement_requests" ADD CONSTRAINT "compensation_movement_requests_targetPositionId_fkey" FOREIGN KEY ("targetPositionId") REFERENCES "compensation_positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "compensation_budgets" ADD CONSTRAINT "compensation_budgets_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "compensation_cycles" ADD CONSTRAINT "compensation_cycles_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "compensation_salary_surveys" ADD CONSTRAINT "compensation_salary_surveys_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "compensation_simulations" ADD CONSTRAINT "compensation_simulations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

