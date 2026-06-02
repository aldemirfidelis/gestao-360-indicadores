-- CreateTable
CREATE TABLE "PortalModule" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "icon" TEXT,
    "route" TEXT,
    "menuOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" TEXT,
    "criticality" TEXT NOT NULL DEFAULT 'medium',
    "dependencies" TEXT NOT NULL DEFAULT '[]',
    "allowedRoles" TEXT NOT NULL DEFAULT '[]',
    "allowedScopes" TEXT NOT NULL DEFAULT '[]',
    "systemRequired" BOOLEAN NOT NULL DEFAULT false,
    "nonBlockable" BOOLEAN NOT NULL DEFAULT false,
    "experimental" BOOLEAN NOT NULL DEFAULT false,
    "unavailableMessage" TEXT,
    "scheduledActivationAt" TIMESTAMP(3),
    "scheduledDeactivationAt" TIMESTAMP(3),
    "updatedBy" TEXT,
    "updateReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalPage" (
    "id" TEXT NOT NULL,
    "moduleCode" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "route" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "menuOrder" INTEGER NOT NULL DEFAULT 0,
    "component" TEXT,
    "allowedRoles" TEXT NOT NULL DEFAULT '[]',
    "allowedScopes" TEXT NOT NULL DEFAULT '[]',
    "unavailableMessage" TEXT,
    "updatedBy" TEXT,
    "updateReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalFeature" (
    "id" TEXT NOT NULL,
    "moduleCode" TEXT,
    "pageCode" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "criticality" TEXT NOT NULL DEFAULT 'medium',
    "allowedRoles" TEXT NOT NULL DEFAULT '[]',
    "allowedScopes" TEXT NOT NULL DEFAULT '[]',
    "dependencies" TEXT NOT NULL DEFAULT '[]',
    "flagKey" TEXT,
    "updatedBy" TEXT,
    "updateReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalFeatureFlag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "rolloutPercentage" INTEGER,
    "allowedRoles" TEXT NOT NULL DEFAULT '[]',
    "allowedUserIds" TEXT NOT NULL DEFAULT '[]',
    "allowedScopes" TEXT NOT NULL DEFAULT '[]',
    "environment" TEXT,
    "experimental" BOOLEAN NOT NULL DEFAULT false,
    "scheduledOnAt" TIMESTAMP(3),
    "scheduledOffAt" TIMESTAMP(3),
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalFeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalNavOverride" (
    "id" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'item',
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER,
    "labelOverride" TEXT,
    "iconOverride" TEXT,
    "groupOverride" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalNavOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalScopeRule" (
    "id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetCode" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "effect" TEXT NOT NULL DEFAULT 'allow',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalScopeRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalIntegration" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'enabled',
    "environment" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastLatencyMs" INTEGER,
    "recentFailures" INTEGER NOT NULL DEFAULT 0,
    "configMasked" TEXT NOT NULL DEFAULT '{}',
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalAnnouncement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "audienceRoles" TEXT NOT NULL DEFAULT '[]',
    "pages" TEXT NOT NULL DEFAULT '[]',
    "modules" TEXT NOT NULL DEFAULT '[]',
    "companies" TEXT NOT NULL DEFAULT '[]',
    "branches" TEXT NOT NULL DEFAULT '[]',
    "orgNodes" TEXT NOT NULL DEFAULT '[]',
    "display" TEXT NOT NULL DEFAULT 'banner',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "dismissible" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalMaintenanceWindow" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'global',
    "targetCode" TEXT,
    "message" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "allowSuperAdmin" BOOLEAN NOT NULL DEFAULT true,
    "allowedUserIds" TEXT NOT NULL DEFAULT '[]',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalMaintenanceWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalAdminAuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "userRole" TEXT,
    "tab" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetCode" TEXT,
    "beforeValue" TEXT,
    "afterValue" TEXT,
    "reason" TEXT,
    "result" TEXT NOT NULL DEFAULT 'SUCCESS',
    "message" TEXT,
    "transactionId" TEXT,
    "snapshotId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalAdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalConfigSnapshot" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "reason" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'MANUAL',
    "data" TEXT NOT NULL,
    "checksum" TEXT,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdByEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "restoredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalConfigSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalDiagnosticRun" (
    "id" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '{}',
    "findings" TEXT NOT NULL DEFAULT '[]',
    "createdBy" TEXT,
    "createdByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalDiagnosticRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PortalModule_code_key" ON "PortalModule"("code");

-- CreateIndex
CREATE INDEX "PortalModule_status_idx" ON "PortalModule"("status");

-- CreateIndex
CREATE INDEX "PortalModule_category_idx" ON "PortalModule"("category");

-- CreateIndex
CREATE UNIQUE INDEX "PortalPage_code_key" ON "PortalPage"("code");

-- CreateIndex
CREATE INDEX "PortalPage_moduleCode_idx" ON "PortalPage"("moduleCode");

-- CreateIndex
CREATE INDEX "PortalPage_status_idx" ON "PortalPage"("status");

-- CreateIndex
CREATE INDEX "PortalPage_route_idx" ON "PortalPage"("route");

-- CreateIndex
CREATE UNIQUE INDEX "PortalFeature_code_key" ON "PortalFeature"("code");

-- CreateIndex
CREATE INDEX "PortalFeature_moduleCode_idx" ON "PortalFeature"("moduleCode");

-- CreateIndex
CREATE INDEX "PortalFeature_pageCode_idx" ON "PortalFeature"("pageCode");

-- CreateIndex
CREATE INDEX "PortalFeature_status_idx" ON "PortalFeature"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PortalFeatureFlag_key_key" ON "PortalFeatureFlag"("key");

-- CreateIndex
CREATE INDEX "PortalFeatureFlag_enabled_idx" ON "PortalFeatureFlag"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "PortalNavOverride_itemKey_key" ON "PortalNavOverride"("itemKey");

-- CreateIndex
CREATE INDEX "PortalScopeRule_targetType_targetCode_idx" ON "PortalScopeRule"("targetType", "targetCode");

-- CreateIndex
CREATE UNIQUE INDEX "PortalIntegration_code_key" ON "PortalIntegration"("code");

-- CreateIndex
CREATE INDEX "PortalAnnouncement_active_startsAt_idx" ON "PortalAnnouncement"("active", "startsAt");

-- CreateIndex
CREATE INDEX "PortalMaintenanceWindow_scope_active_idx" ON "PortalMaintenanceWindow"("scope", "active");

-- CreateIndex
CREATE INDEX "PortalAdminAuditLog_createdAt_idx" ON "PortalAdminAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "PortalAdminAuditLog_userId_createdAt_idx" ON "PortalAdminAuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PortalAdminAuditLog_tab_action_idx" ON "PortalAdminAuditLog"("tab", "action");

-- CreateIndex
CREATE INDEX "PortalAdminAuditLog_result_idx" ON "PortalAdminAuditLog"("result");

-- CreateIndex
CREATE INDEX "PortalConfigSnapshot_createdAt_idx" ON "PortalConfigSnapshot"("createdAt");

-- CreateIndex
CREATE INDEX "PortalConfigSnapshot_status_idx" ON "PortalConfigSnapshot"("status");

-- CreateIndex
CREATE INDEX "PortalDiagnosticRun_createdAt_idx" ON "PortalDiagnosticRun"("createdAt");

