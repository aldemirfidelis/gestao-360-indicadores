-- Ishikawa visual analysis fields

ALTER TABLE "ActionIshikawaCause"
  ADD COLUMN "title" TEXT,
  ADD COLUMN "priority" "ActionPriority" NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "responsibleUserId" TEXT,
  ADD COLUMN "dueDate" TIMESTAMP(3),
  ADD COLUMN "positionX" DOUBLE PRECISION,
  ADD COLUMN "positionY" DOUBLE PRECISION,
  ADD COLUMN "orderIndex" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "tags" JSONB,
  ADD COLUMN "isAiSuggested" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "convertedToTaskId" TEXT;

UPDATE "ActionIshikawaCause"
SET "title" = "description"
WHERE "title" IS NULL;

CREATE INDEX "ActionIshikawaCause_responsibleUserId_idx" ON "ActionIshikawaCause"("responsibleUserId");
CREATE INDEX "ActionIshikawaCause_convertedToTaskId_idx" ON "ActionIshikawaCause"("convertedToTaskId");
