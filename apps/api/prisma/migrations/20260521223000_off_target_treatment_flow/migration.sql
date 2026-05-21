-- Extend traceability enum for treatment workflow
ALTER TYPE "TraceEventType" ADD VALUE IF NOT EXISTS 'MEETING_COMPLETED';
ALTER TYPE "TraceEventType" ADD VALUE IF NOT EXISTS 'PARTICIPANT_ADDED';
ALTER TYPE "TraceEventType" ADD VALUE IF NOT EXISTS 'PARTICIPANT_REMOVED';
ALTER TYPE "TraceEventType" ADD VALUE IF NOT EXISTS 'EMAIL_INVITE_SENT';
ALTER TYPE "TraceEventType" ADD VALUE IF NOT EXISTS 'EMAIL_INVITE_FAILED';
ALTER TYPE "TraceEventType" ADD VALUE IF NOT EXISTS 'CALENDAR_INVITE_CREATED';
ALTER TYPE "TraceEventType" ADD VALUE IF NOT EXISTS 'TREATMENT_STARTED';
ALTER TYPE "TraceEventType" ADD VALUE IF NOT EXISTS 'TREATMENT_IGNORED';
ALTER TYPE "TraceEventType" ADD VALUE IF NOT EXISTS 'INDICATOR_REEVALUATED';
ALTER TYPE "TraceEventType" ADD VALUE IF NOT EXISTS 'INDICATOR_RESOLVED';
ALTER TYPE "AnalysisMethod" ADD VALUE IF NOT EXISTS 'PDCA';
ALTER TYPE "AnalysisMethod" ADD VALUE IF NOT EXISTS 'MASP';
ALTER TYPE "AnalysisMethod" ADD VALUE IF NOT EXISTS 'DMAIC';

-- CreateEnum
CREATE TYPE "TreatmentStatus" AS ENUM ('OUT_OF_GOAL', 'AWAITING_CAUSE_ANALYSIS', 'CAUSE_ANALYSIS_CREATED', 'MEETING_SCHEDULED', 'MEETING_COMPLETED', 'ACTION_PLAN_CREATED', 'ACTIONS_IN_PROGRESS', 'ACTIONS_OVERDUE', 'AWAITING_EVIDENCE', 'AWAITING_REEVALUATION', 'RESOLVED', 'UNRESOLVED', 'REOPENED', 'CONCLUDED', 'IGNORED_TEMPORARILY');

-- CreateEnum
CREATE TYPE "MeetingFormat" AS ENUM ('PRESENTIAL', 'ONLINE', 'HYBRID');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MeetingParticipantRole" AS ENUM ('RESPONSIBLE', 'PARTICIPANT', 'APPROVER', 'EXECUTOR', 'GUEST');

-- CreateEnum
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'ERROR');

-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN "indicatorId" TEXT,
ADD COLUMN "deviationId" TEXT,
ADD COLUMN "analysisId" TEXT,
ADD COLUMN "treatmentId" TEXT,
ADD COLUMN "responsibleUserId" TEXT,
ADD COLUMN "format" "MeetingFormat" NOT NULL DEFAULT 'ONLINE',
ADD COLUMN "status" "MeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
ADD COLUMN "objective" TEXT;

-- AlterTable
ALTER TABLE "MeetingParticipant" ADD COLUMN "role" "MeetingParticipantRole" NOT NULL DEFAULT 'PARTICIPANT',
ADD COLUMN "notes" TEXT;

-- AlterTable
ALTER TABLE "ActionPlan" ADD COLUMN "indicatorId" TEXT,
ADD COLUMN "meetingId" TEXT,
ADD COLUMN "analysisId" TEXT,
ADD COLUMN "treatmentId" TEXT,
ADD COLUMN "responsibleEmail" TEXT,
ADD COLUMN "evidenceRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "expectedResult" TEXT,
ADD COLUMN "achievedResult" TEXT;

