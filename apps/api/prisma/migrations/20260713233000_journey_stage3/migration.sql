-- Etapa 3 da Gestão de Jornada: Central de Ocorrências + ajustes por tipo
-- (correção de horários ou abono do dia) com motivo categorizado. Aditiva.

ALTER TABLE "time_adjustment_requests" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'HORARIOS';
ALTER TABLE "time_adjustment_requests" ADD COLUMN "category" TEXT;

CREATE TABLE "attendance_occurrences" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "dayKey" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "minutes" INTEGER,
  "detail" JSONB,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "justification" TEXT,
  "treatedById" TEXT,
  "treatedAt" TIMESTAMP(3),
  "adjustmentRequestId" TEXT,
  "firstDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "attendance_occurrences_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "attendance_occurrences_companyId_userId_dayKey_type_key" ON "attendance_occurrences"("companyId", "userId", "dayKey", "type");
CREATE INDEX "attendance_occurrences_companyId_status_dayKey_idx" ON "attendance_occurrences"("companyId", "status", "dayKey");
CREATE INDEX "attendance_occurrences_companyId_userId_dayKey_idx" ON "attendance_occurrences"("companyId", "userId", "dayKey");
