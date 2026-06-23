-- Link action plans directly to OKR objectives so OKR progress can roll up from plan tasks.
ALTER TABLE "ActionPlan" ADD COLUMN "okrObjectiveId" TEXT;

ALTER TABLE "ActionPlan"
  ADD CONSTRAINT "ActionPlan_okrObjectiveId_fkey"
  FOREIGN KEY ("okrObjectiveId") REFERENCES "OKRObjective"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ActionPlan_okrObjectiveId_idx" ON "ActionPlan"("okrObjectiveId");
