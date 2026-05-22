ALTER TABLE "Indicator" ADD COLUMN "guidelineNodeId" TEXT;

CREATE INDEX "Indicator_guidelineNodeId_idx" ON "Indicator"("guidelineNodeId");

ALTER TABLE "Indicator"
  ADD CONSTRAINT "Indicator_guidelineNodeId_fkey"
  FOREIGN KEY ("guidelineNodeId")
  REFERENCES "OrgNode"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
