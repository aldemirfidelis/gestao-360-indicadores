-- Rastreio de origem para integracao/migracao de sistemas legados.
-- externalId     = chave primaria no sistema de origem (ex.: "18448", "18915")
-- externalSource = identificador da origem
-- Idempotente: pode ter sido aplicado parcialmente via `prisma db push` em dev.

-- 1. OrgNode
ALTER TABLE "OrgNode" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
ALTER TABLE "OrgNode" ADD COLUMN IF NOT EXISTS "externalSource" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "OrgNode_companyId_externalSource_externalId_key"
    ON "OrgNode"("companyId", "externalSource", "externalId");
CREATE INDEX IF NOT EXISTS "OrgNode_externalSource_externalId_idx"
    ON "OrgNode"("externalSource", "externalId");

-- 2. Indicator
ALTER TABLE "Indicator" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
ALTER TABLE "Indicator" ADD COLUMN IF NOT EXISTS "externalSource" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Indicator_companyId_externalSource_externalId_key"
    ON "Indicator"("companyId", "externalSource", "externalId");
CREATE INDEX IF NOT EXISTS "Indicator_externalSource_externalId_idx"
    ON "Indicator"("externalSource", "externalId");
