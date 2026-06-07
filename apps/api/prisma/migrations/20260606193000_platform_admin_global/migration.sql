-- Portal Admin Global: ambiente interno separado da operacao das empresas.

CREATE TABLE "PlatformAdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jobTitle" TEXT,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "passwordResetRequired" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "PlatformAdminUser_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformAdminRole" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "system" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "PlatformAdminRole_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformAdminPermission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformAdminPermission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformAdminRolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformAdminRolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

CREATE TABLE "PlatformAdminUserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedBy" TEXT,
    CONSTRAINT "PlatformAdminUserRole_pkey" PRIMARY KEY ("userId","roleId")
);

CREATE TABLE "PlatformAdminSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformAdminSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformAccessLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "action" TEXT NOT NULL,
    "result" TEXT NOT NULL DEFAULT 'SUCCESS',
    "message" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "path" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformAccessLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformAuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "roleCodes" TEXT NOT NULL DEFAULT '[]',
    "permissionKey" TEXT,
    "companyId" TEXT,
    "moduleCode" TEXT,
    "targetType" TEXT,
    "targetId" TEXT,
    "targetLabel" TEXT,
    "action" TEXT NOT NULL,
    "beforeValue" TEXT,
    "afterValue" TEXT,
    "justification" TEXT,
    "result" TEXT NOT NULL DEFAULT 'SUCCESS',
    "sessionId" TEXT,
    "environment" TEXT,
    "correlationId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformCompanyProfile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "internalCode" TEXT,
    "lifecycleStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "planCode" TEXT,
    "commercialOwner" TEXT,
    "implementationOwner" TEXT,
    "primaryContactName" TEXT,
    "primaryContactEmail" TEXT,
    "contractStartAt" TIMESTAMP(3),
    "contractEndsAt" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "storageLimitMb" INTEGER,
    "storageUsedMb" INTEGER NOT NULL DEFAULT 0,
    "maxBranches" INTEGER,
    "maxDocuments" INTEGER,
    "maxForms" INTEGER,
    "maxIndicators" INTEGER,
    "maxIntegrations" INTEGER,
    "healthScore" INTEGER NOT NULL DEFAULT 100,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformCompanyProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformCompanyStatusHistory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT NOT NULL,
    "reason" TEXT,
    "changedBy" TEXT,
    "changedByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformCompanyStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformPlan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "setupPriceCents" INTEGER NOT NULL DEFAULT 0,
    "monthlyPriceCents" INTEGER NOT NULL DEFAULT 0,
    "defaultUsers" INTEGER,
    "defaultBranches" INTEGER,
    "storageLimitMb" INTEGER,
    "supportLevel" TEXT,
    "sla" TEXT,
    "trialDays" INTEGER,
    "billingRules" TEXT,
    "customizations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "PlatformPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformPlanModule" (
    "planId" TEXT NOT NULL,
    "moduleCode" TEXT NOT NULL,
    "included" BOOLEAN NOT NULL DEFAULT true,
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "limits" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformPlanModule_pkey" PRIMARY KEY ("planId","moduleCode")
);

