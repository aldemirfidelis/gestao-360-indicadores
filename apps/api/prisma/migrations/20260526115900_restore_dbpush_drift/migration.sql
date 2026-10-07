-- Recupera o que entrou no banco via `prisma db push` (commit d71f15e, Organograma
-- de Area) sem migration correspondente. Sem isto, `prisma migrate deploy` num
-- banco vazio quebra na 20260526120000_career_approval_requests com
-- `relation "OrgEmployee" does not exist`.
--
-- Conteudo gerado em 2026-10-07 com `prisma migrate diff` entre as migrations
-- anteriores a 20260526120000 e o schema.prisma do commit b3bb73e^ (estado do
-- banco quando a migration seguinte foi escrita).
--
-- Idempotente: bancos que ja receberam essas estruturas via db push (ex.: o
-- antigo de producao) nao sao afetados.

-- AlterTable
ALTER TABLE "ActionTask" ADD COLUMN IF NOT EXISTS "assignedToId" TEXT;
ALTER TABLE "ActionTask" ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP(3);
ALTER TABLE "ActionTask" ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ObjectiveRelation" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Perspective" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "indicatorId" TEXT;

-- AlterTable
ALTER TABLE "WorkPeriod" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "OrgJob" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OrgEmployee" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "orgNodeId" TEXT,
    "registrationId" TEXT,
    "name" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "band" TEXT NOT NULL DEFAULT 'B',
    "bandPretended" TEXT NOT NULL DEFAULT 'B',
    "shift" TEXT NOT NULL DEFAULT 'D',
    "isBudgeted" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "approvalStatus" TEXT NOT NULL DEFAULT 'PENDENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OrgJobCareerPath" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fromJobId" TEXT NOT NULL,
    "toJobId" TEXT NOT NULL,
    "sourceHandle" TEXT DEFAULT 'right',
    "targetHandle" TEXT DEFAULT 'left',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgJobCareerPath_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OrgJob_companyId_idx" ON "OrgJob"("companyId");
CREATE INDEX IF NOT EXISTS "OrgEmployee_companyId_idx" ON "OrgEmployee"("companyId");
CREATE INDEX IF NOT EXISTS "OrgEmployee_orgNodeId_idx" ON "OrgEmployee"("orgNodeId");
CREATE INDEX IF NOT EXISTS "OrgJobCareerPath_companyId_idx" ON "OrgJobCareerPath"("companyId");
CREATE UNIQUE INDEX IF NOT EXISTS "OrgJobCareerPath_fromJobId_toJobId_key" ON "OrgJobCareerPath"("fromJobId", "toJobId");
CREATE INDEX IF NOT EXISTS "ActionTask_actionId_idx" ON "ActionTask"("actionId");
CREATE INDEX IF NOT EXISTS "ActionTask_assignedToId_idx" ON "ActionTask"("assignedToId");
CREATE INDEX IF NOT EXISTS "Project_indicatorId_idx" ON "Project"("indicatorId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "ActionTask" ADD CONSTRAINT "ActionTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "Project" ADD CONSTRAINT "Project_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "Indicator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "OrgJob" ADD CONSTRAINT "OrgJob_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "OrgEmployee" ADD CONSTRAINT "OrgEmployee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "OrgEmployee" ADD CONSTRAINT "OrgEmployee_orgNodeId_fkey" FOREIGN KEY ("orgNodeId") REFERENCES "OrgNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "OrgEmployee" ADD CONSTRAINT "OrgEmployee_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "OrgJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "OrgJobCareerPath" ADD CONSTRAINT "OrgJobCareerPath_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "OrgJobCareerPath" ADD CONSTRAINT "OrgJobCareerPath_fromJobId_fkey" FOREIGN KEY ("fromJobId") REFERENCES "OrgJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "OrgJobCareerPath" ADD CONSTRAINT "OrgJobCareerPath_toJobId_fkey" FOREIGN KEY ("toJobId") REFERENCES "OrgJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
