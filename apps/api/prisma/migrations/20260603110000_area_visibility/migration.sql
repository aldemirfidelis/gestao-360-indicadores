-- Multiempresa: visibilidade e acesso por área (atribuições, matriz e exceções).

-- CreateEnum
CREATE TYPE "AreaAssignmentType" AS ENUM ('PRIMARY', 'SECONDARY', 'TEMPORARY', 'VIEWER');

-- CreateEnum
CREATE TYPE "VisibilityLevel" AS ENUM ('NONE', 'SUMMARY', 'FULL', 'CREATE', 'EDIT', 'APPROVE', 'DELETE', 'ADMIN');

-- CreateEnum
CREATE TYPE "VisibilityEffect" AS ENUM ('ALLOW', 'DENY');

-- CreateTable
CREATE TABLE "UserAreaAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "orgNodeId" TEXT NOT NULL,
    "assignmentType" "AreaAssignmentType" NOT NULL DEFAULT 'SECONDARY',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAreaAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AreaVisibilityRule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sourceAreaId" TEXT NOT NULL,
    "targetAreaId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "visibilityLevel" "VisibilityLevel" NOT NULL DEFAULT 'SUMMARY',
    "canView" BOOLEAN NOT NULL DEFAULT true,
    "canCreate" BOOLEAN NOT NULL DEFAULT false,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,
    "canDelete" BOOLEAN NOT NULL DEFAULT false,
    "canApprove" BOOLEAN NOT NULL DEFAULT false,
    "canExport" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AreaVisibilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserVisibilityException" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetAreaId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "permissionKey" TEXT,
    "effect" "VisibilityEffect" NOT NULL DEFAULT 'ALLOW',
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "reason" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserVisibilityException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserAreaAssignment_companyId_idx" ON "UserAreaAssignment"("companyId");
CREATE INDEX "UserAreaAssignment_userId_idx" ON "UserAreaAssignment"("userId");
CREATE INDEX "UserAreaAssignment_orgNodeId_idx" ON "UserAreaAssignment"("orgNodeId");
CREATE UNIQUE INDEX "UserAreaAssignment_userId_orgNodeId_key" ON "UserAreaAssignment"("userId", "orgNodeId");

CREATE INDEX "AreaVisibilityRule_companyId_idx" ON "AreaVisibilityRule"("companyId");
CREATE INDEX "AreaVisibilityRule_companyId_sourceAreaId_idx" ON "AreaVisibilityRule"("companyId", "sourceAreaId");
CREATE INDEX "AreaVisibilityRule_companyId_targetAreaId_idx" ON "AreaVisibilityRule"("companyId", "targetAreaId");
CREATE INDEX "AreaVisibilityRule_moduleKey_idx" ON "AreaVisibilityRule"("moduleKey");
CREATE UNIQUE INDEX "AreaVisibilityRule_companyId_sourceAreaId_targetAreaId_modu_key" ON "AreaVisibilityRule"("companyId", "sourceAreaId", "targetAreaId", "moduleKey");

CREATE INDEX "UserVisibilityException_companyId_idx" ON "UserVisibilityException"("companyId");
CREATE INDEX "UserVisibilityException_userId_idx" ON "UserVisibilityException"("userId");
CREATE INDEX "UserVisibilityException_userId_targetAreaId_moduleKey_idx" ON "UserVisibilityException"("userId", "targetAreaId", "moduleKey");
