-- Action Plan Management Suite

ALTER TYPE "ActionStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "ActionStatus" ADD VALUE IF NOT EXISTS 'UNDER_ANALYSIS';
ALTER TYPE "ActionStatus" ADD VALUE IF NOT EXISTS 'WAITING_EVIDENCE';
ALTER TYPE "ActionStatus" ADD VALUE IF NOT EXISTS 'WAITING_VALIDATION';
ALTER TYPE "ActionStatus" ADD VALUE IF NOT EXISTS 'REOPENED';
ALTER TYPE "ActionStatus" ADD VALUE IF NOT EXISTS 'INEFFECTIVE';
ALTER TYPE "ActionStatus" ADD VALUE IF NOT EXISTS 'EFFECTIVE';

ALTER TYPE "ActionOrigin" ADD VALUE IF NOT EXISTS 'STRATEGIC_MAP';
ALTER TYPE "ActionOrigin" ADD VALUE IF NOT EXISTS 'RELATIONSHIP_MAP';
ALTER TYPE "ActionOrigin" ADD VALUE IF NOT EXISTS 'FOLLOW_UP';
ALTER TYPE "ActionOrigin" ADD VALUE IF NOT EXISTS 'NON_CONFORMITY';
ALTER TYPE "ActionOrigin" ADD VALUE IF NOT EXISTS 'OCCURRENCE';
ALTER TYPE "ActionOrigin" ADD VALUE IF NOT EXISTS 'AUDIT';

CREATE TYPE "ActionAnalysisTool" AS ENUM (
  'FIVE_WHYS',
  'ISHIKAWA',
  'MASP',
  'PDCA',
  'FIVE_W_TWO_H',
  'PARETO',
  'FCA',
  'GUT',
  'PRIORITIZATION_MATRIX',
  'BRAINSTORMING',
  'ROOT_CAUSE',
  'EFFECTIVENESS_CHECKLIST'
);

CREATE TYPE "ActionToolStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'READY', 'VALIDATED');
CREATE TYPE "ActionStepStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE', 'BLOCKED', 'VALIDATED');
CREATE TYPE "ActionEffectivenessStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'IN_REVIEW', 'EFFECTIVE', 'INEFFECTIVE', 'REOPENED', 'NOT_APPLICABLE');
CREATE TYPE "ActionAiSuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'APPLIED');

ALTER TABLE "ActionPlan"
  ADD COLUMN "branchId" TEXT,
  ADD COLUMN "strategicObjectiveId" TEXT,
  ADD COLUMN "indicatorResultId" TEXT,
  ADD COLUMN "problemDescription" TEXT,
  ADD COLUMN "analysisTool" "ActionAnalysisTool",
  ADD COLUMN "rootCause" TEXT,
  ADD COLUMN "criticality" "ActionPriority" NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN "effectivenessStatus" "ActionEffectivenessStatus" NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN "effectivenessChecklist" JSONB,
  ADD COLUMN "effectivenessSummary" TEXT,
  ADD COLUMN "effectivenessEvidence" TEXT,
  ADD COLUMN "effectivenessValidatedById" TEXT,
  ADD COLUMN "effectivenessValidatedAt" TIMESTAMP(3),
  ADD COLUMN "reopenedAt" TIMESTAMP(3),
  ADD COLUMN "cancelReason" TEXT;

