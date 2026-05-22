-- Admin settings, dynamic parameters, profiles and audit enrichment.

CREATE TYPE "UserAccessStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED', 'PENDING');
CREATE TYPE "AdminRecordStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

ALTER TYPE "OrgNodeType" ADD VALUE IF NOT EXISTS 'UNIT';
ALTER TYPE "OrgNodeType" ADD VALUE IF NOT EXISTS 'SUBSECTOR';
ALTER TYPE "OrgNodeType" ADD VALUE IF NOT EXISTS 'SUBAREA';
ALTER TYPE "OrgNodeType" ADD VALUE IF NOT EXISTS 'DEPARTMENT';
ALTER TYPE "OrgNodeType" ADD VALUE IF NOT EXISTS 'COST_CENTER';
ALTER TYPE "OrgNodeType" ADD VALUE IF NOT EXISTS 'MACROPROCESS';

ALTER TABLE "User"
  ADD COLUMN "status" "UserAccessStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "passwordResetRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "invitedAt" TIMESTAMP(3),
  ADD COLUMN "blockedAt" TIMESTAMP(3),
  ADD COLUMN "branchId" TEXT,
  ADD COLUMN "accessProfileId" TEXT;

UPDATE "User" SET "status" = CASE WHEN "active" THEN 'ACTIVE'::"UserAccessStatus" ELSE 'INACTIVE'::"UserAccessStatus" END;

CREATE TABLE "AccessProfile" (
  "id" TEXT NOT NULL,
  "companyId" TEXT,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "role" "UserRoleEnum",
  "status" "AdminRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "system" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "AccessProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProfilePermission" (
  "profileId" TEXT NOT NULL,
  "permissionId" TEXT NOT NULL,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProfilePermission_pkey" PRIMARY KEY ("profileId", "permissionId")
);

CREATE TABLE "ParameterCategory" (
  "id" TEXT NOT NULL,
  "companyId" TEXT,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "module" TEXT,
  "status" "AdminRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "system" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "ParameterCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ParameterItem" (
  "id" TEXT NOT NULL,
  "companyId" TEXT,
  "categoryId" TEXT NOT NULL,
  "parentId" TEXT,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "AdminRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "ParameterItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AuditLog"
  ADD COLUMN "module" TEXT,
  ADD COLUMN "recordLabel" TEXT,
  ADD COLUMN "beforeValue" TEXT,
  ADD COLUMN "afterValue" TEXT,
  ADD COLUMN "result" TEXT DEFAULT 'SUCCESS',
  ADD COLUMN "sessionId" TEXT;

ALTER TABLE "AppSetting"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "valueType" TEXT DEFAULT 'text',
  ADD COLUMN "group" TEXT DEFAULT 'Sistema',
  ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "AccessProfile_companyId_code_key" ON "AccessProfile"("companyId", "code");
CREATE INDEX "AccessProfile_companyId_status_idx" ON "AccessProfile"("companyId", "status");

CREATE INDEX "User_branchId_idx" ON "User"("branchId");
CREATE INDEX "User_accessProfileId_idx" ON "User"("accessProfileId");
CREATE INDEX "User_status_idx" ON "User"("status");

CREATE UNIQUE INDEX "ParameterCategory_companyId_code_key" ON "ParameterCategory"("companyId", "code");
CREATE INDEX "ParameterCategory_companyId_status_idx" ON "ParameterCategory"("companyId", "status");
CREATE INDEX "ParameterCategory_module_idx" ON "ParameterCategory"("module");

CREATE UNIQUE INDEX "ParameterItem_categoryId_code_key" ON "ParameterItem"("categoryId", "code");
CREATE INDEX "ParameterItem_companyId_status_idx" ON "ParameterItem"("companyId", "status");
CREATE INDEX "ParameterItem_categoryId_status_idx" ON "ParameterItem"("categoryId", "status");
CREATE INDEX "ParameterItem_parentId_idx" ON "ParameterItem"("parentId");

CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");
CREATE INDEX "AuditLog_module_action_idx" ON "AuditLog"("module", "action");

ALTER TABLE "User" ADD CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_accessProfileId_fkey" FOREIGN KEY ("accessProfileId") REFERENCES "AccessProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccessProfile" ADD CONSTRAINT "AccessProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProfilePermission" ADD CONSTRAINT "ProfilePermission_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AccessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfilePermission" ADD CONSTRAINT "ProfilePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ParameterCategory" ADD CONSTRAINT "ParameterCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ParameterItem" ADD CONSTRAINT "ParameterItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ParameterItem" ADD CONSTRAINT "ParameterItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ParameterCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ParameterItem" ADD CONSTRAINT "ParameterItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ParameterItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
