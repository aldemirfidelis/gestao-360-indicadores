-- CreateEnum
CREATE TYPE "UserRoleEnum" AS ENUM ('SUPER_ADMIN', 'COMPANY_ADMIN', 'DIRECTOR', 'MANAGER', 'ANALYST', 'COLLABORATOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "OrgNodeType" AS ENUM ('COMPANY', 'BRANCH', 'DIRECTORATE', 'MANAGEMENT', 'COORDINATION', 'SECTOR', 'AREA', 'PROCESS');

-- CreateEnum
CREATE TYPE "IndicatorType" AS ENUM ('STRATEGIC', 'TACTICAL', 'OPERATIONAL', 'PROJECT', 'PROCESS', 'SAFETY', 'QUALITY', 'HR', 'FINANCE', 'PRODUCTION', 'MAINTENANCE', 'PROCUREMENT', 'COMMERCIAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "IndicatorUnit" AS ENUM ('PERCENT', 'CURRENCY', 'QUANTITY', 'HOURS', 'DAYS', 'TONS', 'LITERS', 'INDEX', 'TEXT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "Periodicity" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('HIGHER_BETTER', 'LOWER_BETTER', 'EQUAL_TARGET', 'RANGE');

-- CreateEnum
CREATE TYPE "FeedKind" AS ENUM ('MANUAL', 'IMPORT', 'API', 'DATABASE', 'INTEGRATION');

-- CreateEnum
CREATE TYPE "IndicatorStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'IN_REVIEW');

-- CreateEnum
CREATE TYPE "ResultStatus" AS ENUM ('PENDING', 'FILLED', 'APPROVED', 'REJECTED', 'REOPENED');

-- CreateEnum
CREATE TYPE "DeviationSeverity" AS ENUM ('LOW', 'MODERATE', 'CRITICAL');

-- CreateEnum
CREATE TYPE "DeviationStatus" AS ENUM ('OPEN', 'IN_ANALYSIS', 'WAITING_ACTION', 'IN_PROGRESS', 'CLOSED', 'CLOSED_LATE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AnalysisMethod" AS ENUM ('FCA', 'FIVE_WHYS', 'ISHIKAWA', 'PARETO', 'CAPA', 'SIMPLE');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'WAITING_THIRD', 'PAUSED', 'DONE', 'DONE_LATE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ActionPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ActionOrigin" AS ENUM ('INDICATOR', 'DEVIATION', 'OBJECTIVE', 'OKR', 'MEETING', 'PROJECT', 'MANUAL');

-- CreateEnum
CREATE TYPE "PerspectiveKind" AS ENUM ('FINANCIAL', 'CUSTOMERS', 'INTERNAL_PROCESS', 'LEARNING_GROWTH', 'SAFETY', 'PEOPLE', 'ESG', 'QUALITY', 'PRODUCTIVITY', 'COSTS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ObjectiveStatus" AS ENUM ('PLANNED', 'ON_TRACK', 'AT_RISK', 'OFF_TRACK', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TrafficLight" AS ENUM ('GREEN', 'YELLOW', 'RED', 'GRAY');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'ON_HOLD', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MeetingKind" AS ENUM ('INDICATORS', 'BOARD', 'SECTOR', 'PROJECT', 'DEVIATION');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('INDICATOR_OFF_TARGET', 'PENDING_RESULT', 'ACTION_DUE_SOON', 'ACTION_OVERDUE', 'DEVIATION_CRITICAL', 'PROJECT_LATE', 'MEETING_UPCOMING', 'TARGET_MISSED', 'MENTION');

-- CreateEnum
CREATE TYPE "IndicatorRelationKind" AS ENUM ('POSITIVE', 'NEGATIVE', 'PROBABLE_CAUSE', 'CONSEQUENCE');

-- CreateEnum
CREATE TYPE "ImportTargetKind" AS ENUM ('INDICATORS', 'ORG_TREE', 'TARGETS', 'RESULTS');

-- CreateEnum
CREATE TYPE "ImportRowStatus" AS ENUM ('PENDING', 'OK', 'ERROR', 'SKIPPED');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tradeName" TEXT,
    "cnpj" TEXT,
    "logoUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "city" TEXT,
    "state" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgNode" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "type" "OrgNodeType" NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "responsibleUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "OrgNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jobTitle" TEXT,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "role" "UserRoleEnum" NOT NULL DEFAULT 'COLLABORATOR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "defaultNodeId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPermission" (
    "userId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("userId","permissionId")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "ip" TEXT,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategicMap" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "StrategicMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Perspective" (
    "id" TEXT NOT NULL,
    "mapId" TEXT NOT NULL,
    "kind" "PerspectiveKind" NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Perspective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategicObjective" (
    "id" TEXT NOT NULL,
    "mapId" TEXT NOT NULL,
    "perspectiveId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "responsible" TEXT,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "status" "ObjectiveStatus" NOT NULL DEFAULT 'PLANNED',
    "priority" INTEGER NOT NULL DEFAULT 3,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "StrategicObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObjectiveRelation" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,

    CONSTRAINT "ObjectiveRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OKRCycle" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "OKRCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OKRObjective" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "strategicObjId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerName" TEXT,
    "team" TEXT,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "status" "ObjectiveStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "OKRObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeyResult" (
    "id" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "unit" "IndicatorUnit" NOT NULL DEFAULT 'QUANTITY',
    "startValue" DOUBLE PRECISION NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "direction" "Direction" NOT NULL DEFAULT 'HIGHER_BETTER',
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "responsible" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeyResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OKRCheckin" (
    "id" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "weekRef" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "progress" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OKRCheckin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Indicator" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ownerNodeId" TEXT NOT NULL,
    "responsibleUserId" TEXT,
    "feederUserId" TEXT,
    "strategicObjectiveId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "type" "IndicatorType" NOT NULL DEFAULT 'OPERATIONAL',
    "category" TEXT,
    "unit" "IndicatorUnit" NOT NULL DEFAULT 'PERCENT',
    "unitLabel" TEXT,
    "periodicity" "Periodicity" NOT NULL DEFAULT 'MONTHLY',
    "direction" "Direction" NOT NULL DEFAULT 'HIGHER_BETTER',
    "formula" TEXT,
    "source" TEXT,
    "feedKind" "FeedKind" NOT NULL DEFAULT 'MANUAL',
    "status" "IndicatorStatus" NOT NULL DEFAULT 'ACTIVE',
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "yellowToleranceP" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Indicator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndicatorTarget" (
    "id" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "periodRef" TEXT NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "lowerBound" DOUBLE PRECISION,
    "upperBound" DOUBLE PRECISION,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndicatorTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndicatorResult" (
    "id" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "periodRef" TEXT NOT NULL,
    "periodDate" TIMESTAMP(3) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "status" "ResultStatus" NOT NULL DEFAULT 'FILLED',
    "light" "TrafficLight" NOT NULL DEFAULT 'GRAY',
    "attainment" DOUBLE PRECISION,
    "deviationAbs" DOUBLE PRECISION,
    "deviationPct" DOUBLE PRECISION,
    "note" TEXT,
    "evidenceUrl" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndicatorResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndicatorTreeRelation" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "kind" "IndicatorRelationKind" NOT NULL DEFAULT 'POSITIVE',
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,

    CONSTRAINT "IndicatorTreeRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deviation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "periodRef" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "severity" "DeviationSeverity" NOT NULL DEFAULT 'MODERATE',
    "status" "DeviationStatus" NOT NULL DEFAULT 'OPEN',
    "method" "AnalysisMethod" NOT NULL DEFAULT 'FCA',
    "fact" TEXT,
    "rootCause" TEXT,
    "impact" TEXT,
    "responsibleUserId" TEXT,
    "dueDate" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Deviation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviationCause" (
    "id" TEXT NOT NULL,
    "deviationId" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviationCause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviationAnalysis" (
    "id" TEXT NOT NULL,
    "deviationId" TEXT NOT NULL,
    "method" "AnalysisMethod" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviationAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionPlan" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ownerNodeId" TEXT,
    "responsibleUserId" TEXT,
    "createdById" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "origin" "ActionOrigin" NOT NULL DEFAULT 'MANUAL',
    "originRefId" TEXT,
    "priority" "ActionPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "ActionStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimatedCost" DOUBLE PRECISION,
    "actualCost" DOUBLE PRECISION,
    "deviationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ActionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionTask" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "dueDate" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNED',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "responsible" TEXT,
    "budget" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMilestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProjectMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "responsible" TEXT,
    "dependencyId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProjectTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "MeetingKind" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "location" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingParticipant" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attended" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MeetingParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingAgendaItem" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "notes" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MeetingAgendaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingDecision" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "owner" TEXT,
    "dueDate" TIMESTAMP(3),

    CONSTRAINT "MeetingDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "refTable" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "refTable" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "target" "ImportTargetKind" NOT NULL,
    "fileName" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "okRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportError" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "status" "ImportRowStatus" NOT NULL DEFAULT 'ERROR',
    "payload" TEXT,

    CONSTRAINT "ImportError_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "payload" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_cnpj_key" ON "Company"("cnpj");

-- CreateIndex
CREATE INDEX "Branch_companyId_idx" ON "Branch"("companyId");

-- CreateIndex
CREATE INDEX "OrgNode_companyId_idx" ON "OrgNode"("companyId");

-- CreateIndex
CREATE INDEX "OrgNode_parentId_idx" ON "OrgNode"("parentId");

-- CreateIndex
CREATE INDEX "OrgNode_branchId_idx" ON "OrgNode"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_companyId_idx" ON "User"("companyId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "StrategicMap_companyId_idx" ON "StrategicMap"("companyId");

-- CreateIndex
CREATE INDEX "Perspective_mapId_idx" ON "Perspective"("mapId");

-- CreateIndex
CREATE INDEX "StrategicObjective_mapId_idx" ON "StrategicObjective"("mapId");

-- CreateIndex
CREATE INDEX "StrategicObjective_perspectiveId_idx" ON "StrategicObjective"("perspectiveId");

-- CreateIndex
CREATE UNIQUE INDEX "ObjectiveRelation_fromId_toId_key" ON "ObjectiveRelation"("fromId", "toId");

-- CreateIndex
CREATE INDEX "OKRCycle_companyId_idx" ON "OKRCycle"("companyId");

-- CreateIndex
CREATE INDEX "OKRObjective_cycleId_idx" ON "OKRObjective"("cycleId");

-- CreateIndex
CREATE INDEX "KeyResult_objectiveId_idx" ON "KeyResult"("objectiveId");

-- CreateIndex
CREATE INDEX "OKRCheckin_objectiveId_idx" ON "OKRCheckin"("objectiveId");

-- CreateIndex
CREATE INDEX "Indicator_companyId_idx" ON "Indicator"("companyId");

-- CreateIndex
CREATE INDEX "Indicator_ownerNodeId_idx" ON "Indicator"("ownerNodeId");

-- CreateIndex
CREATE INDEX "Indicator_type_idx" ON "Indicator"("type");

-- CreateIndex
CREATE INDEX "Indicator_status_idx" ON "Indicator"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Indicator_companyId_code_key" ON "Indicator"("companyId", "code");

-- CreateIndex
CREATE INDEX "IndicatorTarget_indicatorId_idx" ON "IndicatorTarget"("indicatorId");

-- CreateIndex
CREATE UNIQUE INDEX "IndicatorTarget_indicatorId_periodRef_key" ON "IndicatorTarget"("indicatorId", "periodRef");

-- CreateIndex
CREATE INDEX "IndicatorResult_indicatorId_periodDate_idx" ON "IndicatorResult"("indicatorId", "periodDate");

-- CreateIndex
CREATE INDEX "IndicatorResult_light_idx" ON "IndicatorResult"("light");

-- CreateIndex
CREATE UNIQUE INDEX "IndicatorResult_indicatorId_periodRef_key" ON "IndicatorResult"("indicatorId", "periodRef");

-- CreateIndex
CREATE UNIQUE INDEX "IndicatorTreeRelation_parentId_childId_key" ON "IndicatorTreeRelation"("parentId", "childId");

-- CreateIndex
CREATE INDEX "Deviation_companyId_idx" ON "Deviation"("companyId");

-- CreateIndex
CREATE INDEX "Deviation_indicatorId_idx" ON "Deviation"("indicatorId");

-- CreateIndex
CREATE UNIQUE INDEX "Deviation_companyId_number_key" ON "Deviation"("companyId", "number");

-- CreateIndex
CREATE INDEX "ActionPlan_companyId_idx" ON "ActionPlan"("companyId");

-- CreateIndex
CREATE INDEX "ActionPlan_status_idx" ON "ActionPlan"("status");

-- CreateIndex
CREATE INDEX "ActionPlan_dueDate_idx" ON "ActionPlan"("dueDate");

-- CreateIndex
CREATE INDEX "Project_companyId_idx" ON "Project"("companyId");

-- CreateIndex
CREATE INDEX "Meeting_companyId_idx" ON "Meeting"("companyId");

-- CreateIndex
CREATE INDEX "Meeting_startsAt_idx" ON "Meeting"("startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingParticipant_meetingId_userId_key" ON "MeetingParticipant"("meetingId", "userId");

-- CreateIndex
CREATE INDEX "Attachment_refTable_refId_idx" ON "Attachment"("refTable", "refId");

-- CreateIndex
CREATE INDEX "Comment_refTable_refId_idx" ON "Comment"("refTable", "refId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "ImportJob_companyId_idx" ON "ImportJob"("companyId");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_createdAt_idx" ON "AuditLog"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "AppSetting_companyId_key_key" ON "AppSetting"("companyId", "key");

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgNode" ADD CONSTRAINT "OrgNode_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgNode" ADD CONSTRAINT "OrgNode_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgNode" ADD CONSTRAINT "OrgNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "OrgNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgNode" ADD CONSTRAINT "OrgNode_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_defaultNodeId_fkey" FOREIGN KEY ("defaultNodeId") REFERENCES "OrgNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategicMap" ADD CONSTRAINT "StrategicMap_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Perspective" ADD CONSTRAINT "Perspective_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "StrategicMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategicObjective" ADD CONSTRAINT "StrategicObjective_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "StrategicMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategicObjective" ADD CONSTRAINT "StrategicObjective_perspectiveId_fkey" FOREIGN KEY ("perspectiveId") REFERENCES "Perspective"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObjectiveRelation" ADD CONSTRAINT "ObjectiveRelation_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "StrategicObjective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObjectiveRelation" ADD CONSTRAINT "ObjectiveRelation_toId_fkey" FOREIGN KEY ("toId") REFERENCES "StrategicObjective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OKRCycle" ADD CONSTRAINT "OKRCycle_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OKRObjective" ADD CONSTRAINT "OKRObjective_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "OKRCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OKRObjective" ADD CONSTRAINT "OKRObjective_strategicObjId_fkey" FOREIGN KEY ("strategicObjId") REFERENCES "StrategicObjective"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyResult" ADD CONSTRAINT "KeyResult_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "OKRObjective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OKRCheckin" ADD CONSTRAINT "OKRCheckin_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "OKRObjective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Indicator" ADD CONSTRAINT "Indicator_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Indicator" ADD CONSTRAINT "Indicator_ownerNodeId_fkey" FOREIGN KEY ("ownerNodeId") REFERENCES "OrgNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Indicator" ADD CONSTRAINT "Indicator_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Indicator" ADD CONSTRAINT "Indicator_feederUserId_fkey" FOREIGN KEY ("feederUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Indicator" ADD CONSTRAINT "Indicator_strategicObjectiveId_fkey" FOREIGN KEY ("strategicObjectiveId") REFERENCES "StrategicObjective"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndicatorTarget" ADD CONSTRAINT "IndicatorTarget_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "Indicator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndicatorResult" ADD CONSTRAINT "IndicatorResult_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "Indicator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndicatorResult" ADD CONSTRAINT "IndicatorResult_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndicatorTreeRelation" ADD CONSTRAINT "IndicatorTreeRelation_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Indicator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndicatorTreeRelation" ADD CONSTRAINT "IndicatorTreeRelation_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Indicator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deviation" ADD CONSTRAINT "Deviation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deviation" ADD CONSTRAINT "Deviation_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "Indicator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deviation" ADD CONSTRAINT "Deviation_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviationCause" ADD CONSTRAINT "DeviationCause_deviationId_fkey" FOREIGN KEY ("deviationId") REFERENCES "Deviation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviationAnalysis" ADD CONSTRAINT "DeviationAnalysis_deviationId_fkey" FOREIGN KEY ("deviationId") REFERENCES "Deviation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionPlan" ADD CONSTRAINT "ActionPlan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionPlan" ADD CONSTRAINT "ActionPlan_ownerNodeId_fkey" FOREIGN KEY ("ownerNodeId") REFERENCES "OrgNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionPlan" ADD CONSTRAINT "ActionPlan_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionPlan" ADD CONSTRAINT "ActionPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionPlan" ADD CONSTRAINT "ActionPlan_deviationId_fkey" FOREIGN KEY ("deviationId") REFERENCES "Deviation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTask" ADD CONSTRAINT "ActionTask_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "ActionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMilestone" ADD CONSTRAINT "ProjectMilestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_dependencyId_fkey" FOREIGN KEY ("dependencyId") REFERENCES "ProjectTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingParticipant" ADD CONSTRAINT "MeetingParticipant_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingParticipant" ADD CONSTRAINT "MeetingParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAgendaItem" ADD CONSTRAINT "MeetingAgendaItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingDecision" ADD CONSTRAINT "MeetingDecision_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportError" ADD CONSTRAINT "ImportError_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppSetting" ADD CONSTRAINT "AppSetting_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