ALTER TABLE "ActionPlan" ADD CONSTRAINT "ActionPlan_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActionPlan" ADD CONSTRAINT "ActionPlan_strategicObjectiveId_fkey" FOREIGN KEY ("strategicObjectiveId") REFERENCES "StrategicObjective"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActionPlan" ADD CONSTRAINT "ActionPlan_indicatorResultId_fkey" FOREIGN KEY ("indicatorResultId") REFERENCES "IndicatorResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ActionParticipant" (
  "id" TEXT NOT NULL,
  "actionId" TEXT NOT NULL,
  "userId" TEXT,
  "name" TEXT,
  "email" TEXT,
  "role" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActionParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActionEvidence" (
  "id" TEXT NOT NULL,
  "actionId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "url" TEXT,
  "fileName" TEXT,
  "fileType" TEXT,
  "uploadedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "ActionEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActionComment" (
  "id" TEXT NOT NULL,
  "actionId" TEXT NOT NULL,
  "authorId" TEXT,
  "authorName" TEXT,
  "comment" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "ActionComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActionHistory" (
  "id" TEXT NOT NULL,
  "actionId" TEXT NOT NULL,
  "userId" TEXT,
  "eventType" TEXT NOT NULL,
  "field" TEXT,
  "beforeValue" TEXT,
  "afterValue" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActionHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActionAnalysisSession" (
  "id" TEXT NOT NULL,
  "actionId" TEXT NOT NULL,
  "method" "ActionAnalysisTool" NOT NULL,
  "status" "ActionToolStatus" NOT NULL DEFAULT 'DRAFT',
  "problem" TEXT,
  "rootCause" TEXT,
  "responsibleUserId" TEXT,
  "data" JSONB,
  "aiSummary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ActionAnalysisSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActionFiveWhy" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "question" TEXT NOT NULL,
  "answer" TEXT,
  "evidence" TEXT,
  "aiPrompt" TEXT,
  "isRootCause" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ActionFiveWhy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActionIshikawaCause" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "impact" INTEGER NOT NULL DEFAULT 3,
  "probability" INTEGER NOT NULL DEFAULT 3,
  "evidence" TEXT,
  "likelyRootCause" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ActionIshikawaCause_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActionMaspStep" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "step" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "responsibleUserId" TEXT,
  "dueDate" TIMESTAMP(3),
  "evidence" TEXT,
  "comments" TEXT,
  "status" "ActionStepStatus" NOT NULL DEFAULT 'PENDING',
  "validated" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ActionMaspStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActionPdcaStep" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "phase" TEXT NOT NULL,
  "description" TEXT,
  "responsibleUserId" TEXT,
  "dueDate" TIMESTAMP(3),
  "evidence" TEXT,
  "comments" TEXT,
  "status" "ActionStepStatus" NOT NULL DEFAULT 'PENDING',
  "validated" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ActionPdcaStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActionFiveW2H" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "what" TEXT,
  "why" TEXT,
  "where" TEXT,
  "when" TIMESTAMP(3),
  "who" TEXT,
  "how" TEXT,
  "howMuch" DOUBLE PRECISION,
  "reviewNotes" TEXT,
  "completeScore" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ActionFiveW2H_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActionAiSuggestion" (
  "id" TEXT NOT NULL,
  "actionId" TEXT NOT NULL,
  "sessionId" TEXT,
  "suggestionType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "context" JSONB,
  "status" "ActionAiSuggestionStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  "decidedById" TEXT,
  CONSTRAINT "ActionAiSuggestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ActionPlan_branchId_idx" ON "ActionPlan"("branchId");
CREATE INDEX "ActionPlan_strategicObjectiveId_idx" ON "ActionPlan"("strategicObjectiveId");
CREATE INDEX "ActionPlan_indicatorResultId_idx" ON "ActionPlan"("indicatorResultId");
CREATE INDEX "ActionPlan_effectivenessStatus_idx" ON "ActionPlan"("effectivenessStatus");
CREATE INDEX "ActionParticipant_actionId_idx" ON "ActionParticipant"("actionId");
CREATE INDEX "ActionParticipant_userId_idx" ON "ActionParticipant"("userId");
CREATE INDEX "ActionEvidence_actionId_idx" ON "ActionEvidence"("actionId");
CREATE INDEX "ActionComment_actionId_createdAt_idx" ON "ActionComment"("actionId", "createdAt");
CREATE INDEX "ActionHistory_actionId_createdAt_idx" ON "ActionHistory"("actionId", "createdAt");
CREATE UNIQUE INDEX "ActionAnalysisSession_actionId_method_key" ON "ActionAnalysisSession"("actionId", "method");
CREATE INDEX "ActionAnalysisSession_actionId_idx" ON "ActionAnalysisSession"("actionId");
CREATE UNIQUE INDEX "ActionFiveWhy_sessionId_position_key" ON "ActionFiveWhy"("sessionId", "position");
CREATE INDEX "ActionIshikawaCause_sessionId_idx" ON "ActionIshikawaCause"("sessionId");
CREATE UNIQUE INDEX "ActionMaspStep_sessionId_step_key" ON "ActionMaspStep"("sessionId", "step");
CREATE UNIQUE INDEX "ActionPdcaStep_sessionId_phase_key" ON "ActionPdcaStep"("sessionId", "phase");
CREATE UNIQUE INDEX "ActionFiveW2H_sessionId_key" ON "ActionFiveW2H"("sessionId");
CREATE INDEX "ActionAiSuggestion_actionId_createdAt_idx" ON "ActionAiSuggestion"("actionId", "createdAt");
CREATE INDEX "ActionAiSuggestion_status_idx" ON "ActionAiSuggestion"("status");

ALTER TABLE "ActionParticipant" ADD CONSTRAINT "ActionParticipant_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "ActionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActionEvidence" ADD CONSTRAINT "ActionEvidence_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "ActionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActionComment" ADD CONSTRAINT "ActionComment_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "ActionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActionHistory" ADD CONSTRAINT "ActionHistory_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "ActionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActionAnalysisSession" ADD CONSTRAINT "ActionAnalysisSession_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "ActionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActionFiveWhy" ADD CONSTRAINT "ActionFiveWhy_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ActionAnalysisSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActionIshikawaCause" ADD CONSTRAINT "ActionIshikawaCause_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ActionAnalysisSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActionMaspStep" ADD CONSTRAINT "ActionMaspStep_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ActionAnalysisSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActionPdcaStep" ADD CONSTRAINT "ActionPdcaStep_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ActionAnalysisSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActionFiveW2H" ADD CONSTRAINT "ActionFiveW2H_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ActionAnalysisSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActionAiSuggestion" ADD CONSTRAINT "ActionAiSuggestion_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "ActionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
