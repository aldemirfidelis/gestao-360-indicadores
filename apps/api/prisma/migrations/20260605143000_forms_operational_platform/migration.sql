-- CreateEnum
CREATE TYPE "FormScheduleStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FormExecutionStatus" AS ENUM ('PLANNED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_APPROVAL', 'COMPLETED', 'CLOSED', 'CANCELLED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "FormOperationalRecordStatus" AS ENUM ('OPEN', 'COMPLETED', 'VALIDATED', 'ARCHIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FormIssueStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_ACTION', 'RESOLVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FormEvidenceStatus" AS ENUM ('ACTIVE', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "FormApprovalDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ADJUSTMENTS_REQUESTED');

-- CreateEnum
CREATE TYPE "FormExternalLinkStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "FormOfflineSyncStatus" AS ENUM ('PENDING', 'SYNCED', 'CONFLICT', 'ERROR');

-- CreateEnum
CREATE TYPE "FormAiSuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'APPLIED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FormFieldType" ADD VALUE 'TITLE';
ALTER TYPE "FormFieldType" ADD VALUE 'SUBTITLE';
ALTER TYPE "FormFieldType" ADD VALUE 'INFO';
ALTER TYPE "FormFieldType" ADD VALUE 'WARNING';
ALTER TYPE "FormFieldType" ADD VALUE 'RICH_TEXT';
ALTER TYPE "FormFieldType" ADD VALUE 'INTEGER';
ALTER TYPE "FormFieldType" ADD VALUE 'DECIMAL';
ALTER TYPE "FormFieldType" ADD VALUE 'CURRENCY';
ALTER TYPE "FormFieldType" ADD VALUE 'PERCENT';
ALTER TYPE "FormFieldType" ADD VALUE 'SCORE';
ALTER TYPE "FormFieldType" ADD VALUE 'SCALE';
ALTER TYPE "FormFieldType" ADD VALUE 'MEASUREMENT';
ALTER TYPE "FormFieldType" ADD VALUE 'TEMPERATURE';
ALTER TYPE "FormFieldType" ADD VALUE 'DURATION';
ALTER TYPE "FormFieldType" ADD VALUE 'TIME';
ALTER TYPE "FormFieldType" ADD VALUE 'DATETIME';
ALTER TYPE "FormFieldType" ADD VALUE 'PERIOD';
ALTER TYPE "FormFieldType" ADD VALUE 'MONTH';
ALTER TYPE "FormFieldType" ADD VALUE 'YEAR';
ALTER TYPE "FormFieldType" ADD VALUE 'YES_NO';
ALTER TYPE "FormFieldType" ADD VALUE 'CONFORMITY';
ALTER TYPE "FormFieldType" ADD VALUE 'RADIO';
ALTER TYPE "FormFieldType" ADD VALUE 'CHECKBOX';
ALTER TYPE "FormFieldType" ADD VALUE 'LIKERT';
ALTER TYPE "FormFieldType" ADD VALUE 'STARS';
ALTER TYPE "FormFieldType" ADD VALUE 'STATUS';
ALTER TYPE "FormFieldType" ADD VALUE 'MATRIX';
ALTER TYPE "FormFieldType" ADD VALUE 'TABLE';
ALTER TYPE "FormFieldType" ADD VALUE 'USER';
ALTER TYPE "FormFieldType" ADD VALUE 'TEAM';
ALTER TYPE "FormFieldType" ADD VALUE 'COMPANY';
ALTER TYPE "FormFieldType" ADD VALUE 'BRANCH';
ALTER TYPE "FormFieldType" ADD VALUE 'ORG_NODE';
ALTER TYPE "FormFieldType" ADD VALUE 'PROCESS';
ALTER TYPE "FormFieldType" ADD VALUE 'PROJECT';
ALTER TYPE "FormFieldType" ADD VALUE 'SUPPLIER';
ALTER TYPE "FormFieldType" ADD VALUE 'DOCUMENT';
ALTER TYPE "FormFieldType" ADD VALUE 'RISK';
ALTER TYPE "FormFieldType" ADD VALUE 'INDICATOR';
ALTER TYPE "FormFieldType" ADD VALUE 'ACTION_PLAN';
ALTER TYPE "FormFieldType" ADD VALUE 'AUDIT';
ALTER TYPE "FormFieldType" ADD VALUE 'NON_CONFORMITY';
ALTER TYPE "FormFieldType" ADD VALUE 'ATTACHMENT';
ALTER TYPE "FormFieldType" ADD VALUE 'PHOTO';
ALTER TYPE "FormFieldType" ADD VALUE 'VIDEO';
ALTER TYPE "FormFieldType" ADD VALUE 'AUDIO';
ALTER TYPE "FormFieldType" ADD VALUE 'SIGNATURE';
ALTER TYPE "FormFieldType" ADD VALUE 'LINK';
ALTER TYPE "FormFieldType" ADD VALUE 'QR_CODE';
ALTER TYPE "FormFieldType" ADD VALUE 'BARCODE';
ALTER TYPE "FormFieldType" ADD VALUE 'LOCATION';
ALTER TYPE "FormFieldType" ADD VALUE 'MAP';
ALTER TYPE "FormFieldType" ADD VALUE 'ASSET';
ALTER TYPE "FormFieldType" ADD VALUE 'VEHICLE';
ALTER TYPE "FormFieldType" ADD VALUE 'AUTO_CODE';
ALTER TYPE "FormFieldType" ADD VALUE 'SECTION';
ALTER TYPE "FormFieldType" ADD VALUE 'PAGE';
ALTER TYPE "FormFieldType" ADD VALUE 'GROUP';
ALTER TYPE "FormFieldType" ADD VALUE 'TABS';
ALTER TYPE "FormFieldType" ADD VALUE 'ACCORDION';
ALTER TYPE "FormFieldType" ADD VALUE 'REPEATER';
ALTER TYPE "FormFieldType" ADD VALUE 'SUBFORM';
ALTER TYPE "FormFieldType" ADD VALUE 'FORMULA';
ALTER TYPE "FormFieldType" ADD VALUE 'CALCULATED';
ALTER TYPE "FormFieldType" ADD VALUE 'APPROVAL_BLOCK';
ALTER TYPE "FormFieldType" ADD VALUE 'EVIDENCE_BLOCK';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FormSubmissionStatus" ADD VALUE 'ASSIGNED';
ALTER TYPE "FormSubmissionStatus" ADD VALUE 'IN_PROGRESS';
ALTER TYPE "FormSubmissionStatus" ADD VALUE 'WAITING_CORRECTION';
ALTER TYPE "FormSubmissionStatus" ADD VALUE 'WAITING_APPROVAL';
ALTER TYPE "FormSubmissionStatus" ADD VALUE 'APPROVED';
ALTER TYPE "FormSubmissionStatus" ADD VALUE 'REJECTED';
ALTER TYPE "FormSubmissionStatus" ADD VALUE 'CLOSED';
ALTER TYPE "FormSubmissionStatus" ADD VALUE 'CANCELLED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FormTemplateStatus" ADD VALUE 'IN_DEVELOPMENT';
ALTER TYPE "FormTemplateStatus" ADD VALUE 'WAITING_REVIEW';
ALTER TYPE "FormTemplateStatus" ADD VALUE 'IN_REVIEW';
ALTER TYPE "FormTemplateStatus" ADD VALUE 'ADJUSTMENTS_REQUESTED';
ALTER TYPE "FormTemplateStatus" ADD VALUE 'WAITING_APPROVAL';
ALTER TYPE "FormTemplateStatus" ADD VALUE 'APPROVED';
ALTER TYPE "FormTemplateStatus" ADD VALUE 'PUBLISHED';
ALTER TYPE "FormTemplateStatus" ADD VALUE 'SUSPENDED';
ALTER TYPE "FormTemplateStatus" ADD VALUE 'OBSOLETE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FormTemplateType" ADD VALUE 'OPERATIONAL_RECORD';
ALTER TYPE "FormTemplateType" ADD VALUE 'DAILY_RECORD';
ALTER TYPE "FormTemplateType" ADD VALUE 'SHIFT_LOG';
ALTER TYPE "FormTemplateType" ADD VALUE 'OCCURRENCE';
ALTER TYPE "FormTemplateType" ADD VALUE 'ROUND';
ALTER TYPE "FormTemplateType" ADD VALUE 'MAINTENANCE';
ALTER TYPE "FormTemplateType" ADD VALUE 'SAFETY';
ALTER TYPE "FormTemplateType" ADD VALUE 'QUALITY';
ALTER TYPE "FormTemplateType" ADD VALUE 'ENVIRONMENT';
ALTER TYPE "FormTemplateType" ADD VALUE 'HR';
ALTER TYPE "FormTemplateType" ADD VALUE 'SUPPLIER';
ALTER TYPE "FormTemplateType" ADD VALUE 'PROJECT';
ALTER TYPE "FormTemplateType" ADD VALUE 'EXTERNAL';
ALTER TYPE "FormTemplateType" ADD VALUE 'PUBLIC';

-- AlterTable
ALTER TABLE "FormAnswer" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "critical" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fieldCode" TEXT,
ADD COLUMN     "fieldOrder" INTEGER,
ADD COLUMN     "fieldType" TEXT,
ADD COLUMN     "parentAnswerId" TEXT,
ADD COLUMN     "requiresEvidence" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rowIndex" INTEGER,
ADD COLUMN     "score" DOUBLE PRECISION,
ADD COLUMN     "sectionId" TEXT,
ADD COLUMN     "valueDate" TIMESTAMP(3),
ADD COLUMN     "valueJson" JSONB,
ADD COLUMN     "valueNumber" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "FormField" ADD COLUMN     "code" TEXT,
ADD COLUMN     "commentRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "conditionalRules" JSONB,
ADD COLUMN     "criticality" TEXT,
ADD COLUMN     "dataSource" JSONB,
ADD COLUMN     "defaultValue" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "evidenceRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "formula" TEXT,
ADD COLUMN     "hidden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxLength" INTEGER,
ADD COLUMN     "maxValue" DOUBLE PRECISION,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "minLength" INTEGER,
ADD COLUMN     "minValue" DOUBLE PRECISION,
ADD COLUMN     "placeholder" TEXT,
ADD COLUMN     "readOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "repeatable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "score" DOUBLE PRECISION,
ADD COLUMN     "sectionId" TEXT,
ADD COLUMN     "templateVersionId" TEXT,
ADD COLUMN     "validation" JSONB,
ADD COLUMN     "weight" DOUBLE PRECISION NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "FormSubmission" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "assignedToId" TEXT,
ADD COLUMN     "classification" TEXT,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "deviceInfo" JSONB,
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "executionId" TEXT,
ADD COLUMN     "location" JSONB,
ADD COLUMN     "locked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "originEntityId" TEXT,
ADD COLUMN     "originEntityType" TEXT,
ADD COLUMN     "scheduledAt" TIMESTAMP(3),
ADD COLUMN     "score" DOUBLE PRECISION,
ADD COLUMN     "snapshot" JSONB,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "templateVersionId" TEXT;

-- AlterTable
ALTER TABLE "FormTemplate" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "confidentiality" TEXT NOT NULL DEFAULT 'INTERNAL',
ADD COLUMN     "currentVersionId" TEXT,
ADD COLUMN     "estimatedMinutes" INTEGER,
ADD COLUMN     "favorite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "folderId" TEXT,
ADD COLUMN     "formulas" JSONB,
ADD COLUMN     "globalTemplate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "instructions" TEXT,
ADD COLUMN     "integrations" JSONB,
ADD COLUMN     "obsoleteAt" TIMESTAMP(3),
ADD COLUMN     "parentTemplateId" TEXT,
ADD COLUMN     "permissions" JSONB,
ADD COLUMN     "printLayoutId" TEXT,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "publishedById" TEXT,
ADD COLUMN     "purpose" TEXT,
ADD COLUMN     "replacedById" TEXT,
ADD COLUMN     "retentionDays" INTEGER,
ADD COLUMN     "reusable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "reviewPeriodDays" INTEGER,
ADD COLUMN     "rules" JSONB,
ADD COLUMN     "settings" JSONB,
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "typeConfigId" TEXT,
ADD COLUMN     "updatedById" TEXT,
ADD COLUMN     "validFrom" TIMESTAMP(3),
ADD COLUMN     "validUntil" TIMESTAMP(3),
ADD COLUMN     "workflow" JSONB;

-- CreateTable
CREATE TABLE "FormTypeConfig" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "category" "FormTemplateType" NOT NULL DEFAULT 'FORM',
    "color" TEXT,
    "icon" TEXT,
    "purpose" TEXT,
    "defaultWorkflow" JSONB,
    "defaultPermissions" JSONB,
    "fillRules" JSONB,
    "approvalRules" JSONB,
    "printRules" JSONB,
    "reportTemplate" JSONB,
    "requiredFields" JSONB,
    "retentionDays" INTEGER,
    "confidentiality" TEXT NOT NULL DEFAULT 'INTERNAL',
    "integrations" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FormTypeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormCategory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FormCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormFolder" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "path" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FormFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormTag" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormTemplateTagRelation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormTemplateTagRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormTemplateVersion" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "versionLabel" TEXT NOT NULL,
    "code" TEXT,
    "status" "FormTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "changeReason" TEXT,
    "changeSummary" TEXT,
    "builderSnapshot" JSONB,
    "fieldsSnapshot" JSONB,
    "workflow" JSONB,
    "rules" JSONB,
    "formulas" JSONB,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FormTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormTemplateSection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersionId" TEXT,
    "parentSectionId" TEXT,
    "code" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "columns" INTEGER NOT NULL DEFAULT 1,
    "repeatable" BOOLEAN NOT NULL DEFAULT false,
    "collapsed" BOOLEAN NOT NULL DEFAULT false,
    "visibleWhen" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FormTemplateSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormFieldOption" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "color" TEXT,
    "score" DOUBLE PRECISION,
    "position" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormFieldOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormReusableBlock" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "categoryId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "blockType" TEXT NOT NULL DEFAULT 'SECTION',
    "fields" JSONB,
    "rules" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FormReusableBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormTemplateRule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersionId" TEXT,
    "name" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "condition" JSONB,
    "actions" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FormTemplateRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormTemplateFormula" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersionId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expression" TEXT NOT NULL,
    "resultFieldCode" TEXT,
    "variables" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FormTemplateFormula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormWorkflow" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "templateId" TEXT,
    "name" TEXT NOT NULL,
    "entityType" TEXT NOT NULL DEFAULT 'FORM_SUBMISSION',
    "mode" TEXT NOT NULL DEFAULT 'SEQUENTIAL',
    "steps" JSONB,
    "transitions" JSONB,
    "rules" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FormWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormPermission" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "templateId" TEXT,
    "userId" TEXT,
    "orgNodeId" TEXT,
    "groupId" TEXT,
    "role" TEXT,
    "permission" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormPrintLayout" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "templateId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "layout" JSONB,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FormPrintLayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormSchedule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "FormScheduleStatus" NOT NULL DEFAULT 'ACTIVE',
    "frequency" TEXT NOT NULL,
    "cronExpression" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "timezone" TEXT,
    "assigneeUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "orgNodeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "processIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetRules" JSONB,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FormSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormExecution" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersionId" TEXT,
    "scheduleId" TEXT,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "FormExecutionStatus" NOT NULL DEFAULT 'PLANNED',
    "targetEntityType" TEXT,
    "targetEntityId" TEXT,
    "assignedToId" TEXT,
    "assignedTeamId" TEXT,
    "orgNodeId" TEXT,
    "processId" TEXT,
    "indicatorId" TEXT,
    "dueDate" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "score" DOUBLE PRECISION,
    "classification" TEXT,
    "autosaveToken" TEXT,
    "offlineEnabled" BOOLEAN NOT NULL DEFAULT false,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "snapshot" JSONB,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FormExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormExecutionAssignment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "userId" TEXT,
    "teamId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'EXECUTOR',
    "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "createdById" TEXT,

    CONSTRAINT "FormExecutionAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormExecutionResponseItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "submissionId" TEXT,
    "fieldId" TEXT,
    "fieldCode" TEXT,
    "fieldLabel" TEXT NOT NULL,
    "valueText" TEXT,
    "valueJson" JSONB,
    "valueNumber" DOUBLE PRECISION,
    "valueDate" TIMESTAMP(3),
    "score" DOUBLE PRECISION,
    "comment" TEXT,
    "attachments" JSONB,
    "evidenceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "answeredById" TEXT,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormExecutionResponseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormEvidence" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "submissionId" TEXT,
    "executionId" TEXT,
    "issueId" TEXT,
    "code" TEXT NOT NULL,
    "fileName" TEXT,
    "fileUrl" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "hashSha256" TEXT,
    "description" TEXT,
    "type" TEXT,
    "origin" TEXT,
    "authorUserId" TEXT,
    "location" JSONB,
    "metadata" JSONB,
    "status" "FormEvidenceStatus" NOT NULL DEFAULT 'ACTIVE',
    "storageProvider" TEXT,
    "storageKey" TEXT,
    "retentionUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FormEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormSignature" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "signerUserId" TEXT,
    "signerName" TEXT NOT NULL,
    "signerEmail" TEXT,
    "role" TEXT,
    "method" TEXT NOT NULL DEFAULT 'ELECTRONIC',
    "signatureKey" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormSignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormApproval" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "templateVersionId" TEXT,
    "stage" TEXT NOT NULL,
    "decision" "FormApprovalDecision" NOT NULL DEFAULT 'PENDING',
    "approverUserId" TEXT,
    "approvalOrder" INTEGER NOT NULL DEFAULT 1,
    "statusFrom" TEXT,
    "statusTo" TEXT,
    "comment" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormOperationalRecord" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "submissionId" TEXT,
    "executionId" TEXT,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "FormOperationalRecordStatus" NOT NULL DEFAULT 'OPEN',
    "recordDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodRef" TEXT,
    "orgNodeId" TEXT,
    "processId" TEXT,
    "indicatorId" TEXT,
    "targetEntityType" TEXT,
    "targetEntityId" TEXT,
    "summary" TEXT,
    "score" DOUBLE PRECISION,
    "classification" TEXT,
    "data" JSONB,
    "immutableSnapshot" JSONB,
    "createdById" TEXT,
    "validatedById" TEXT,
    "validatedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FormOperationalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormRecordCorrection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "requestedById" TEXT,
    "assignedToId" TEXT,
    "reason" TEXT NOT NULL,
    "beforeValue" JSONB,
    "afterValue" JSONB,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormRecordCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormRecordTimeline" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "recordId" TEXT,
    "submissionId" TEXT,
    "executionId" TEXT,
    "issueId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "beforeValue" JSONB,
    "afterValue" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormRecordTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormIssue" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "templateId" TEXT,
    "submissionId" TEXT,
    "executionId" TEXT,
    "recordId" TEXT,
    "actionPlanId" TEXT,
    "nonConformityId" TEXT,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "FormIssueStatus" NOT NULL DEFAULT 'OPEN',
    "severity" TEXT,
    "fieldCode" TEXT,
    "responsibleUserId" TEXT,
    "dueDate" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FormIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormExternalLink" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "FormExternalLinkStatus" NOT NULL DEFAULT 'ACTIVE',
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "maxUses" INTEGER,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "allowedDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "createdById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormExternalLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormQrCode" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT,
    "targetUrl" TEXT,
    "targetEntityType" TEXT,
    "targetEntityId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FormQrCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormKiosk" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "templateId" TEXT,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "deviceCode" TEXT,
    "settings" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FormKiosk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormOfflineSyncQueue" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "deviceId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "operation" TEXT NOT NULL,
    "payload" JSONB,
    "status" "FormOfflineSyncStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormOfflineSyncQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormOfflineSyncConflict" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "queueId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "localValue" JSONB,
    "serverValue" JSONB,
    "resolution" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormOfflineSyncConflict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormNotificationRule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FormNotificationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormExportJob" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "filters" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "fileUrl" TEXT,
    "errorMessage" TEXT,
    "requestedById" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormExportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormImportJob" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "fileName" TEXT,
    "fileUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "importedRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "requestedById" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormAiSuggestion" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "templateId" TEXT,
    "submissionId" TEXT,
    "suggestionType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "context" JSONB,
    "status" "FormAiSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,

    CONSTRAINT "FormAiSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormRetentionPolicy" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "typeConfigId" TEXT,
    "templateId" TEXT,
    "name" TEXT NOT NULL,
    "retentionDays" INTEGER,
    "disposition" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FormRetentionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FormTypeConfig_companyId_idx" ON "FormTypeConfig"("companyId");

-- CreateIndex
CREATE INDEX "FormTypeConfig_companyId_active_idx" ON "FormTypeConfig"("companyId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "FormTypeConfig_companyId_code_key" ON "FormTypeConfig"("companyId", "code");

-- CreateIndex
CREATE INDEX "FormCategory_companyId_active_idx" ON "FormCategory"("companyId", "active");

-- CreateIndex
CREATE INDEX "FormCategory_parentId_idx" ON "FormCategory"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "FormCategory_companyId_name_key" ON "FormCategory"("companyId", "name");

-- CreateIndex
CREATE INDEX "FormFolder_companyId_active_idx" ON "FormFolder"("companyId", "active");

-- CreateIndex
CREATE INDEX "FormFolder_parentId_idx" ON "FormFolder"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "FormFolder_companyId_name_parentId_key" ON "FormFolder"("companyId", "name", "parentId");

-- CreateIndex
CREATE INDEX "FormTag_companyId_idx" ON "FormTag"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "FormTag_companyId_name_key" ON "FormTag"("companyId", "name");

-- CreateIndex
CREATE INDEX "FormTemplateTagRelation_companyId_tagId_idx" ON "FormTemplateTagRelation"("companyId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "FormTemplateTagRelation_templateId_tagId_key" ON "FormTemplateTagRelation"("templateId", "tagId");

-- CreateIndex
CREATE INDEX "FormTemplateVersion_companyId_status_idx" ON "FormTemplateVersion"("companyId", "status");

-- CreateIndex
CREATE INDEX "FormTemplateVersion_templateId_createdAt_idx" ON "FormTemplateVersion"("templateId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FormTemplateVersion_templateId_versionNumber_key" ON "FormTemplateVersion"("templateId", "versionNumber");

-- CreateIndex
CREATE INDEX "FormTemplateSection_companyId_idx" ON "FormTemplateSection"("companyId");

-- CreateIndex
CREATE INDEX "FormTemplateSection_templateId_position_idx" ON "FormTemplateSection"("templateId", "position");

-- CreateIndex
CREATE INDEX "FormTemplateSection_templateVersionId_idx" ON "FormTemplateSection"("templateVersionId");

-- CreateIndex
CREATE INDEX "FormTemplateSection_parentSectionId_idx" ON "FormTemplateSection"("parentSectionId");

-- CreateIndex
CREATE INDEX "FormFieldOption_companyId_idx" ON "FormFieldOption"("companyId");

-- CreateIndex
CREATE INDEX "FormFieldOption_fieldId_position_idx" ON "FormFieldOption"("fieldId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "FormFieldOption_fieldId_value_key" ON "FormFieldOption"("fieldId", "value");

-- CreateIndex
CREATE INDEX "FormReusableBlock_companyId_active_idx" ON "FormReusableBlock"("companyId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "FormReusableBlock_companyId_name_key" ON "FormReusableBlock"("companyId", "name");

-- CreateIndex
CREATE INDEX "FormTemplateRule_companyId_active_idx" ON "FormTemplateRule"("companyId", "active");

-- CreateIndex
CREATE INDEX "FormTemplateRule_templateId_idx" ON "FormTemplateRule"("templateId");

-- CreateIndex
CREATE INDEX "FormTemplateRule_templateVersionId_idx" ON "FormTemplateRule"("templateVersionId");

-- CreateIndex
CREATE INDEX "FormTemplateFormula_companyId_active_idx" ON "FormTemplateFormula"("companyId", "active");

-- CreateIndex
CREATE INDEX "FormTemplateFormula_templateVersionId_idx" ON "FormTemplateFormula"("templateVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "FormTemplateFormula_templateId_code_key" ON "FormTemplateFormula"("templateId", "code");

-- CreateIndex
CREATE INDEX "FormWorkflow_companyId_active_idx" ON "FormWorkflow"("companyId", "active");

-- CreateIndex
CREATE INDEX "FormWorkflow_templateId_idx" ON "FormWorkflow"("templateId");

-- CreateIndex
CREATE INDEX "FormPermission_companyId_permission_idx" ON "FormPermission"("companyId", "permission");

-- CreateIndex
CREATE INDEX "FormPermission_templateId_idx" ON "FormPermission"("templateId");

-- CreateIndex
CREATE INDEX "FormPermission_userId_idx" ON "FormPermission"("userId");

-- CreateIndex
CREATE INDEX "FormPermission_orgNodeId_idx" ON "FormPermission"("orgNodeId");

-- CreateIndex
CREATE INDEX "FormPrintLayout_companyId_active_idx" ON "FormPrintLayout"("companyId", "active");

-- CreateIndex
CREATE INDEX "FormPrintLayout_templateId_isDefault_idx" ON "FormPrintLayout"("templateId", "isDefault");

-- CreateIndex
CREATE INDEX "FormSchedule_companyId_status_idx" ON "FormSchedule"("companyId", "status");

-- CreateIndex
CREATE INDEX "FormSchedule_templateId_idx" ON "FormSchedule"("templateId");

-- CreateIndex
CREATE INDEX "FormSchedule_nextRunAt_idx" ON "FormSchedule"("nextRunAt");

-- CreateIndex
CREATE INDEX "FormExecution_companyId_status_idx" ON "FormExecution"("companyId", "status");

-- CreateIndex
CREATE INDEX "FormExecution_templateId_idx" ON "FormExecution"("templateId");

-- CreateIndex
CREATE INDEX "FormExecution_templateVersionId_idx" ON "FormExecution"("templateVersionId");

-- CreateIndex
CREATE INDEX "FormExecution_scheduleId_idx" ON "FormExecution"("scheduleId");

-- CreateIndex
CREATE INDEX "FormExecution_assignedToId_idx" ON "FormExecution"("assignedToId");

-- CreateIndex
CREATE INDEX "FormExecution_dueDate_idx" ON "FormExecution"("dueDate");

-- CreateIndex
CREATE INDEX "FormExecution_targetEntityType_targetEntityId_idx" ON "FormExecution"("targetEntityType", "targetEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "FormExecution_companyId_code_key" ON "FormExecution"("companyId", "code");

-- CreateIndex
CREATE INDEX "FormExecutionAssignment_companyId_status_idx" ON "FormExecutionAssignment"("companyId", "status");

-- CreateIndex
CREATE INDEX "FormExecutionAssignment_executionId_idx" ON "FormExecutionAssignment"("executionId");

-- CreateIndex
CREATE INDEX "FormExecutionAssignment_userId_idx" ON "FormExecutionAssignment"("userId");

-- CreateIndex
CREATE INDEX "FormExecutionResponseItem_companyId_idx" ON "FormExecutionResponseItem"("companyId");

-- CreateIndex
CREATE INDEX "FormExecutionResponseItem_executionId_idx" ON "FormExecutionResponseItem"("executionId");

-- CreateIndex
CREATE INDEX "FormExecutionResponseItem_submissionId_idx" ON "FormExecutionResponseItem"("submissionId");

-- CreateIndex
CREATE INDEX "FormExecutionResponseItem_fieldId_idx" ON "FormExecutionResponseItem"("fieldId");

-- CreateIndex
CREATE INDEX "FormExecutionResponseItem_fieldCode_idx" ON "FormExecutionResponseItem"("fieldCode");

-- CreateIndex
CREATE INDEX "FormEvidence_companyId_idx" ON "FormEvidence"("companyId");

-- CreateIndex
CREATE INDEX "FormEvidence_submissionId_idx" ON "FormEvidence"("submissionId");

-- CreateIndex
CREATE INDEX "FormEvidence_executionId_idx" ON "FormEvidence"("executionId");

-- CreateIndex
CREATE INDEX "FormEvidence_issueId_idx" ON "FormEvidence"("issueId");

-- CreateIndex
CREATE INDEX "FormEvidence_status_idx" ON "FormEvidence"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FormEvidence_companyId_code_key" ON "FormEvidence"("companyId", "code");

-- CreateIndex
CREATE INDEX "FormSignature_companyId_idx" ON "FormSignature"("companyId");

-- CreateIndex
CREATE INDEX "FormSignature_submissionId_idx" ON "FormSignature"("submissionId");

-- CreateIndex
CREATE INDEX "FormSignature_signerUserId_idx" ON "FormSignature"("signerUserId");

-- CreateIndex
CREATE INDEX "FormApproval_companyId_decision_idx" ON "FormApproval"("companyId", "decision");

-- CreateIndex
CREATE INDEX "FormApproval_submissionId_approvalOrder_idx" ON "FormApproval"("submissionId", "approvalOrder");

-- CreateIndex
CREATE INDEX "FormApproval_templateVersionId_idx" ON "FormApproval"("templateVersionId");

-- CreateIndex
CREATE INDEX "FormApproval_approverUserId_idx" ON "FormApproval"("approverUserId");

-- CreateIndex
CREATE UNIQUE INDEX "FormOperationalRecord_submissionId_key" ON "FormOperationalRecord"("submissionId");

-- CreateIndex
CREATE INDEX "FormOperationalRecord_companyId_status_idx" ON "FormOperationalRecord"("companyId", "status");

-- CreateIndex
CREATE INDEX "FormOperationalRecord_templateId_idx" ON "FormOperationalRecord"("templateId");

-- CreateIndex
CREATE INDEX "FormOperationalRecord_executionId_idx" ON "FormOperationalRecord"("executionId");

-- CreateIndex
CREATE INDEX "FormOperationalRecord_recordDate_idx" ON "FormOperationalRecord"("recordDate");

-- CreateIndex
CREATE INDEX "FormOperationalRecord_orgNodeId_idx" ON "FormOperationalRecord"("orgNodeId");

-- CreateIndex
CREATE INDEX "FormOperationalRecord_processId_idx" ON "FormOperationalRecord"("processId");

-- CreateIndex
CREATE UNIQUE INDEX "FormOperationalRecord_companyId_code_key" ON "FormOperationalRecord"("companyId", "code");

-- CreateIndex
CREATE INDEX "FormRecordCorrection_companyId_status_idx" ON "FormRecordCorrection"("companyId", "status");

-- CreateIndex
CREATE INDEX "FormRecordCorrection_recordId_idx" ON "FormRecordCorrection"("recordId");

-- CreateIndex
CREATE INDEX "FormRecordCorrection_assignedToId_idx" ON "FormRecordCorrection"("assignedToId");

-- CreateIndex
CREATE INDEX "FormRecordTimeline_companyId_createdAt_idx" ON "FormRecordTimeline"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "FormRecordTimeline_recordId_createdAt_idx" ON "FormRecordTimeline"("recordId", "createdAt");

-- CreateIndex
CREATE INDEX "FormRecordTimeline_submissionId_createdAt_idx" ON "FormRecordTimeline"("submissionId", "createdAt");

-- CreateIndex
CREATE INDEX "FormRecordTimeline_executionId_createdAt_idx" ON "FormRecordTimeline"("executionId", "createdAt");

-- CreateIndex
CREATE INDEX "FormRecordTimeline_issueId_idx" ON "FormRecordTimeline"("issueId");

-- CreateIndex
CREATE INDEX "FormIssue_companyId_status_idx" ON "FormIssue"("companyId", "status");

-- CreateIndex
CREATE INDEX "FormIssue_templateId_idx" ON "FormIssue"("templateId");

-- CreateIndex
CREATE INDEX "FormIssue_submissionId_idx" ON "FormIssue"("submissionId");

-- CreateIndex
CREATE INDEX "FormIssue_executionId_idx" ON "FormIssue"("executionId");

-- CreateIndex
CREATE INDEX "FormIssue_recordId_idx" ON "FormIssue"("recordId");

-- CreateIndex
CREATE INDEX "FormIssue_actionPlanId_idx" ON "FormIssue"("actionPlanId");

-- CreateIndex
CREATE INDEX "FormIssue_nonConformityId_idx" ON "FormIssue"("nonConformityId");

-- CreateIndex
CREATE INDEX "FormIssue_responsibleUserId_idx" ON "FormIssue"("responsibleUserId");

-- CreateIndex
CREATE INDEX "FormIssue_dueDate_idx" ON "FormIssue"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "FormIssue_companyId_code_key" ON "FormIssue"("companyId", "code");

-- CreateIndex
CREATE INDEX "FormExternalLink_companyId_status_idx" ON "FormExternalLink"("companyId", "status");

-- CreateIndex
CREATE INDEX "FormExternalLink_templateId_idx" ON "FormExternalLink"("templateId");

-- CreateIndex
CREATE INDEX "FormExternalLink_validUntil_idx" ON "FormExternalLink"("validUntil");

-- CreateIndex
CREATE UNIQUE INDEX "FormExternalLink_tokenHash_key" ON "FormExternalLink"("tokenHash");

-- CreateIndex
CREATE INDEX "FormQrCode_companyId_active_idx" ON "FormQrCode"("companyId", "active");

-- CreateIndex
CREATE INDEX "FormQrCode_templateId_idx" ON "FormQrCode"("templateId");

-- CreateIndex
CREATE INDEX "FormQrCode_targetEntityType_targetEntityId_idx" ON "FormQrCode"("targetEntityType", "targetEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "FormQrCode_companyId_code_key" ON "FormQrCode"("companyId", "code");

-- CreateIndex
CREATE INDEX "FormKiosk_companyId_active_idx" ON "FormKiosk"("companyId", "active");

-- CreateIndex
CREATE INDEX "FormKiosk_templateId_idx" ON "FormKiosk"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "FormKiosk_companyId_name_key" ON "FormKiosk"("companyId", "name");

-- CreateIndex
CREATE INDEX "FormOfflineSyncQueue_companyId_status_idx" ON "FormOfflineSyncQueue"("companyId", "status");

-- CreateIndex
CREATE INDEX "FormOfflineSyncQueue_userId_idx" ON "FormOfflineSyncQueue"("userId");

-- CreateIndex
CREATE INDEX "FormOfflineSyncQueue_deviceId_idx" ON "FormOfflineSyncQueue"("deviceId");

-- CreateIndex
CREATE INDEX "FormOfflineSyncQueue_entityType_entityId_idx" ON "FormOfflineSyncQueue"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "FormOfflineSyncConflict_companyId_idx" ON "FormOfflineSyncConflict"("companyId");

-- CreateIndex
CREATE INDEX "FormOfflineSyncConflict_queueId_idx" ON "FormOfflineSyncConflict"("queueId");

-- CreateIndex
CREATE INDEX "FormOfflineSyncConflict_entityType_entityId_idx" ON "FormOfflineSyncConflict"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "FormNotificationRule_companyId_event_idx" ON "FormNotificationRule"("companyId", "event");

-- CreateIndex
CREATE INDEX "FormNotificationRule_companyId_active_idx" ON "FormNotificationRule"("companyId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "FormNotificationRule_companyId_name_key" ON "FormNotificationRule"("companyId", "name");

-- CreateIndex
CREATE INDEX "FormExportJob_companyId_status_idx" ON "FormExportJob"("companyId", "status");

-- CreateIndex
CREATE INDEX "FormExportJob_requestedById_idx" ON "FormExportJob"("requestedById");

-- CreateIndex
CREATE INDEX "FormExportJob_createdAt_idx" ON "FormExportJob"("createdAt");

-- CreateIndex
CREATE INDEX "FormImportJob_companyId_status_idx" ON "FormImportJob"("companyId", "status");

-- CreateIndex
CREATE INDEX "FormImportJob_requestedById_idx" ON "FormImportJob"("requestedById");

-- CreateIndex
CREATE INDEX "FormAiSuggestion_companyId_status_idx" ON "FormAiSuggestion"("companyId", "status");

-- CreateIndex
CREATE INDEX "FormAiSuggestion_templateId_createdAt_idx" ON "FormAiSuggestion"("templateId", "createdAt");

-- CreateIndex
CREATE INDEX "FormAiSuggestion_submissionId_createdAt_idx" ON "FormAiSuggestion"("submissionId", "createdAt");

-- CreateIndex
CREATE INDEX "FormRetentionPolicy_companyId_active_idx" ON "FormRetentionPolicy"("companyId", "active");

-- CreateIndex
CREATE INDEX "FormRetentionPolicy_typeConfigId_idx" ON "FormRetentionPolicy"("typeConfigId");

-- CreateIndex
CREATE INDEX "FormRetentionPolicy_templateId_idx" ON "FormRetentionPolicy"("templateId");

-- CreateIndex
CREATE INDEX "FormAnswer_sectionId_idx" ON "FormAnswer"("sectionId");

-- CreateIndex
CREATE INDEX "FormAnswer_fieldCode_idx" ON "FormAnswer"("fieldCode");

-- CreateIndex
CREATE INDEX "FormField_templateVersionId_idx" ON "FormField"("templateVersionId");

-- CreateIndex
CREATE INDEX "FormField_sectionId_idx" ON "FormField"("sectionId");

-- CreateIndex
CREATE INDEX "FormField_code_idx" ON "FormField"("code");

-- CreateIndex
CREATE INDEX "FormSubmission_templateVersionId_idx" ON "FormSubmission"("templateVersionId");

-- CreateIndex
CREATE INDEX "FormSubmission_executionId_idx" ON "FormSubmission"("executionId");

-- CreateIndex
CREATE INDEX "FormSubmission_companyId_code_idx" ON "FormSubmission"("companyId", "code");

-- CreateIndex
CREATE INDEX "FormSubmission_assignedToId_idx" ON "FormSubmission"("assignedToId");

-- CreateIndex
CREATE INDEX "FormSubmission_dueDate_idx" ON "FormSubmission"("dueDate");

-- CreateIndex
CREATE INDEX "FormTemplate_companyId_code_idx" ON "FormTemplate"("companyId", "code");

-- CreateIndex
CREATE INDEX "FormTemplate_typeConfigId_idx" ON "FormTemplate"("typeConfigId");

-- CreateIndex
CREATE INDEX "FormTemplate_categoryId_idx" ON "FormTemplate"("categoryId");

-- CreateIndex
CREATE INDEX "FormTemplate_folderId_idx" ON "FormTemplate"("folderId");

-- CreateIndex
CREATE INDEX "FormTemplate_currentVersionId_idx" ON "FormTemplate"("currentVersionId");

-- CreateIndex
CREATE INDEX "FormTemplate_validUntil_idx" ON "FormTemplate"("validUntil");

-- AddForeignKey
ALTER TABLE "FormTemplate" ADD CONSTRAINT "FormTemplate_typeConfigId_fkey" FOREIGN KEY ("typeConfigId") REFERENCES "FormTypeConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormTemplate" ADD CONSTRAINT "FormTemplate_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FormCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormTemplate" ADD CONSTRAINT "FormTemplate_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "FormFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormField" ADD CONSTRAINT "FormField_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "FormTemplateVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormField" ADD CONSTRAINT "FormField_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "FormTemplateSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "FormTemplateVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "FormExecution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormAnswer" ADD CONSTRAINT "FormAnswer_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "FormTemplateSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormCategory" ADD CONSTRAINT "FormCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "FormCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormFolder" ADD CONSTRAINT "FormFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "FormFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormTemplateTagRelation" ADD CONSTRAINT "FormTemplateTagRelation_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "FormTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormTemplateTagRelation" ADD CONSTRAINT "FormTemplateTagRelation_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "FormTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormTemplateVersion" ADD CONSTRAINT "FormTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "FormTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormTemplateSection" ADD CONSTRAINT "FormTemplateSection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "FormTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormTemplateSection" ADD CONSTRAINT "FormTemplateSection_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "FormTemplateVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormFieldOption" ADD CONSTRAINT "FormFieldOption_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "FormField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormTemplateRule" ADD CONSTRAINT "FormTemplateRule_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "FormTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormTemplateRule" ADD CONSTRAINT "FormTemplateRule_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "FormTemplateVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormTemplateFormula" ADD CONSTRAINT "FormTemplateFormula_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "FormTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormTemplateFormula" ADD CONSTRAINT "FormTemplateFormula_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "FormTemplateVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormWorkflow" ADD CONSTRAINT "FormWorkflow_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "FormTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormPermission" ADD CONSTRAINT "FormPermission_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "FormTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormPrintLayout" ADD CONSTRAINT "FormPrintLayout_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "FormTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSchedule" ADD CONSTRAINT "FormSchedule_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "FormTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormExecution" ADD CONSTRAINT "FormExecution_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "FormTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormExecution" ADD CONSTRAINT "FormExecution_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "FormTemplateVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormExecution" ADD CONSTRAINT "FormExecution_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "FormSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormExecutionAssignment" ADD CONSTRAINT "FormExecutionAssignment_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "FormExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormExecutionResponseItem" ADD CONSTRAINT "FormExecutionResponseItem_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "FormExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormExecutionResponseItem" ADD CONSTRAINT "FormExecutionResponseItem_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FormSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormExecutionResponseItem" ADD CONSTRAINT "FormExecutionResponseItem_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "FormField"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormEvidence" ADD CONSTRAINT "FormEvidence_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FormSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormEvidence" ADD CONSTRAINT "FormEvidence_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "FormExecution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormEvidence" ADD CONSTRAINT "FormEvidence_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "FormIssue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSignature" ADD CONSTRAINT "FormSignature_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FormSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormApproval" ADD CONSTRAINT "FormApproval_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FormSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormApproval" ADD CONSTRAINT "FormApproval_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "FormTemplateVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormOperationalRecord" ADD CONSTRAINT "FormOperationalRecord_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "FormTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormOperationalRecord" ADD CONSTRAINT "FormOperationalRecord_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FormSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormOperationalRecord" ADD CONSTRAINT "FormOperationalRecord_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "FormExecution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormRecordCorrection" ADD CONSTRAINT "FormRecordCorrection_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "FormOperationalRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormRecordTimeline" ADD CONSTRAINT "FormRecordTimeline_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "FormOperationalRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormRecordTimeline" ADD CONSTRAINT "FormRecordTimeline_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FormSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormRecordTimeline" ADD CONSTRAINT "FormRecordTimeline_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "FormExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormRecordTimeline" ADD CONSTRAINT "FormRecordTimeline_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "FormIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormIssue" ADD CONSTRAINT "FormIssue_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "FormTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormIssue" ADD CONSTRAINT "FormIssue_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FormSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormIssue" ADD CONSTRAINT "FormIssue_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "FormExecution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormIssue" ADD CONSTRAINT "FormIssue_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "FormOperationalRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormExternalLink" ADD CONSTRAINT "FormExternalLink_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "FormTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormQrCode" ADD CONSTRAINT "FormQrCode_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "FormTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormKiosk" ADD CONSTRAINT "FormKiosk_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "FormTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormOfflineSyncConflict" ADD CONSTRAINT "FormOfflineSyncConflict_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "FormOfflineSyncQueue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormAiSuggestion" ADD CONSTRAINT "FormAiSuggestion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "FormTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormAiSuggestion" ADD CONSTRAINT "FormAiSuggestion_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FormSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormRetentionPolicy" ADD CONSTRAINT "FormRetentionPolicy_typeConfigId_fkey" FOREIGN KEY ("typeConfigId") REFERENCES "FormTypeConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;
