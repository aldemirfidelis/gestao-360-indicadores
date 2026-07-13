-- Etapa 2 da Gestão de Jornada: escalas cíclicas, sequência interna de
-- registros, extrato versionado e infraestrutura segura para totens piloto.
-- IMPORTANTE: a sequência/hash internos não representam, isoladamente, uma
-- implementação certificada de REP-P/ARP/AFD nos termos da Portaria 671.

ALTER TABLE "work_shift_templates" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'WEEKLY';
ALTER TABLE "work_shift_templates" ADD COLUMN "cycleRules" JSONB;
ALTER TABLE "work_shift_templates" ADD COLUMN "worksHolidays" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "work_shift_templates"
  ADD CONSTRAINT "work_shift_templates_kind_check" CHECK ("kind" IN ('WEEKLY', 'CYCLE')),
  ADD CONSTRAINT "work_shift_templates_rules_check" CHECK (
    ("kind" = 'WEEKLY' AND "cycleRules" IS NULL)
    OR ("kind" = 'CYCLE' AND jsonb_typeof("cycleRules") = 'array')
  );

ALTER TABLE "work_schedule_assignments" ADD COLUMN "cycleAnchorDay" TEXT;
ALTER TABLE "work_schedule_assignments"
  ADD CONSTRAINT "work_schedule_assignments_cycle_anchor_check"
  CHECK ("cycleAnchorDay" IS NULL OR "cycleAnchorDay" ~ '^\d{4}-\d{2}-\d{2}$');

CREATE TABLE "personnel_kiosk_devices" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "branchId" TEXT,
  "name" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
  "lastRotatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "lastSeenAt" TIMESTAMP(3),
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "radiusMeters" INTEGER,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "personnel_kiosk_devices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "personnel_kiosk_devices_geo_check" CHECK (
    ("latitude" IS NULL AND "longitude" IS NULL AND "radiusMeters" IS NULL)
    OR ("latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180 AND "radiusMeters" BETWEEN 25 AND 5000)
  )
);
CREATE UNIQUE INDEX "personnel_kiosk_devices_tokenHash_key" ON "personnel_kiosk_devices"("tokenHash");
CREATE INDEX "personnel_kiosk_devices_companyId_branchId_active_idx"
  ON "personnel_kiosk_devices"("companyId", "branchId", "active");

CREATE TABLE "personnel_kiosk_challenges" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "nonceHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "syncId" TEXT,
  "entryId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "personnel_kiosk_challenges_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "personnel_kiosk_challenges_deviceId_expiresAt_idx"
  ON "personnel_kiosk_challenges"("deviceId", "expiresAt");
CREATE INDEX "personnel_kiosk_challenges_companyId_syncId_idx"
  ON "personnel_kiosk_challenges"("companyId", "syncId");

CREATE TABLE "personnel_counters" (
  "companyId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT "personnel_counters_pkey" PRIMARY KEY ("companyId", "key")
);

ALTER TABLE "time_clock_entries" ADD COLUMN "sequenceScope" TEXT;
ALTER TABLE "time_clock_entries" ADD COLUMN "nsr" BIGINT;

-- O escopo é congelado na batida. Para o legado, usa a unidade atual do
-- colaborador; sem unidade, cai no escopo geral da empresa e fica marcado como
-- backfill no snapshot do extrato.
UPDATE "time_clock_entries" e
SET "sequenceScope" = COALESCE(u."branchId", 'company:' || e."companyId")
FROM "User" u
WHERE u."id" = e."userId" AND u."companyId" = e."companyId";

UPDATE "time_clock_entries"
SET "sequenceScope" = 'company:' || "companyId"
WHERE "sequenceScope" IS NULL;

WITH numbered AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "companyId", "sequenceScope"
    ORDER BY "createdAt", "id"
  ) AS seq
  FROM "time_clock_entries"
)
UPDATE "time_clock_entries" e
SET "nsr" = n.seq
FROM numbered n
WHERE e."id" = n."id" AND e."nsr" IS NULL;

ALTER TABLE "time_clock_entries" ALTER COLUMN "sequenceScope" SET NOT NULL;
ALTER TABLE "time_clock_entries" ALTER COLUMN "nsr" SET NOT NULL;
CREATE UNIQUE INDEX "time_clock_entries_companyId_sequenceScope_nsr_key"
  ON "time_clock_entries"("companyId", "sequenceScope", "nsr");

CREATE TABLE "time_clock_entry_treatments" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "adjustmentRequestId" TEXT NOT NULL,
  "action" TEXT NOT NULL DEFAULT 'EXCLUDE',
  "reason" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "time_clock_entry_treatments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "time_clock_entry_treatments_entryId_fkey"
    FOREIGN KEY ("entryId") REFERENCES "time_clock_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "time_clock_entry_treatments_action_check" CHECK ("action" = 'EXCLUDE')
);
CREATE UNIQUE INDEX "time_clock_entry_treatments_entry_request_action_key"
  ON "time_clock_entry_treatments"("entryId", "adjustmentRequestId", "action");
CREATE INDEX "time_clock_entry_treatments_company_request_idx"
  ON "time_clock_entry_treatments"("companyId", "adjustmentRequestId");

