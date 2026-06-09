-- CreateEnum
CREATE TYPE "WorkItemPriorityLevel" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');

-- CreateTable
CREATE TABLE "WorkItemIndex" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "sourceModule" TEXT NOT NULL,
    "sourceEntityType" TEXT NOT NULL,
    "sourceEntityId" TEXT NOT NULL,
    "sourceEventId" TEXT,
    "workflowInstanceId" TEXT,
    "workflowNodeKey" TEXT,
    "itemType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" "WorkItemPriorityLevel" NOT NULL DEFAULT 'MEDIUM',
    "priorityScore" INTEGER NOT NULL DEFAULT 0,
    "priorityReason" TEXT,
    "criticality" TEXT,
    "dueAt" TIMESTAMP(3),
    "overdueDays" INTEGER NOT NULL DEFAULT 0,
    "slaStatus" TEXT,
    "assignedUserId" TEXT,
    "assignedGroupId" TEXT,
    "requesterUserId" TEXT,
    "managerUserId" TEXT,
    "branchId" TEXT,
    "orgNodeId" TEXT,
    "processId" TEXT,
    "contextData" JSONB,
    "availableActions" JSONB,
    "recommendedAction" TEXT,
    "requiresDecision" BOOLEAN NOT NULL DEFAULT false,
    "requiresEvidence" BOOLEAN NOT NULL DEFAULT false,
    "isBlocking" BOOLEAN NOT NULL DEFAULT false,
    "isExternal" BOOLEAN NOT NULL DEFAULT false,
    "isDelegated" BOOLEAN NOT NULL DEFAULT false,
    "delegatedFromUserId" TEXT,
    "sourceCreatedAt" TIMESTAMP(3),
    "sourceUpdatedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "refreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkItemIndex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDashboardPreference" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "landingPage" TEXT DEFAULT '/meu-dia',
    "defaultView" TEXT DEFAULT 'list',
    "visibleWidgets" JSONB,
    "widgetOrder" JSONB,
    "savedFilters" JSONB,
    "defaultCompanyId" TEXT,
    "defaultUnitId" TEXT,
    "compactMode" BOOLEAN NOT NULL DEFAULT false,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "dailySummaryEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dailySummaryTime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDashboardPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkItemIndex_dedupeKey_key" ON "WorkItemIndex"("dedupeKey");

-- CreateIndex
CREATE INDEX "WorkItemIndex_companyId_assignedUserId_status_idx" ON "WorkItemIndex"("companyId", "assignedUserId", "status");

-- CreateIndex
CREATE INDEX "WorkItemIndex_companyId_status_dueAt_idx" ON "WorkItemIndex"("companyId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "WorkItemIndex_companyId_priority_idx" ON "WorkItemIndex"("companyId", "priority");

-- CreateIndex
CREATE INDEX "WorkItemIndex_companyId_itemType_idx" ON "WorkItemIndex"("companyId", "itemType");

-- CreateIndex
CREATE INDEX "WorkItemIndex_assignedUserId_status_idx" ON "WorkItemIndex"("assignedUserId", "status");

-- CreateIndex
CREATE INDEX "WorkItemIndex_dueAt_idx" ON "WorkItemIndex"("dueAt");

-- CreateIndex
CREATE INDEX "UserDashboardPreference_userId_idx" ON "UserDashboardPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserDashboardPreference_companyId_userId_key" ON "UserDashboardPreference"("companyId", "userId");

-- AddForeignKey
ALTER TABLE "WorkItemIndex" ADD CONSTRAINT "WorkItemIndex_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDashboardPreference" ADD CONSTRAINT "UserDashboardPreference_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

