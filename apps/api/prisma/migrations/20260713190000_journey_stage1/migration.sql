-- Etapa 1 da Gestão de Jornada: feriados, vigência congelada de escala,
-- versões de fechamento e campos de auditoria/idempotência na batida.
-- Migração 100% aditiva: nenhuma linha existente é alterada além do backfill
-- de snapshot (que copia as regras atuais do template para a vigência).

CREATE TABLE "company_holidays" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "dayKey" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'NATIONAL',
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_holidays_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "company_holidays_companyId_dayKey_key" ON "company_holidays"("companyId", "dayKey");

CREATE TABLE "timesheet_period_versions" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "periodRef" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "totals" JSONB NOT NULL,
  "closedById" TEXT,
  "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reopenedById" TEXT,
  "reopenedAt" TIMESTAMP(3),
  "reopenNote" TEXT,
  CONSTRAINT "timesheet_period_versions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "timesheet_period_versions_companyId_periodRef_version_key" ON "timesheet_period_versions"("companyId", "periodRef", "version");
CREATE INDEX "timesheet_period_versions_companyId_periodRef_idx" ON "timesheet_period_versions"("companyId", "periodRef");

ALTER TABLE "work_schedule_assignments" ADD COLUMN "rulesSnapshot" JSONB;
ALTER TABLE "work_schedule_assignments" ADD COLUMN "toleranceSnapshot" INTEGER;

-- Backfill: congela nas vigências existentes as regras atuais do template
-- (comportamento até aqui era usar sempre o template; o snapshot preserva isso).
UPDATE "work_schedule_assignments" a
SET "rulesSnapshot" = t."weeklyRules", "toleranceSnapshot" = t."toleranceMinutes"
FROM "work_shift_templates" t
WHERE a."templateId" = t."id" AND a."rulesSnapshot" IS NULL;

ALTER TABLE "time_clock_entries" ADD COLUMN "deviceTime" TIMESTAMP(3);
ALTER TABLE "time_clock_entries" ADD COLUMN "deviceId" TEXT;
ALTER TABLE "time_clock_entries" ADD COLUMN "syncId" TEXT;

-- Idempotência de sincronização offline: um syncId não pode repetir na empresa.
CREATE UNIQUE INDEX "time_clock_entries_companyId_syncId_key"
  ON "time_clock_entries"("companyId", "syncId") WHERE "syncId" IS NOT NULL;

ALTER TABLE "timesheet_periods" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

-- Competências já fechadas ganham a versão 1 no histórico (preserva o consolidado atual).
INSERT INTO "timesheet_period_versions" ("id", "companyId", "periodRef", "version", "totals", "closedById", "closedAt")
SELECT gen_random_uuid()::text, p."companyId", p."periodRef", 1, COALESCE(p."totals", '{}'::jsonb), p."closedById", COALESCE(p."closedAt", CURRENT_TIMESTAMP)
FROM "timesheet_periods" p
WHERE p."status" = 'CLOSED';

UPDATE "timesheet_periods" SET "version" = 1 WHERE "status" = 'CLOSED';
