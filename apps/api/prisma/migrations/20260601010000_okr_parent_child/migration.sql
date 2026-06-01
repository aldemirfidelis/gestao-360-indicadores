-- Hierarquia pai/filho de objetivos OKR (para fluxograma ReactFlow).
-- Idempotente: pode ter sido aplicado parcialmente via `prisma db push` em dev.

ALTER TABLE "OKRObjective" ADD COLUMN IF NOT EXISTS "parentId" TEXT;
CREATE INDEX IF NOT EXISTS "OKRObjective_parentId_idx" ON "OKRObjective"("parentId");
DO $$ BEGIN
    ALTER TABLE "OKRObjective" ADD CONSTRAINT "OKRObjective_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "OKRObjective"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
