-- Gestão completa de projetos: migração somente aditiva.
-- Não remove nem altera colunas existentes de Project, ProjectTask ou ProjectMilestone.

-- CreateEnum
CREATE TYPE "ProjectPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ProjectCostKind" AS ENUM ('PLANNED', 'ACTUAL');

-- CreateEnum
CREATE TYPE "ProjectRiskKind" AS ENUM ('RISK', 'ISSUE');

-- CreateEnum
CREATE TYPE "ProjectRiskStatus" AS ENUM ('OPEN', 'MITIGATING', 'RESOLVED', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "ProjectHealth" AS ENUM ('GREEN', 'YELLOW', 'RED');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "code" TEXT,
ADD COLUMN     "priority" "ProjectPriority" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "category" TEXT,
ADD COLUMN     "sponsor" TEXT,
ADD COLUMN     "managerId" TEXT,
ADD COLUMN     "objective" TEXT,
ADD COLUMN     "justification" TEXT,
ADD COLUMN     "scope" TEXT,
ADD COLUMN     "outOfScope" TEXT,
ADD COLUMN     "assumptions" TEXT,
ADD COLUMN     "benefits" TEXT,
ADD COLUMN     "lessonsLearned" TEXT,
ADD COLUMN     "actualStartAt" TIMESTAMP(3),
ADD COLUMN     "actualEndAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ProjectMilestone" ADD COLUMN     "description" TEXT,
ADD COLUMN     "completedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ProjectTask" ADD COLUMN     "description" TEXT,
ADD COLUMN     "phase" TEXT,
ADD COLUMN     "assigneeId" TEXT,
ADD COLUMN     "completedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "allocation" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProjectMember_allocation_check" CHECK ("allocation" IS NULL OR "allocation" BETWEEN 0 AND 100)
);

-- CreateTable
CREATE TABLE "ProjectCost" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "ProjectCostKind" NOT NULL DEFAULT 'ACTUAL',
    "description" TEXT NOT NULL,
    "category" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" DATE NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectCost_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProjectCost_amount_check" CHECK ("amount" >= 0)
);

-- CreateTable
CREATE TABLE "ProjectRisk" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "ProjectRiskKind" NOT NULL DEFAULT 'RISK',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "probability" INTEGER NOT NULL DEFAULT 3,
    "impact" INTEGER NOT NULL DEFAULT 3,
    "response" TEXT,
    "ownerId" TEXT,
    "ownerName" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "ProjectRiskStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectRisk_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProjectRisk_probability_check" CHECK ("probability" BETWEEN 1 AND 5),
    CONSTRAINT "ProjectRisk_impact_check" CHECK ("impact" BETWEEN 1 AND 5)
);

-- CreateTable
CREATE TABLE "ProjectUpdate" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "health" "ProjectHealth" NOT NULL,
    "reportDate" DATE NOT NULL,
    "summary" TEXT NOT NULL,
    "achievements" TEXT,
    "nextSteps" TEXT,
    "blockers" TEXT,
    "progress" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectUpdate_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProjectUpdate_progress_check" CHECK ("progress" BETWEEN 0 AND 100)
);

-- Projetos existentes recebem um código sequencial por empresa (só a coluna nova é preenchida).
UPDATE "Project" p
SET "code" = n."code"
FROM (
    SELECT "id",
        'PRJ-' || LPAD((ROW_NUMBER() OVER (PARTITION BY "companyId" ORDER BY "createdAt", "id"))::text, 4, '0') AS "code"
    FROM "Project"
) n
WHERE n."id" = p."id" AND p."code" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Project_companyId_code_key" ON "Project"("companyId", "code");

-- CreateIndex
CREATE INDEX "Project_managerId_idx" ON "Project"("managerId");

-- CreateIndex
CREATE INDEX "ProjectTask_assigneeId_idx" ON "ProjectTask"("assigneeId");

-- CreateIndex
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");

-- CreateIndex
CREATE INDEX "ProjectCost_projectId_date_idx" ON "ProjectCost"("projectId", "date");

-- CreateIndex
CREATE INDEX "ProjectRisk_projectId_status_idx" ON "ProjectRisk"("projectId", "status");

-- CreateIndex
CREATE INDEX "ProjectRisk_ownerId_idx" ON "ProjectRisk"("ownerId");

-- CreateIndex
CREATE INDEX "ProjectUpdate_projectId_reportDate_idx" ON "ProjectUpdate"("projectId", "reportDate");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCost" ADD CONSTRAINT "ProjectCost_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRisk" ADD CONSTRAINT "ProjectRisk_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRisk" ADD CONSTRAINT "ProjectRisk_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectUpdate" ADD CONSTRAINT "ProjectUpdate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
