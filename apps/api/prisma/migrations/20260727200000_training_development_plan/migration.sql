-- =====================================================================
-- T&D — Plano de Desenvolvimento Individual (PDI)
--
-- Migracao ADITIVA. O PDI nao cria catalogo paralelo: a acao de
-- desenvolvimento aponta para um treinamento ja cadastrado quando aplicavel.
-- =====================================================================

CREATE TYPE "DevelopmentPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "DevelopmentActionStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'DONE', 'CANCELLED');
CREATE TYPE "DevelopmentPlanOrigin" AS ENUM ('PERFORMANCE_REVIEW', 'MANAGER_REQUEST', 'JOB_CHANGE', 'SUCCESSION', 'COMPETENCY_GAP', 'AUDIT', 'OPERATIONAL_NEED', 'EMPLOYEE_REQUEST');

CREATE TABLE "development_plans" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "origin" "DevelopmentPlanOrigin" NOT NULL DEFAULT 'MANAGER_REQUEST',
    "status" "DevelopmentPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "competency" TEXT,
    "objective" TEXT,
    "expectedResult" TEXT,
    "startsAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "ownerUserId" TEXT,
    "managerReview" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "development_plans_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "development_plans_companyId_status_idx" ON "development_plans"("companyId", "status");
CREATE INDEX "development_plans_employeeId_idx" ON "development_plans"("employeeId");
ALTER TABLE "development_plans" ADD CONSTRAINT "development_plans_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "development_plans" ADD CONSTRAINT "development_plans_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "OrgEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "development_actions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "DevelopmentActionStatus" NOT NULL DEFAULT 'PLANNED',
    "trainingId" TEXT,
    "responsibleUserId" TEXT,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "evidence" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "development_actions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "development_actions_companyId_status_idx" ON "development_actions"("companyId", "status");
CREATE INDEX "development_actions_planId_idx" ON "development_actions"("planId");
ALTER TABLE "development_actions" ADD CONSTRAINT "development_actions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "development_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "development_actions" ADD CONSTRAINT "development_actions_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "trainings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
