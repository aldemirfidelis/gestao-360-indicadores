ALTER TABLE "ActionEvidence"
  ADD COLUMN "taskId" TEXT,
  ADD COLUMN "mimeType" TEXT,
  ADD COLUMN "sizeBytes" INTEGER,
  ADD COLUMN "data" BYTEA;

CREATE INDEX "ActionEvidence_taskId_idx" ON "ActionEvidence"("taskId");

ALTER TABLE "ActionEvidence"
  ADD CONSTRAINT "ActionEvidence_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "ActionTask"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
