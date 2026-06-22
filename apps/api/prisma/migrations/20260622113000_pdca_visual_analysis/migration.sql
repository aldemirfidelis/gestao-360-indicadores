-- PDCA visual analysis fields

ALTER TABLE "ActionPdcaStep"
  ADD COLUMN "title" TEXT,
  ADD COLUMN "subtitle" TEXT,
  ADD COLUMN "objective" TEXT,
  ADD COLUMN "priority" "ActionPriority" NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN "progress" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "checklist" JSONB,
  ADD COLUMN "data" JSONB,
  ADD COLUMN "isAiSuggested" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "convertedToTaskId" TEXT,
  ADD COLUMN "completedAt" TIMESTAMP(3);

UPDATE "ActionPdcaStep"
SET
  "title" = CASE "phase"
    WHEN 'PLAN' THEN 'Plan'
    WHEN 'DO' THEN 'Do'
    WHEN 'CHECK' THEN 'Check'
    WHEN 'ACT' THEN 'Act'
    ELSE "phase"
  END,
  "subtitle" = CASE "phase"
    WHEN 'PLAN' THEN 'Planejar causas, metas e ações'
    WHEN 'DO' THEN 'Executar ações definidas'
    WHEN 'CHECK' THEN 'Medir resultados e verificar eficácia'
    WHEN 'ACT' THEN 'Padronizar, corrigir e evoluir'
    ELSE NULL
  END
WHERE "title" IS NULL;

CREATE INDEX "ActionPdcaStep_responsibleUserId_idx" ON "ActionPdcaStep"("responsibleUserId");
CREATE INDEX "ActionPdcaStep_convertedToTaskId_idx" ON "ActionPdcaStep"("convertedToTaskId");