-- CreateTable
CREATE TABLE "TreatmentCase" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "resultId" TEXT,
    "deviationId" TEXT,
    "analysisId" TEXT,
    "meetingId" TEXT,
    "createdById" TEXT,
    "periodRef" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "problem" TEXT,
    "status" "TreatmentStatus" NOT NULL DEFAULT 'AWAITING_CAUSE_ANALYSIS',
    "ignoredAt" TIMESTAMP(3),
    "ignoreReason" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "concludedAt" TIMESTAMP(3),
    "reopenedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreatmentCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingGuest" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "jobTitle" TEXT,
    "area" TEXT,
    "role" "MeetingParticipantRole" NOT NULL DEFAULT 'GUEST',
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingGuest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "meetingId" TEXT,
    "recipientName" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarInvite" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "icsContent" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TreatmentCase_indicatorId_periodRef_key" ON "TreatmentCase"("indicatorId", "periodRef");
CREATE INDEX "TreatmentCase_companyId_status_idx" ON "TreatmentCase"("companyId", "status");
CREATE INDEX "TreatmentCase_indicatorId_idx" ON "TreatmentCase"("indicatorId");
CREATE INDEX "MeetingGuest_meetingId_idx" ON "MeetingGuest"("meetingId");
CREATE UNIQUE INDEX "MeetingGuest_meetingId_email_key" ON "MeetingGuest"("meetingId", "email");
CREATE INDEX "EmailLog_companyId_createdAt_idx" ON "EmailLog"("companyId", "createdAt");
CREATE INDEX "EmailLog_meetingId_idx" ON "EmailLog"("meetingId");
CREATE INDEX "EmailLog_recipientEmail_idx" ON "EmailLog"("recipientEmail");
CREATE UNIQUE INDEX "CalendarInvite_uid_key" ON "CalendarInvite"("uid");
CREATE INDEX "CalendarInvite_companyId_idx" ON "CalendarInvite"("companyId");
CREATE INDEX "CalendarInvite_meetingId_idx" ON "CalendarInvite"("meetingId");
CREATE INDEX "Meeting_indicatorId_idx" ON "Meeting"("indicatorId");
CREATE INDEX "Meeting_deviationId_idx" ON "Meeting"("deviationId");
CREATE INDEX "Meeting_treatmentId_idx" ON "Meeting"("treatmentId");
CREATE INDEX "ActionPlan_indicatorId_idx" ON "ActionPlan"("indicatorId");
CREATE INDEX "ActionPlan_meetingId_idx" ON "ActionPlan"("meetingId");
CREATE INDEX "ActionPlan_treatmentId_idx" ON "ActionPlan"("treatmentId");

-- AddForeignKey
ALTER TABLE "TreatmentCase" ADD CONSTRAINT "TreatmentCase_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TreatmentCase" ADD CONSTRAINT "TreatmentCase_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "Indicator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TreatmentCase" ADD CONSTRAINT "TreatmentCase_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "IndicatorResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TreatmentCase" ADD CONSTRAINT "TreatmentCase_deviationId_fkey" FOREIGN KEY ("deviationId") REFERENCES "Deviation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TreatmentCase" ADD CONSTRAINT "TreatmentCase_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "DeviationAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TreatmentCase" ADD CONSTRAINT "TreatmentCase_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TreatmentCase" ADD CONSTRAINT "TreatmentCase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "Indicator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_deviationId_fkey" FOREIGN KEY ("deviationId") REFERENCES "Deviation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "DeviationAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_treatmentId_fkey" FOREIGN KEY ("treatmentId") REFERENCES "TreatmentCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MeetingGuest" ADD CONSTRAINT "MeetingGuest_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActionPlan" ADD CONSTRAINT "ActionPlan_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "Indicator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActionPlan" ADD CONSTRAINT "ActionPlan_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActionPlan" ADD CONSTRAINT "ActionPlan_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "DeviationAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActionPlan" ADD CONSTRAINT "ActionPlan_treatmentId_fkey" FOREIGN KEY ("treatmentId") REFERENCES "TreatmentCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CalendarInvite" ADD CONSTRAINT "CalendarInvite_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CalendarInvite" ADD CONSTRAINT "CalendarInvite_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
