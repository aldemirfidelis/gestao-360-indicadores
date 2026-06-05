-- CreateEnum
CREATE TYPE "AuditModality" AS ENUM ('PRESENTIAL', 'REMOTE', 'HYBRID');

-- CreateEnum
CREATE TYPE "AuditProgramStatus" AS ENUM ('DRAFT', 'WAITING_APPROVAL', 'APPROVED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AuditUniverseItemKind" AS ENUM ('COMPANY', 'BRANCH', 'AREA', 'SECTOR', 'PROCESS', 'SUBPROCESS', 'ACTIVITY', 'PROJECT', 'CONTRACT', 'SUPPLIER', 'OPERATIONAL_UNIT', 'DOCUMENT', 'LEGAL_REQUIREMENT', 'STANDARD', 'INTERNAL_CONTROL', 'RISK', 'INDICATOR', 'STRATEGIC_OBJECTIVE', 'STAKEHOLDER', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AuditRiskLevel" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AuditorKind" AS ENUM ('INTERNAL', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "AuditorStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AuditChecklistTemplateStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AuditChecklistResponseKind" AS ENUM ('CONFORMING', 'NONCONFORMING', 'PARTIALLY_CONFORMING', 'NOT_APPLICABLE', 'NOT_VERIFIED', 'PENDING_EVIDENCE', 'OPPORTUNITY', 'OBSERVATION', 'GOOD_PRACTICE');

-- CreateEnum
CREATE TYPE "AuditEvidenceStatus" AS ENUM ('ACTIVE', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AuditApprovalDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ADJUSTMENTS_REQUESTED');

-- CreateEnum
CREATE TYPE "AuditFollowUpStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'EFFECTIVE', 'INEFFECTIVE', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AuditAiSuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'APPLIED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditFindingStatus" ADD VALUE 'DRAFT';
ALTER TYPE "AuditFindingStatus" ADD VALUE 'UNDER_REVIEW';
ALTER TYPE "AuditFindingStatus" ADD VALUE 'WAITING_AUDITED_RESPONSE';
ALTER TYPE "AuditFindingStatus" ADD VALUE 'ACTION_REQUIRED';
ALTER TYPE "AuditFindingStatus" ADD VALUE 'CONVERTED_TO_NC';
ALTER TYPE "AuditFindingStatus" ADD VALUE 'IN_FOLLOW_UP';
ALTER TYPE "AuditFindingStatus" ADD VALUE 'CANCELLED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditFindingType" ADD VALUE 'PARTIAL_CONFORMITY';
ALTER TYPE "AuditFindingType" ADD VALUE 'STRENGTH';
ALTER TYPE "AuditFindingType" ADD VALUE 'GOOD_PRACTICE';
ALTER TYPE "AuditFindingType" ADD VALUE 'RECOMMENDATION';
ALTER TYPE "AuditFindingType" ADD VALUE 'IDENTIFIED_RISK';
ALTER TYPE "AuditFindingType" ADD VALUE 'DEVIATION';
ALTER TYPE "AuditFindingType" ADD VALUE 'MINOR_NONCONFORMITY';
ALTER TYPE "AuditFindingType" ADD VALUE 'MAJOR_NONCONFORMITY';
ALTER TYPE "AuditFindingType" ADD VALUE 'CRITICAL_NONCONFORMITY';
ALTER TYPE "AuditFindingType" ADD VALUE 'DOCUMENT_PENDING';
ALTER TYPE "AuditFindingType" ADD VALUE 'INSUFFICIENT_EVIDENCE';
ALTER TYPE "AuditFindingType" ADD VALUE 'NOT_VERIFIED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditStatus" ADD VALUE 'DRAFT';
ALTER TYPE "AuditStatus" ADD VALUE 'WAITING_APPROVAL';
ALTER TYPE "AuditStatus" ADD VALUE 'SCHEDULED';
ALTER TYPE "AuditStatus" ADD VALUE 'PREPARATION';
ALTER TYPE "AuditStatus" ADD VALUE 'READY_EXECUTION';
ALTER TYPE "AuditStatus" ADD VALUE 'WAITING_COMPLEMENT';
ALTER TYPE "AuditStatus" ADD VALUE 'LEAD_REVIEW';
ALTER TYPE "AuditStatus" ADD VALUE 'WAITING_AUDITED_RESPONSE';
ALTER TYPE "AuditStatus" ADD VALUE 'REPORT_ISSUED';
ALTER TYPE "AuditStatus" ADD VALUE 'FOLLOW_UP';
ALTER TYPE "AuditStatus" ADD VALUE 'CLOSED';
ALTER TYPE "AuditStatus" ADD VALUE 'SUSPENDED';
ALTER TYPE "AuditStatus" ADD VALUE 'RESCHEDULED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditType" ADD VALUE 'CERTIFICATION';
ALTER TYPE "AuditType" ADD VALUE 'MAINTENANCE';
ALTER TYPE "AuditType" ADD VALUE 'RECERTIFICATION';
ALTER TYPE "AuditType" ADD VALUE 'PRODUCT';
ALTER TYPE "AuditType" ADD VALUE 'MANAGEMENT_SYSTEM';
ALTER TYPE "AuditType" ADD VALUE 'DOCUMENTAL';
ALTER TYPE "AuditType" ADD VALUE 'OPERATIONAL';
ALTER TYPE "AuditType" ADD VALUE 'INTEGRATED';
ALTER TYPE "AuditType" ADD VALUE 'COMPLIANCE';
ALTER TYPE "AuditType" ADD VALUE 'INTERNAL_CONTROLS';
ALTER TYPE "AuditType" ADD VALUE 'PROJECT';
ALTER TYPE "AuditType" ADD VALUE 'EXTRAORDINARY';
ALTER TYPE "AuditType" ADD VALUE 'FOLLOW_UP';
ALTER TYPE "AuditType" ADD VALUE 'INSPECTION';
ALTER TYPE "AuditType" ADD VALUE 'DIAGNOSTIC';
ALTER TYPE "AuditType" ADD VALUE 'REMOTE';
ALTER TYPE "AuditType" ADD VALUE 'PRESENTIAL';
ALTER TYPE "AuditType" ADD VALUE 'HYBRID';

-- AlterTable
ALTER TABLE "Audit" ADD COLUMN     "actualHours" DOUBLE PRECISION,
ADD COLUMN     "agenda" JSONB,
ADD COLUMN     "approvers" JSONB,
ADD COLUMN     "auditees" JSONB,
ADD COLUMN     "cancelledReason" TEXT,
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "code" TEXT,
ADD COLUMN     "confidentiality" TEXT NOT NULL DEFAULT 'INTERNAL',
ADD COLUMN     "criteria" TEXT,
ADD COLUMN     "documents" JSONB,
ADD COLUMN     "estimatedHours" DOUBLE PRECISION,
ADD COLUMN     "executedAt" TIMESTAMP(3),
ADD COLUMN     "followUpPlan" TEXT,
ADD COLUMN     "locations" JSONB,
ADD COLUMN     "meetingUrl" TEXT,
ADD COLUMN     "methodology" TEXT,
ADD COLUMN     "modality" "AuditModality" NOT NULL DEFAULT 'PRESENTIAL',
ADD COLUMN     "objective" TEXT,
ADD COLUMN     "observers" JSONB,
ADD COLUMN     "opinion" TEXT,
ADD COLUMN     "origin" TEXT,
ADD COLUMN     "plannedEndAt" TIMESTAMP(3),
ADD COLUMN     "plannedStartAt" TIMESTAMP(3),
ADD COLUMN     "programId" TEXT,
ADD COLUMN     "requirements" JSONB,
ADD COLUMN     "rescheduleReason" TEXT,
ADD COLUMN     "result" TEXT,
ADD COLUMN     "risks" JSONB,
ADD COLUMN     "score" DOUBLE PRECISION,
ADD COLUMN     "standards" JSONB,
ADD COLUMN     "team" JSONB,
ADD COLUMN     "typeConfigId" TEXT,
ADD COLUMN     "universeItemId" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "AuditFinding" ADD COLUMN     "actionPlanIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "auditedUserId" TEXT,
ADD COLUMN     "auditorUserId" TEXT,
ADD COLUMN     "checklistExecutionId" TEXT,
ADD COLUMN     "checklistItemId" TEXT,
ADD COLUMN     "classificationId" TEXT,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "conditionFound" TEXT,
ADD COLUMN     "criticality" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "documentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "expectedCriteria" TEXT,
ADD COLUMN     "indicatorIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "orgNodeId" TEXT,
ADD COLUMN     "processId" TEXT,
ADD COLUMN     "recurrence" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requirementId" TEXT,
ADD COLUMN     "responsibleUserId" TEXT,
ADD COLUMN     "riskIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "riskImpact" TEXT,
ADD COLUMN     "similarFindingIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "standardId" TEXT,
ADD COLUMN     "supplierId" TEXT;

UPDATE "AuditFinding" AS f
SET "companyId" = a."companyId"
FROM "Audit" AS a
WHERE f."auditId" = a."id"
  AND f."companyId" IS NULL;

ALTER TABLE "AuditFinding" ALTER COLUMN "companyId" SET NOT NULL;

-- CreateTable
CREATE TABLE "AuditProgram" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "AuditProgramStatus" NOT NULL DEFAULT 'DRAFT',
    "cycleKind" TEXT,
    "branchId" TEXT,
    "ownerUserId" TEXT,
    "approverUserId" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "objectives" JSONB,
    "standards" JSONB,
    "orgNodeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "processIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "supplierIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "documentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "riskIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "indicatorIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "estimatedHours" DOUBLE PRECISION,
    "budget" DOUBLE PRECISION,
    "version" INTEGER NOT NULL DEFAULT 1,
    "attachments" JSONB,
    "comments" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AuditProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditProgramRevision" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "summary" TEXT,
    "snapshot" JSONB,
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditProgramRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditTypeConfig" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "description" TEXT,
    "category" "AuditType" NOT NULL DEFAULT 'INTERNAL',
    "defaultModality" "AuditModality" NOT NULL DEFAULT 'PRESENTIAL',
    "color" TEXT,
    "icon" TEXT,
    "codePattern" TEXT NOT NULL DEFAULT 'AUD-{{YEAR}}-{{SEQ}}',
    "digits" INTEGER NOT NULL DEFAULT 4,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "requiresChecklist" BOOLEAN NOT NULL DEFAULT false,
    "requiresLeadAuditor" BOOLEAN NOT NULL DEFAULT true,
    "allowsRemote" BOOLEAN NOT NULL DEFAULT true,
    "allowsMultipleStandards" BOOLEAN NOT NULL DEFAULT true,
    "workflow" JSONB,
    "rules" JSONB,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AuditTypeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditUniverseItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "AuditUniverseItemKind" NOT NULL DEFAULT 'AREA',
    "description" TEXT,
    "branchId" TEXT,
    "orgNodeId" TEXT,
    "processId" TEXT,
    "supplierId" TEXT,
    "documentId" TEXT,
    "riskId" TEXT,
    "indicatorId" TEXT,
    "strategicObjectiveId" TEXT,
    "ownerUserId" TEXT,
    "riskScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "riskLevel" "AuditRiskLevel" NOT NULL DEFAULT 'LOW',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "recommendedFrequencyDays" INTEGER,
    "lastAuditAt" TIMESTAMP(3),
    "nextSuggestedAuditAt" TIMESTAMP(3),
    "manualOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideJustification" TEXT,
    "riskFactors" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AuditUniverseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditRiskCriterion" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "minScore" INTEGER NOT NULL DEFAULT 1,
    "maxScore" INTEGER NOT NULL DEFAULT 5,
    "defaultScore" INTEGER NOT NULL DEFAULT 3,
    "formulaVariable" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AuditRiskCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditRiskScore" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "universeItemId" TEXT NOT NULL,
    "calculatedScore" DOUBLE PRECISION NOT NULL,
    "level" "AuditRiskLevel" NOT NULL,
    "criteriaValues" JSONB,
    "formulaSnapshot" TEXT,
    "recommendedFrequencyDays" INTEGER,
    "changedById" TEXT,
    "justification" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditRiskScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditorProfile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "kind" "AuditorKind" NOT NULL DEFAULT 'INTERNAL',
    "status" "AuditorStatus" NOT NULL DEFAULT 'ACTIVE',
    "name" TEXT NOT NULL,
    "email" TEXT,
    "companyName" TEXT,
    "phone" TEXT,
    "orgNodeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowedAreaIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "restrictedAreaIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "standards" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "competenceLevel" INTEGER NOT NULL DEFAULT 1,
    "workloadHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "conflictPolicy" TEXT NOT NULL DEFAULT 'WARN',
    "availability" JSONB,
    "notes" TEXT,
    "docs" JSONB,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AuditorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditorCompetency" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "auditorProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "standardCode" TEXT,
    "requirement" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "evidenceDocumentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'VALID',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AuditorCompetency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditorCertification" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "auditorProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT,
    "certificateNumber" TEXT,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "documentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'VALID',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AuditorCertification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditorAvailability" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "auditorProfileId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditorAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditorConflict" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "auditorProfileId" TEXT NOT NULL,
    "auditId" TEXT,
    "orgNodeId" TEXT,
    "conflictType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'WARN',
    "description" TEXT,
    "justification" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditorConflict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditStandard" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT,
    "description" TEXT,
    "issuer" TEXT,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveUntil" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "documents" JSONB,
    "controls" JSONB,
    "risks" JSONB,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AuditStandard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditRequirement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "standardId" TEXT NOT NULL,
    "clause" TEXT NOT NULL,
    "code" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "evidenceExpected" JSONB,
    "controls" JSONB,
    "risks" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AuditRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditFindingClassification" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "findingType" "AuditFindingType" NOT NULL DEFAULT 'OBSERVATION',
    "severity" "NonConformitySeverity",
    "color" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "requiresNc" BOOLEAN NOT NULL DEFAULT false,
    "requiresAction" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "rules" JSONB,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AuditFindingClassification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditChecklistTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "AuditChecklistTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "auditType" "AuditType",
    "modality" "AuditModality",
    "standardId" TEXT,
    "orgNodeId" TEXT,
    "processId" TEXT,
    "supplierId" TEXT,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AuditChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditChecklistSection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditChecklistSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditChecklistItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "code" TEXT,
    "question" TEXT NOT NULL,
    "instructions" TEXT,
    "examples" TEXT,
    "requirementId" TEXT,
    "responseType" TEXT NOT NULL DEFAULT 'SELECT',
    "options" JSONB,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "criticality" TEXT,
    "evidenceRequired" BOOLEAN NOT NULL DEFAULT false,
    "commentRequired" BOOLEAN NOT NULL DEFAULT false,
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "conditionalRules" JSONB,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AuditChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditChecklistExecution" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "templateId" TEXT,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "assignedToUserId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "autosaveToken" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "currentSectionId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AuditChecklistExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditChecklistResponse" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "itemId" TEXT,
    "itemCode" TEXT,
    "response" "AuditChecklistResponseKind",
    "valueText" TEXT,
    "valueNumber" DOUBLE PRECISION,
    "valueDate" TIMESTAMP(3),
    "comments" TEXT,
    "attachments" JSONB,
    "evidenceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "findingId" TEXT,
    "markedForReview" BOOLEAN NOT NULL DEFAULT false,
    "answeredById" TEXT,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditChecklistResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvidence" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "findingId" TEXT,
    "checklistExecutionId" TEXT,
    "checklistItemId" TEXT,
    "nonConformityId" TEXT,
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
    "location" TEXT,
    "confidentiality" TEXT NOT NULL DEFAULT 'INTERNAL',
    "status" "AuditEvidenceStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "storageProvider" TEXT,
    "storageKey" TEXT,
    "retentionUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AuditEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditReport" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "summary" TEXT,
    "executiveSummary" TEXT,
    "findingsSummary" TEXT,
    "conclusions" TEXT,
    "recommendations" TEXT,
    "score" DOUBLE PRECISION,
    "result" TEXT,
    "issuedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "approvedById" TEXT,
    "documentId" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AuditReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditApproval" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "decision" "AuditApprovalDecision" NOT NULL DEFAULT 'PENDING',
    "approverUserId" TEXT,
    "approvalOrder" INTEGER NOT NULL DEFAULT 1,
    "statusFrom" TEXT,
    "statusTo" TEXT,
    "comment" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditFollowUp" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "findingId" TEXT,
    "nonConformityId" TEXT,
    "actionPlanId" TEXT,
    "responsibleUserId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "AuditFollowUpStatus" NOT NULL DEFAULT 'OPEN',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "effectivenessStatus" TEXT,
    "verificationNotes" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AuditFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditTimelineEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "auditId" TEXT,
    "findingId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "beforeValue" JSONB,
    "afterValue" JSONB,
    "comment" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditTimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditWorkflow" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "entityType" TEXT NOT NULL DEFAULT 'AUDIT',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "steps" JSONB,
    "transitions" JSONB,
    "rules" JSONB,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AuditWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditNotificationRule" (
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

    CONSTRAINT "AuditNotificationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditExternalAccess" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditExternalAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditAiSuggestion" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "auditId" TEXT,
    "findingId" TEXT,
    "suggestionType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "context" JSONB,
    "status" "AuditAiSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,

    CONSTRAINT "AuditAiSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditProgram_companyId_idx" ON "AuditProgram"("companyId");

-- CreateIndex
CREATE INDEX "AuditProgram_companyId_status_idx" ON "AuditProgram"("companyId", "status");

-- CreateIndex
CREATE INDEX "AuditProgram_ownerUserId_idx" ON "AuditProgram"("ownerUserId");

-- CreateIndex
CREATE INDEX "AuditProgram_approverUserId_idx" ON "AuditProgram"("approverUserId");

-- CreateIndex
CREATE INDEX "AuditProgram_startsAt_endsAt_idx" ON "AuditProgram"("startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuditProgram_companyId_code_key" ON "AuditProgram"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "AuditProgram_companyId_number_key" ON "AuditProgram"("companyId", "number");

-- CreateIndex
CREATE INDEX "AuditProgramRevision_companyId_idx" ON "AuditProgramRevision"("companyId");

-- CreateIndex
CREATE INDEX "AuditProgramRevision_programId_idx" ON "AuditProgramRevision"("programId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditProgramRevision_programId_version_key" ON "AuditProgramRevision"("programId", "version");

-- CreateIndex
CREATE INDEX "AuditTypeConfig_companyId_idx" ON "AuditTypeConfig"("companyId");

-- CreateIndex
CREATE INDEX "AuditTypeConfig_companyId_active_idx" ON "AuditTypeConfig"("companyId", "active");

-- CreateIndex
CREATE INDEX "AuditTypeConfig_category_idx" ON "AuditTypeConfig"("category");

-- CreateIndex
CREATE UNIQUE INDEX "AuditTypeConfig_companyId_code_key" ON "AuditTypeConfig"("companyId", "code");

-- CreateIndex
CREATE INDEX "AuditUniverseItem_companyId_idx" ON "AuditUniverseItem"("companyId");

-- CreateIndex
CREATE INDEX "AuditUniverseItem_companyId_kind_idx" ON "AuditUniverseItem"("companyId", "kind");

-- CreateIndex
CREATE INDEX "AuditUniverseItem_companyId_riskLevel_idx" ON "AuditUniverseItem"("companyId", "riskLevel");

-- CreateIndex
CREATE INDEX "AuditUniverseItem_orgNodeId_idx" ON "AuditUniverseItem"("orgNodeId");

-- CreateIndex
CREATE INDEX "AuditUniverseItem_processId_idx" ON "AuditUniverseItem"("processId");

-- CreateIndex
CREATE INDEX "AuditUniverseItem_supplierId_idx" ON "AuditUniverseItem"("supplierId");

-- CreateIndex
CREATE INDEX "AuditUniverseItem_riskId_idx" ON "AuditUniverseItem"("riskId");

-- CreateIndex
CREATE INDEX "AuditUniverseItem_indicatorId_idx" ON "AuditUniverseItem"("indicatorId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditUniverseItem_companyId_code_key" ON "AuditUniverseItem"("companyId", "code");

-- CreateIndex
CREATE INDEX "AuditRiskCriterion_companyId_idx" ON "AuditRiskCriterion"("companyId");

-- CreateIndex
CREATE INDEX "AuditRiskCriterion_companyId_active_idx" ON "AuditRiskCriterion"("companyId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "AuditRiskCriterion_companyId_key_key" ON "AuditRiskCriterion"("companyId", "key");

-- CreateIndex
CREATE INDEX "AuditRiskScore_companyId_idx" ON "AuditRiskScore"("companyId");

-- CreateIndex
CREATE INDEX "AuditRiskScore_universeItemId_createdAt_idx" ON "AuditRiskScore"("universeItemId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditRiskScore_level_idx" ON "AuditRiskScore"("level");

-- CreateIndex
CREATE INDEX "AuditorProfile_companyId_idx" ON "AuditorProfile"("companyId");

-- CreateIndex
CREATE INDEX "AuditorProfile_companyId_status_idx" ON "AuditorProfile"("companyId", "status");

-- CreateIndex
CREATE INDEX "AuditorProfile_userId_idx" ON "AuditorProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditorProfile_companyId_userId_key" ON "AuditorProfile"("companyId", "userId");

-- CreateIndex
CREATE INDEX "AuditorCompetency_companyId_idx" ON "AuditorCompetency"("companyId");

-- CreateIndex
CREATE INDEX "AuditorCompetency_auditorProfileId_idx" ON "AuditorCompetency"("auditorProfileId");

-- CreateIndex
CREATE INDEX "AuditorCompetency_standardCode_idx" ON "AuditorCompetency"("standardCode");

-- CreateIndex
CREATE INDEX "AuditorCompetency_validUntil_idx" ON "AuditorCompetency"("validUntil");

-- CreateIndex
CREATE INDEX "AuditorCertification_companyId_idx" ON "AuditorCertification"("companyId");

-- CreateIndex
CREATE INDEX "AuditorCertification_auditorProfileId_idx" ON "AuditorCertification"("auditorProfileId");

-- CreateIndex
CREATE INDEX "AuditorCertification_validUntil_idx" ON "AuditorCertification"("validUntil");

-- CreateIndex
CREATE INDEX "AuditorAvailability_companyId_idx" ON "AuditorAvailability"("companyId");

-- CreateIndex
CREATE INDEX "AuditorAvailability_auditorProfileId_startsAt_endsAt_idx" ON "AuditorAvailability"("auditorProfileId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "AuditorConflict_companyId_idx" ON "AuditorConflict"("companyId");

-- CreateIndex
CREATE INDEX "AuditorConflict_auditorProfileId_idx" ON "AuditorConflict"("auditorProfileId");

-- CreateIndex
CREATE INDEX "AuditorConflict_auditId_idx" ON "AuditorConflict"("auditId");

-- CreateIndex
CREATE INDEX "AuditorConflict_orgNodeId_idx" ON "AuditorConflict"("orgNodeId");

-- CreateIndex
CREATE INDEX "AuditStandard_companyId_idx" ON "AuditStandard"("companyId");

-- CreateIndex
CREATE INDEX "AuditStandard_companyId_status_idx" ON "AuditStandard"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AuditStandard_companyId_code_version_key" ON "AuditStandard"("companyId", "code", "version");

-- CreateIndex
CREATE INDEX "AuditRequirement_companyId_idx" ON "AuditRequirement"("companyId");

-- CreateIndex
CREATE INDEX "AuditRequirement_standardId_idx" ON "AuditRequirement"("standardId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditRequirement_standardId_clause_key" ON "AuditRequirement"("standardId", "clause");

-- CreateIndex
CREATE INDEX "AuditFindingClassification_companyId_idx" ON "AuditFindingClassification"("companyId");

-- CreateIndex
CREATE INDEX "AuditFindingClassification_companyId_active_idx" ON "AuditFindingClassification"("companyId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "AuditFindingClassification_companyId_code_key" ON "AuditFindingClassification"("companyId", "code");

-- CreateIndex
CREATE INDEX "AuditChecklistTemplate_companyId_idx" ON "AuditChecklistTemplate"("companyId");

-- CreateIndex
CREATE INDEX "AuditChecklistTemplate_companyId_status_idx" ON "AuditChecklistTemplate"("companyId", "status");

-- CreateIndex
CREATE INDEX "AuditChecklistTemplate_auditType_idx" ON "AuditChecklistTemplate"("auditType");

-- CreateIndex
CREATE INDEX "AuditChecklistTemplate_standardId_idx" ON "AuditChecklistTemplate"("standardId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditChecklistTemplate_companyId_code_key" ON "AuditChecklistTemplate"("companyId", "code");

-- CreateIndex
CREATE INDEX "AuditChecklistSection_companyId_idx" ON "AuditChecklistSection"("companyId");

-- CreateIndex
CREATE INDEX "AuditChecklistSection_templateId_position_idx" ON "AuditChecklistSection"("templateId", "position");

-- CreateIndex
CREATE INDEX "AuditChecklistItem_companyId_idx" ON "AuditChecklistItem"("companyId");

-- CreateIndex
CREATE INDEX "AuditChecklistItem_sectionId_position_idx" ON "AuditChecklistItem"("sectionId", "position");

-- CreateIndex
CREATE INDEX "AuditChecklistItem_requirementId_idx" ON "AuditChecklistItem"("requirementId");

-- CreateIndex
CREATE INDEX "AuditChecklistExecution_companyId_idx" ON "AuditChecklistExecution"("companyId");

-- CreateIndex
CREATE INDEX "AuditChecklistExecution_auditId_idx" ON "AuditChecklistExecution"("auditId");

-- CreateIndex
CREATE INDEX "AuditChecklistExecution_templateId_idx" ON "AuditChecklistExecution"("templateId");

-- CreateIndex
CREATE INDEX "AuditChecklistExecution_status_idx" ON "AuditChecklistExecution"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AuditChecklistExecution_companyId_code_key" ON "AuditChecklistExecution"("companyId", "code");

-- CreateIndex
CREATE INDEX "AuditChecklistResponse_companyId_idx" ON "AuditChecklistResponse"("companyId");

-- CreateIndex
CREATE INDEX "AuditChecklistResponse_executionId_idx" ON "AuditChecklistResponse"("executionId");

-- CreateIndex
CREATE INDEX "AuditChecklistResponse_auditId_idx" ON "AuditChecklistResponse"("auditId");

-- CreateIndex
CREATE INDEX "AuditChecklistResponse_findingId_idx" ON "AuditChecklistResponse"("findingId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditChecklistResponse_executionId_itemId_key" ON "AuditChecklistResponse"("executionId", "itemId");

-- CreateIndex
CREATE INDEX "AuditEvidence_companyId_idx" ON "AuditEvidence"("companyId");

-- CreateIndex
CREATE INDEX "AuditEvidence_auditId_idx" ON "AuditEvidence"("auditId");

-- CreateIndex
CREATE INDEX "AuditEvidence_findingId_idx" ON "AuditEvidence"("findingId");

-- CreateIndex
CREATE INDEX "AuditEvidence_checklistExecutionId_idx" ON "AuditEvidence"("checklistExecutionId");

-- CreateIndex
CREATE INDEX "AuditEvidence_nonConformityId_idx" ON "AuditEvidence"("nonConformityId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEvidence_companyId_code_key" ON "AuditEvidence"("companyId", "code");

-- CreateIndex
CREATE INDEX "AuditReport_companyId_idx" ON "AuditReport"("companyId");

-- CreateIndex
CREATE INDEX "AuditReport_auditId_idx" ON "AuditReport"("auditId");

-- CreateIndex
CREATE INDEX "AuditReport_status_idx" ON "AuditReport"("status");

-- CreateIndex
CREATE INDEX "AuditReport_documentId_idx" ON "AuditReport"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditReport_companyId_code_key" ON "AuditReport"("companyId", "code");

-- CreateIndex
CREATE INDEX "AuditApproval_companyId_idx" ON "AuditApproval"("companyId");

-- CreateIndex
CREATE INDEX "AuditApproval_auditId_idx" ON "AuditApproval"("auditId");

-- CreateIndex
CREATE INDEX "AuditApproval_approverUserId_idx" ON "AuditApproval"("approverUserId");

-- CreateIndex
CREATE INDEX "AuditApproval_decision_idx" ON "AuditApproval"("decision");

-- CreateIndex
CREATE INDEX "AuditFollowUp_companyId_idx" ON "AuditFollowUp"("companyId");

-- CreateIndex
CREATE INDEX "AuditFollowUp_auditId_idx" ON "AuditFollowUp"("auditId");

-- CreateIndex
CREATE INDEX "AuditFollowUp_findingId_idx" ON "AuditFollowUp"("findingId");

-- CreateIndex
CREATE INDEX "AuditFollowUp_nonConformityId_idx" ON "AuditFollowUp"("nonConformityId");

-- CreateIndex
CREATE INDEX "AuditFollowUp_actionPlanId_idx" ON "AuditFollowUp"("actionPlanId");

-- CreateIndex
CREATE INDEX "AuditFollowUp_responsibleUserId_idx" ON "AuditFollowUp"("responsibleUserId");

-- CreateIndex
CREATE INDEX "AuditFollowUp_dueDate_idx" ON "AuditFollowUp"("dueDate");

-- CreateIndex
CREATE INDEX "AuditTimelineEvent_companyId_idx" ON "AuditTimelineEvent"("companyId");

-- CreateIndex
CREATE INDEX "AuditTimelineEvent_auditId_createdAt_idx" ON "AuditTimelineEvent"("auditId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditTimelineEvent_findingId_idx" ON "AuditTimelineEvent"("findingId");

-- CreateIndex
CREATE INDEX "AuditTimelineEvent_entityType_entityId_idx" ON "AuditTimelineEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditTimelineEvent_createdAt_idx" ON "AuditTimelineEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AuditWorkflow_companyId_idx" ON "AuditWorkflow"("companyId");

-- CreateIndex
CREATE INDEX "AuditWorkflow_companyId_active_idx" ON "AuditWorkflow"("companyId", "active");

-- CreateIndex
CREATE INDEX "AuditNotificationRule_companyId_idx" ON "AuditNotificationRule"("companyId");

-- CreateIndex
CREATE INDEX "AuditNotificationRule_companyId_event_idx" ON "AuditNotificationRule"("companyId", "event");

-- CreateIndex
CREATE INDEX "AuditExternalAccess_companyId_idx" ON "AuditExternalAccess"("companyId");

-- CreateIndex
CREATE INDEX "AuditExternalAccess_auditId_idx" ON "AuditExternalAccess"("auditId");

-- CreateIndex
CREATE INDEX "AuditExternalAccess_email_idx" ON "AuditExternalAccess"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AuditExternalAccess_tokenHash_key" ON "AuditExternalAccess"("tokenHash");

-- CreateIndex
CREATE INDEX "AuditAiSuggestion_companyId_idx" ON "AuditAiSuggestion"("companyId");

-- CreateIndex
CREATE INDEX "AuditAiSuggestion_auditId_createdAt_idx" ON "AuditAiSuggestion"("auditId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditAiSuggestion_findingId_idx" ON "AuditAiSuggestion"("findingId");

-- CreateIndex
CREATE INDEX "AuditAiSuggestion_status_idx" ON "AuditAiSuggestion"("status");

-- CreateIndex
CREATE INDEX "Audit_programId_idx" ON "Audit"("programId");

-- CreateIndex
CREATE INDEX "Audit_typeConfigId_idx" ON "Audit"("typeConfigId");

-- CreateIndex
CREATE INDEX "Audit_universeItemId_idx" ON "Audit"("universeItemId");

-- CreateIndex
CREATE INDEX "Audit_plannedDate_idx" ON "Audit"("plannedDate");

-- CreateIndex
CREATE UNIQUE INDEX "Audit_companyId_code_key" ON "Audit"("companyId", "code");

-- CreateIndex
CREATE INDEX "AuditFinding_companyId_idx" ON "AuditFinding"("companyId");

-- CreateIndex
CREATE INDEX "AuditFinding_status_idx" ON "AuditFinding"("status");

-- CreateIndex
CREATE INDEX "AuditFinding_type_idx" ON "AuditFinding"("type");

-- CreateIndex
CREATE INDEX "AuditFinding_orgNodeId_idx" ON "AuditFinding"("orgNodeId");

-- CreateIndex
CREATE INDEX "AuditFinding_responsibleUserId_idx" ON "AuditFinding"("responsibleUserId");

-- CreateIndex
CREATE INDEX "AuditFinding_dueDate_idx" ON "AuditFinding"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "AuditFinding_companyId_code_key" ON "AuditFinding"("companyId", "code");

-- AddForeignKey
ALTER TABLE "AuditProgramRevision" ADD CONSTRAINT "AuditProgramRevision_programId_fkey" FOREIGN KEY ("programId") REFERENCES "AuditProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditRiskScore" ADD CONSTRAINT "AuditRiskScore_universeItemId_fkey" FOREIGN KEY ("universeItemId") REFERENCES "AuditUniverseItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditorCompetency" ADD CONSTRAINT "AuditorCompetency_auditorProfileId_fkey" FOREIGN KEY ("auditorProfileId") REFERENCES "AuditorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditorCertification" ADD CONSTRAINT "AuditorCertification_auditorProfileId_fkey" FOREIGN KEY ("auditorProfileId") REFERENCES "AuditorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditorAvailability" ADD CONSTRAINT "AuditorAvailability_auditorProfileId_fkey" FOREIGN KEY ("auditorProfileId") REFERENCES "AuditorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditorConflict" ADD CONSTRAINT "AuditorConflict_auditorProfileId_fkey" FOREIGN KEY ("auditorProfileId") REFERENCES "AuditorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditRequirement" ADD CONSTRAINT "AuditRequirement_standardId_fkey" FOREIGN KEY ("standardId") REFERENCES "AuditStandard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditChecklistSection" ADD CONSTRAINT "AuditChecklistSection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AuditChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditChecklistItem" ADD CONSTRAINT "AuditChecklistItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "AuditChecklistSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditChecklistExecution" ADD CONSTRAINT "AuditChecklistExecution_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditChecklistResponse" ADD CONSTRAINT "AuditChecklistResponse_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "AuditChecklistExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvidence" ADD CONSTRAINT "AuditEvidence_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditReport" ADD CONSTRAINT "AuditReport_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditApproval" ADD CONSTRAINT "AuditApproval_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditFollowUp" ADD CONSTRAINT "AuditFollowUp_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditTimelineEvent" ADD CONSTRAINT "AuditTimelineEvent_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditExternalAccess" ADD CONSTRAINT "AuditExternalAccess_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditAiSuggestion" ADD CONSTRAINT "AuditAiSuggestion_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
