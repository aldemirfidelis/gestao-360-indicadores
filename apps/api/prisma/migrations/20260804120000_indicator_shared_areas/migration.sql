-- Indicador compartilhado entre áreas.
-- O indicador continua com UMA área dona (Indicator.ownerNodeId), responsável
-- pelo lançamento e pela apresentação; esta tabela guarda as áreas participantes,
-- que passam a ver o mesmo indicador no Painel Executivo e na Reunião Mensal.
CREATE TABLE IF NOT EXISTS "IndicatorSharedArea" (
  "id"          TEXT NOT NULL,
  "indicatorId" TEXT NOT NULL,
  "orgNodeId"   TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IndicatorSharedArea_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IndicatorSharedArea_indicatorId_orgNodeId_key"
  ON "IndicatorSharedArea" ("indicatorId", "orgNodeId");
CREATE INDEX IF NOT EXISTS "IndicatorSharedArea_indicatorId_idx"
  ON "IndicatorSharedArea" ("indicatorId");
CREATE INDEX IF NOT EXISTS "IndicatorSharedArea_orgNodeId_idx"
  ON "IndicatorSharedArea" ("orgNodeId");

DO $$
BEGIN
  ALTER TABLE "IndicatorSharedArea"
    ADD CONSTRAINT "IndicatorSharedArea_indicatorId_fkey"
    FOREIGN KEY ("indicatorId") REFERENCES "Indicator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "IndicatorSharedArea"
    ADD CONSTRAINT "IndicatorSharedArea_orgNodeId_fkey"
    FOREIGN KEY ("orgNodeId") REFERENCES "OrgNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Card do indicador compartilhado na Reunião Mensal: a área participante prepara
-- e comenta, mas quem leva ao telão é a área dona.
ALTER TABLE "MonthlyMeetingIndicator"
  ADD COLUMN IF NOT EXISTS "isShared" BOOLEAN NOT NULL DEFAULT false;
