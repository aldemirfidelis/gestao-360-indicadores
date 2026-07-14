-- Etapa 4 da Gestão de Jornada: banco de horas como livro-razão (contas,
-- extrato, validade CLT configurável e vencimento). Aditiva.

CREATE TABLE "time_bank_policies" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "validityMonths" INTEGER NOT NULL DEFAULT 6,
  "maxPositiveMinutes" INTEGER,
  "maxNegativeMinutes" INTEGER,
  "expirationAction" TEXT NOT NULL DEFAULT 'PAYOUT',
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "time_bank_policies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "time_bank_policies_companyId_key" ON "time_bank_policies"("companyId");

CREATE TABLE "time_bank_entries" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "minutes" INTEGER NOT NULL,
  "periodRef" TEXT,
  "expiresAt" TIMESTAMP(3),
  "consumed" INTEGER NOT NULL DEFAULT 0,
  "note" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "time_bank_entries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "time_bank_entries_companyId_userId_periodRef_source_key" ON "time_bank_entries"("companyId", "userId", "periodRef", "source");
CREATE INDEX "time_bank_entries_companyId_userId_createdAt_idx" ON "time_bank_entries"("companyId", "userId", "createdAt");
CREATE INDEX "time_bank_entries_companyId_expiresAt_idx" ON "time_bank_entries"("companyId", "expiresAt");

-- Backfill: cada competência já fechada vira um lançamento CLOSING no razão,
-- preservando o saldo histórico do banco (idempotente pela constraint).
INSERT INTO "time_bank_entries" ("id", "companyId", "userId", "kind", "source", "minutes", "periodRef", "createdById", "createdAt")
SELECT
  gen_random_uuid()::text,
  p."companyId",
  u.key AS "userId",
  CASE WHEN COALESCE((u.value ->> 'balanceMinutes')::int, 0) >= 0 THEN 'CREDIT' ELSE 'DEBIT' END,
  'CLOSING',
  COALESCE((u.value ->> 'balanceMinutes')::int, 0),
  p."periodRef",
  p."closedById",
  COALESCE(p."closedAt", CURRENT_TIMESTAMP)
FROM "timesheet_periods" p
CROSS JOIN LATERAL jsonb_each(COALESCE(p."totals" -> 'users', '{}'::jsonb)) AS u(key, value)
WHERE p."status" = 'CLOSED'
  AND COALESCE((u.value ->> 'balanceMinutes')::int, 0) <> 0
ON CONFLICT ("companyId", "userId", "periodRef", "source") DO NOTHING;