-- Converte o tratamento legado em evento append-only e restaura o registro
-- bruto para VALID. O vínculo é possível quando adjustmentRequestId já existe.
INSERT INTO "time_clock_entry_treatments" (
  "id", "companyId", "entryId", "adjustmentRequestId", "action", "reason", "createdById", "createdAt"
)
SELECT gen_random_uuid()::text, e."companyId", e."id", r."id", 'EXCLUDE',
       'Tratamento legado migrado', r."decidedById", COALESCE(r."decidedAt", e."createdAt")
FROM "time_clock_entries" e
JOIN LATERAL (
  SELECT a."id", a."decidedById", a."decidedAt"
  FROM "time_adjustment_requests" a
  WHERE a."companyId" = e."companyId" AND a."userId" = e."userId"
    AND a."dayKey" = e."dayKey" AND a."status" = 'APPROVED'
  ORDER BY a."decidedAt" DESC NULLS LAST, a."createdAt" DESC
  LIMIT 1
) r ON true
WHERE e."status" = 'CANCELLED'
ON CONFLICT ("entryId", "adjustmentRequestId", "action") DO NOTHING;

UPDATE "time_clock_entries"
SET "status" = 'VALID'
WHERE "id" IN (SELECT "entryId" FROM "time_clock_entry_treatments" WHERE "action" = 'EXCLUDE');

INSERT INTO "personnel_counters" ("companyId", "key", "value")
SELECT "companyId", 'time-clock-sequence:' || "sequenceScope", COALESCE(MAX("nsr"), 0)
FROM "time_clock_entries"
GROUP BY "companyId", "sequenceScope"
ON CONFLICT ("companyId", "key") DO UPDATE SET "value" = EXCLUDED."value";

CREATE TABLE "time_clock_receipt_snapshots" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "companyRegistrationMasked" TEXT,
  "employeeName" TEXT NOT NULL,
  "employeeRegistrationMasked" TEXT,
  "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  "snapshotOrigin" TEXT NOT NULL DEFAULT 'PUNCH',
  "checksum" TEXT NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "time_clock_receipt_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "time_clock_receipt_snapshots_entryId_key" ON "time_clock_receipt_snapshots"("entryId");
CREATE INDEX "time_clock_receipt_snapshots_companyId_capturedAt_idx"
  ON "time_clock_receipt_snapshots"("companyId", "capturedAt");

-- Snapshot legado usa os dados atuais, explicitamente identificado como
-- LEGACY_BACKFILL; não deve ser apresentado como evidência histórica certificada.
INSERT INTO "time_clock_receipt_snapshots" (
  "id", "companyId", "entryId", "companyName", "companyRegistrationMasked",
  "employeeName", "employeeRegistrationMasked", "snapshotOrigin", "checksum", "capturedAt"
)
SELECT
  gen_random_uuid()::text,
  e."companyId",
  e."id",
  c."name",
  CASE WHEN c."cnpj" IS NULL THEN NULL ELSE '***' || RIGHT(regexp_replace(c."cnpj", '\D', '', 'g'), 4) END,
  u."name",
  CASE WHEN p."cpf" IS NULL THEN NULL ELSE '***' || RIGHT(regexp_replace(p."cpf", '\D', '', 'g'), 4) END,
  'LEGACY_BACKFILL',
  md5(e."id" || '|' || e."hash" || '|' || e."punchedAt"::text),
  e."createdAt"
FROM "time_clock_entries" e
JOIN "Company" c ON c."id" = e."companyId"
JOIN "User" u ON u."id" = e."userId" AND u."companyId" = e."companyId"
LEFT JOIN LATERAL (
  SELECT profile."cpf"
  FROM "personnel_employee_profiles" profile
  WHERE profile."companyId" = e."companyId" AND profile."userId" = e."userId"
  ORDER BY profile."updatedAt" DESC
  LIMIT 1
) p ON true;

ALTER TABLE "time_clock_receipt_snapshots"
  ADD CONSTRAINT "time_clock_receipt_snapshots_entryId_fkey"
  FOREIGN KEY ("entryId") REFERENCES "time_clock_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "timesheet_calculation_memories" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "dayKey" TEXT NOT NULL,
  "algorithmVersion" TEXT NOT NULL,
  "inputHash" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "calculatedById" TEXT,
  "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "timesheet_calculation_memories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "timesheet_calc_memory_company_user_day_algorithm_input_key"
  ON "timesheet_calculation_memories"("companyId", "userId", "dayKey", "algorithmVersion", "inputHash");
CREATE INDEX "timesheet_calc_memory_company_user_day_calculated_idx"
  ON "timesheet_calculation_memories"("companyId", "userId", "dayKey", "calculatedAt");

-- Defesa em profundidade: marcações brutas são append-only. Correções usam a
-- tabela de tratamento e novas entradas, nunca UPDATE/DELETE no registro bruto.
CREATE OR REPLACE FUNCTION prevent_time_clock_entry_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'time_clock_entries is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "time_clock_entries_append_only"
BEFORE UPDATE OR DELETE ON "time_clock_entries"
FOR EACH ROW EXECUTE FUNCTION prevent_time_clock_entry_mutation();