CREATE TABLE "PlatformCompanyPlanOverride" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "planCode" TEXT,
    "field" TEXT NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT,
    "changedBy" TEXT,
    "changedByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformCompanyPlanOverride_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformContract" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "planCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "renewalAt" TIMESTAMP(3),
    "monthlyValueCents" INTEGER,
    "setupValueCents" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "PlatformContract_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformModuleCatalog" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "icon" TEXT,
    "route" TEXT,
    "version" TEXT,
    "globalStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "availability" TEXT NOT NULL DEFAULT '[]',
    "dependencies" TEXT NOT NULL DEFAULT '[]',
    "internalFeatures" TEXT NOT NULL DEFAULT '[]',
    "technicalOwner" TEXT,
    "experimental" BOOLEAN NOT NULL DEFAULT false,
    "documentation" TEXT,
    "changelog" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformModuleCatalog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformCompanyModule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "moduleCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'HERDADO_DO_PLANO',
    "readOnly" BOOLEAN NOT NULL DEFAULT false,
    "activationScheduledAt" TIMESTAMP(3),
    "expirationScheduledAt" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "inheritedFromPlan" BOOLEAN NOT NULL DEFAULT true,
    "manuallyOverridden" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "updatedBy" TEXT,
    "updatedByEmail" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformCompanyModule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformCompanyModuleHistory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "moduleCode" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT NOT NULL,
    "reason" TEXT,
    "note" TEXT,
    "changedBy" TEXT,
    "changedByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformCompanyModuleHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformFeatureFlagTarget" (
    "id" TEXT NOT NULL,
    "flagKey" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetCode" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "percentage" INTEGER,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformFeatureFlagTarget_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformSupportSession" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "adminEmail" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "readOnly" BOOLEAN NOT NULL DEFAULT true,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformSupportSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformEnvironment" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "currentVersion" TEXT,
    "publishedAt" TIMESTAMP(3),
    "owner" TEXT,
    "settings" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformEnvironment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformRelease" (
    "id" TEXT NOT NULL,
    "environmentCode" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "publishedAt" TIMESTAMP(3),
    "responsible" TEXT,
    "changes" TEXT,
    "migrations" TEXT,
    "testResult" TEXT,
    "rollbackInfo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformRelease_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformMigrationRecord" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "environmentCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'APPLIED',
    "appliedAt" TIMESTAMP(3),
    "checksum" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformMigrationRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformBackup" (
    "id" TEXT NOT NULL,
    "environmentCode" TEXT,
    "companyId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "sizeBytes" INTEGER,
    "locationMasked" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformBackup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformIntegrationConfig" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyId" TEXT,
    "environmentCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "owner" TEXT,
    "maskedSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformIntegrationConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformJob" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyId" TEXT,
    "moduleCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "error" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformHealthCheck" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "latencyMs" INTEGER,
    "message" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformHealthCheck_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformAdminUser_email_key" ON "PlatformAdminUser"("email");
CREATE INDEX "PlatformAdminUser_status_idx" ON "PlatformAdminUser"("status");
CREATE INDEX "PlatformAdminUser_deletedAt_idx" ON "PlatformAdminUser"("deletedAt");
CREATE UNIQUE INDEX "PlatformAdminRole_code_key" ON "PlatformAdminRole"("code");
CREATE INDEX "PlatformAdminRole_status_idx" ON "PlatformAdminRole"("status");
CREATE UNIQUE INDEX "PlatformAdminPermission_key_key" ON "PlatformAdminPermission"("key");
CREATE INDEX "PlatformAdminPermission_group_idx" ON "PlatformAdminPermission"("group");
CREATE UNIQUE INDEX "PlatformAdminSession_refreshTokenHash_key" ON "PlatformAdminSession"("refreshTokenHash");
CREATE INDEX "PlatformAdminSession_userId_idx" ON "PlatformAdminSession"("userId");
CREATE INDEX "PlatformAdminSession_expiresAt_idx" ON "PlatformAdminSession"("expiresAt");
CREATE INDEX "PlatformAdminSession_revokedAt_idx" ON "PlatformAdminSession"("revokedAt");
CREATE INDEX "PlatformAccessLog_userId_createdAt_idx" ON "PlatformAccessLog"("userId", "createdAt");
CREATE INDEX "PlatformAccessLog_result_createdAt_idx" ON "PlatformAccessLog"("result", "createdAt");
CREATE INDEX "PlatformAuditLog_createdAt_idx" ON "PlatformAuditLog"("createdAt");
CREATE INDEX "PlatformAuditLog_userId_createdAt_idx" ON "PlatformAuditLog"("userId", "createdAt");
CREATE INDEX "PlatformAuditLog_companyId_createdAt_idx" ON "PlatformAuditLog"("companyId", "createdAt");
CREATE INDEX "PlatformAuditLog_moduleCode_createdAt_idx" ON "PlatformAuditLog"("moduleCode", "createdAt");
CREATE INDEX "PlatformAuditLog_result_idx" ON "PlatformAuditLog"("result");
CREATE UNIQUE INDEX "PlatformCompanyProfile_companyId_key" ON "PlatformCompanyProfile"("companyId");
CREATE UNIQUE INDEX "PlatformCompanyProfile_internalCode_key" ON "PlatformCompanyProfile"("internalCode");
CREATE INDEX "PlatformCompanyProfile_lifecycleStatus_idx" ON "PlatformCompanyProfile"("lifecycleStatus");
CREATE INDEX "PlatformCompanyProfile_planCode_idx" ON "PlatformCompanyProfile"("planCode");
CREATE INDEX "PlatformCompanyStatusHistory_companyId_createdAt_idx" ON "PlatformCompanyStatusHistory"("companyId", "createdAt");
CREATE UNIQUE INDEX "PlatformPlan_code_key" ON "PlatformPlan"("code");
CREATE INDEX "PlatformPlan_status_idx" ON "PlatformPlan"("status");
CREATE INDEX "PlatformPlanModule_moduleCode_idx" ON "PlatformPlanModule"("moduleCode");
CREATE INDEX "PlatformCompanyPlanOverride_companyId_createdAt_idx" ON "PlatformCompanyPlanOverride"("companyId", "createdAt");
CREATE INDEX "PlatformCompanyPlanOverride_planCode_idx" ON "PlatformCompanyPlanOverride"("planCode");
CREATE INDEX "PlatformContract_companyId_idx" ON "PlatformContract"("companyId");
CREATE INDEX "PlatformContract_status_idx" ON "PlatformContract"("status");
CREATE INDEX "PlatformContract_endsAt_idx" ON "PlatformContract"("endsAt");
CREATE UNIQUE INDEX "PlatformModuleCatalog_code_key" ON "PlatformModuleCatalog"("code");
CREATE INDEX "PlatformModuleCatalog_globalStatus_idx" ON "PlatformModuleCatalog"("globalStatus");
CREATE INDEX "PlatformModuleCatalog_category_idx" ON "PlatformModuleCatalog"("category");
CREATE UNIQUE INDEX "PlatformCompanyModule_companyId_moduleCode_key" ON "PlatformCompanyModule"("companyId", "moduleCode");
CREATE INDEX "PlatformCompanyModule_moduleCode_idx" ON "PlatformCompanyModule"("moduleCode");
CREATE INDEX "PlatformCompanyModule_status_idx" ON "PlatformCompanyModule"("status");
CREATE INDEX "PlatformCompanyModuleHistory_companyId_moduleCode_createdAt_idx" ON "PlatformCompanyModuleHistory"("companyId", "moduleCode", "createdAt");
CREATE UNIQUE INDEX "PlatformFeatureFlagTarget_flagKey_targetType_targetCode_key" ON "PlatformFeatureFlagTarget"("flagKey", "targetType", "targetCode");
CREATE INDEX "PlatformFeatureFlagTarget_flagKey_idx" ON "PlatformFeatureFlagTarget"("flagKey");
CREATE INDEX "PlatformSupportSession_companyId_idx" ON "PlatformSupportSession"("companyId");
CREATE INDEX "PlatformSupportSession_adminUserId_idx" ON "PlatformSupportSession"("adminUserId");
CREATE INDEX "PlatformSupportSession_expiresAt_idx" ON "PlatformSupportSession"("expiresAt");
CREATE UNIQUE INDEX "PlatformEnvironment_code_key" ON "PlatformEnvironment"("code");
CREATE INDEX "PlatformRelease_environmentCode_createdAt_idx" ON "PlatformRelease"("environmentCode", "createdAt");
CREATE INDEX "PlatformMigrationRecord_status_idx" ON "PlatformMigrationRecord"("status");
CREATE INDEX "PlatformMigrationRecord_environmentCode_idx" ON "PlatformMigrationRecord"("environmentCode");
CREATE INDEX "PlatformBackup_environmentCode_createdAt_idx" ON "PlatformBackup"("environmentCode", "createdAt");
CREATE INDEX "PlatformBackup_companyId_createdAt_idx" ON "PlatformBackup"("companyId", "createdAt");
CREATE INDEX "PlatformBackup_status_idx" ON "PlatformBackup"("status");
CREATE UNIQUE INDEX "PlatformIntegrationConfig_code_companyId_environmentCode_key" ON "PlatformIntegrationConfig"("code", "companyId", "environmentCode");
CREATE INDEX "PlatformIntegrationConfig_status_idx" ON "PlatformIntegrationConfig"("status");
CREATE INDEX "PlatformJob_status_idx" ON "PlatformJob"("status");
CREATE INDEX "PlatformJob_companyId_idx" ON "PlatformJob"("companyId");
CREATE INDEX "PlatformJob_moduleCode_idx" ON "PlatformJob"("moduleCode");
CREATE INDEX "PlatformHealthCheck_category_idx" ON "PlatformHealthCheck"("category");
CREATE INDEX "PlatformHealthCheck_status_idx" ON "PlatformHealthCheck"("status");
CREATE INDEX "PlatformHealthCheck_checkedAt_idx" ON "PlatformHealthCheck"("checkedAt");

ALTER TABLE "PlatformAdminRolePermission" ADD CONSTRAINT "PlatformAdminRolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "PlatformAdminRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformAdminRolePermission" ADD CONSTRAINT "PlatformAdminRolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "PlatformAdminPermission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformAdminUserRole" ADD CONSTRAINT "PlatformAdminUserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlatformAdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformAdminUserRole" ADD CONSTRAINT "PlatformAdminUserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "PlatformAdminRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformAdminSession" ADD CONSTRAINT "PlatformAdminSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlatformAdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformPlanModule" ADD CONSTRAINT "PlatformPlanModule_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PlatformPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
