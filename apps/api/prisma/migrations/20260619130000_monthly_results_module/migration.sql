-- CreateEnum
CREATE TYPE "MonthlyMeetingStatus" AS ENUM ('PREPARING', 'READY', 'IN_PROGRESS', 'CLOSED', 'REOPENED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MonthlyAreaReadiness" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'WITH_ISSUES', 'READY_FOR_VALIDATION', 'VALIDATED', 'RELEASED');

-- CreateEnum
CREATE TYPE "MonthlyEntryKind" AS ENUM ('DECISION', 'RISK', 'ESCALATION', 'PENDING');

-- CreateEnum
CREATE TYPE "MonthlyItemStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MonthlyFollowUpLevel" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY');

-- CreateEnum
CREATE TYPE "MonthlyPresentationStatus" AS ENUM ('PENDING', 'PRESENTING', 'DISCUSSED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "MonthlyStandardizationType" AS ENUM ('POP', 'WORK_INSTRUCTION', 'RISK_MATRIX', 'CHECKLIST', 'TRAINING', 'VISUAL_MANAGEMENT', 'AUDIT', 'BEST_PRACTICE', 'LEARNING_BANK');

-- CreateTable
CREATE TABLE "MonthlyMeeting" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "periodRef" TEXT NOT NULL,
    "cropSeason" TEXT,
    "cycleName" TEXT,
    "status" "MonthlyMeetingStatus" NOT NULL DEFAULT 'PREPARING',
    "format" "MeetingFormat" NOT NULL DEFAULT 'HYBRID',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "location" TEXT,
    "responsibleUserId" TEXT,
    "secretaryUserId" TEXT,
    "followUpUserId" TEXT,
    "objective" TEXT,
    "assumptions" TEXT,
    "criticalRisks" TEXT,
    "boardDirections" TEXT,
    "generalNotes" TEXT,
    "keyMessage" TEXT,
    "nextMonthlyAt" TIMESTAMP(3),
    "nextWeeklyAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MonthlyMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyMeetingArea" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "orgNodeId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "readiness" "MonthlyAreaReadiness" NOT NULL DEFAULT 'NOT_STARTED',
    "presenterUserId" TEXT,
    "areaKeyMessage" TEXT,
    "validatedById" TEXT,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyMeetingArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyMeetingIndicator" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "meetingAreaId" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "target" DOUBLE PRECISION,
    "lowerBound" DOUBLE PRECISION,
    "upperBound" DOUBLE PRECISION,
    "current" DOUBLE PRECISION,
    "accumulated" DOUBLE PRECISION,
    "attainment" DOUBLE PRECISION,
    "deviationPct" DOUBLE PRECISION,
    "light" "TrafficLight" NOT NULL DEFAULT 'GRAY',
    "trend" TEXT,
    "managerComment" TEXT,
    "trendNote" TEXT,
    "executiveStatus" TEXT,
    "showInPresentation" BOOLEAN NOT NULL DEFAULT true,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "financialImpact" DOUBLE PRECISION,
    "position" INTEGER NOT NULL DEFAULT 0,
    "deviationId" TEXT,
    "actionPlanId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyMeetingIndicator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyMeetingAgendaItem" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "orgNodeId" TEXT,
    "topic" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "plannedMinutes" INTEGER NOT NULL DEFAULT 0,
    "actualMinutes" INTEGER,
    "presentationStatus" "MonthlyPresentationStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "presenterUserId" TEXT,
    "notes" TEXT,

    CONSTRAINT "MonthlyMeetingAgendaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyMeetingDecision" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "orgNodeId" TEXT,
    "kind" "MonthlyEntryKind" NOT NULL DEFAULT 'DECISION',
    "topic" TEXT,
    "description" TEXT NOT NULL,
    "ownerName" TEXT,
    "ownerUserId" TEXT,
    "dueDate" TIMESTAMP(3),
    "impactIfNotDecided" TEXT,
    "boardInvolved" TEXT,
    "status" "MonthlyItemStatus" NOT NULL DEFAULT 'OPEN',
    "actionPlanId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyMeetingDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyMeetingFollowUp" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "level" "MonthlyFollowUpLevel" NOT NULL DEFAULT 'WEEKLY',
    "title" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "ownerUserId" TEXT,
    "indicatorId" TEXT,
    "actionPlanId" TEXT,
    "status" "MonthlyItemStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyMeetingFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyMeetingLearning" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "orgNodeId" TEXT,
    "indicatorId" TEXT,
    "learning" TEXT NOT NULL,
    "treatedCause" TEXT,
    "effectiveAction" TEXT,
    "replicateToNodeId" TEXT,
    "ownerUserId" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "MonthlyItemStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyMeetingLearning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyMeetingStandardization" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "type" "MonthlyStandardizationType" NOT NULL DEFAULT 'POP',
    "description" TEXT NOT NULL,
    "sourceNodeId" TEXT,
    "indicatorId" TEXT,
    "documentId" TEXT,
    "ownerUserId" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "MonthlyItemStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyMeetingStandardization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyMeetingParticipant" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MeetingParticipantRole" NOT NULL DEFAULT 'PARTICIPANT',
    "attended" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MonthlyMeetingParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyMeetingChecklistItem" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "orgNodeId" TEXT,
    "label" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "autoRule" TEXT,
    "severity" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyMeetingChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyMeetingAttachment" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "refKind" TEXT,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "documentId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlyMeetingAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MonthlyMeeting_companyId_periodRef_idx" ON "MonthlyMeeting"("companyId", "periodRef");

-- CreateIndex
CREATE INDEX "MonthlyMeeting_companyId_status_idx" ON "MonthlyMeeting"("companyId", "status");

-- CreateIndex
CREATE INDEX "MonthlyMeetingArea_meetingId_idx" ON "MonthlyMeetingArea"("meetingId");

-- CreateIndex
CREATE INDEX "MonthlyMeetingArea_orgNodeId_idx" ON "MonthlyMeetingArea"("orgNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyMeetingArea_meetingId_orgNodeId_key" ON "MonthlyMeetingArea"("meetingId", "orgNodeId");

-- CreateIndex
CREATE INDEX "MonthlyMeetingIndicator_meetingId_idx" ON "MonthlyMeetingIndicator"("meetingId");

-- CreateIndex
CREATE INDEX "MonthlyMeetingIndicator_indicatorId_idx" ON "MonthlyMeetingIndicator"("indicatorId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyMeetingIndicator_meetingAreaId_indicatorId_key" ON "MonthlyMeetingIndicator"("meetingAreaId", "indicatorId");

-- CreateIndex
CREATE INDEX "MonthlyMeetingAgendaItem_meetingId_idx" ON "MonthlyMeetingAgendaItem"("meetingId");

-- CreateIndex
CREATE INDEX "MonthlyMeetingDecision_meetingId_idx" ON "MonthlyMeetingDecision"("meetingId");

-- CreateIndex
CREATE INDEX "MonthlyMeetingDecision_meetingId_kind_idx" ON "MonthlyMeetingDecision"("meetingId", "kind");

-- CreateIndex
CREATE INDEX "MonthlyMeetingFollowUp_meetingId_idx" ON "MonthlyMeetingFollowUp"("meetingId");

-- CreateIndex
CREATE INDEX "MonthlyMeetingLearning_meetingId_idx" ON "MonthlyMeetingLearning"("meetingId");

-- CreateIndex
CREATE INDEX "MonthlyMeetingStandardization_meetingId_idx" ON "MonthlyMeetingStandardization"("meetingId");

-- CreateIndex
CREATE INDEX "MonthlyMeetingParticipant_meetingId_idx" ON "MonthlyMeetingParticipant"("meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyMeetingParticipant_meetingId_userId_key" ON "MonthlyMeetingParticipant"("meetingId", "userId");

-- CreateIndex
CREATE INDEX "MonthlyMeetingChecklistItem_meetingId_idx" ON "MonthlyMeetingChecklistItem"("meetingId");

-- CreateIndex
CREATE INDEX "MonthlyMeetingAttachment_meetingId_idx" ON "MonthlyMeetingAttachment"("meetingId");

-- AddForeignKey
ALTER TABLE "MonthlyMeeting" ADD CONSTRAINT "MonthlyMeeting_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyMeetingArea" ADD CONSTRAINT "MonthlyMeetingArea_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "MonthlyMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyMeetingArea" ADD CONSTRAINT "MonthlyMeetingArea_orgNodeId_fkey" FOREIGN KEY ("orgNodeId") REFERENCES "OrgNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyMeetingIndicator" ADD CONSTRAINT "MonthlyMeetingIndicator_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "MonthlyMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyMeetingIndicator" ADD CONSTRAINT "MonthlyMeetingIndicator_meetingAreaId_fkey" FOREIGN KEY ("meetingAreaId") REFERENCES "MonthlyMeetingArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyMeetingIndicator" ADD CONSTRAINT "MonthlyMeetingIndicator_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "Indicator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyMeetingAgendaItem" ADD CONSTRAINT "MonthlyMeetingAgendaItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "MonthlyMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyMeetingDecision" ADD CONSTRAINT "MonthlyMeetingDecision_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "MonthlyMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyMeetingFollowUp" ADD CONSTRAINT "MonthlyMeetingFollowUp_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "MonthlyMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyMeetingLearning" ADD CONSTRAINT "MonthlyMeetingLearning_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "MonthlyMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyMeetingStandardization" ADD CONSTRAINT "MonthlyMeetingStandardization_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "MonthlyMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyMeetingParticipant" ADD CONSTRAINT "MonthlyMeetingParticipant_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "MonthlyMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyMeetingChecklistItem" ADD CONSTRAINT "MonthlyMeetingChecklistItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "MonthlyMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyMeetingAttachment" ADD CONSTRAINT "MonthlyMeetingAttachment_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "MonthlyMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

