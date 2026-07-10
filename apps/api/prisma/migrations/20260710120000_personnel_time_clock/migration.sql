-- Serviço Pessoal — Controle de Ponto (módulo personnel, Fase 2 do plano DP)

CREATE TABLE "work_shift_templates" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "toleranceMinutes" INTEGER NOT NULL DEFAULT 10,
    "weeklyRules" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "work_shift_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "work_shift_templates_companyId_name_key" ON "work_shift_templates"("companyId", "name");
CREATE INDEX "work_shift_templates_companyId_active_idx" ON "work_shift_templates"("companyId", "active");

CREATE TABLE "work_schedule_assignments" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_schedule_assignments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "work_schedule_assignments_companyId_userId_startsAt_idx" ON "work_schedule_assignments"("companyId", "userId", "startsAt");

ALTER TABLE "work_schedule_assignments" ADD CONSTRAINT "work_schedule_assignments_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "work_shift_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "time_clock_entries" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "punchedAt" TIMESTAMP(3) NOT NULL,
    "dayKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'WEB',
    "status" TEXT NOT NULL DEFAULT 'VALID',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "ip" TEXT,
    "userAgent" TEXT,
    "note" TEXT,
    "hash" TEXT NOT NULL,
    "prevHash" TEXT,
    "adjustmentRequestId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_clock_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "time_clock_entries_companyId_userId_dayKey_idx" ON "time_clock_entries"("companyId", "userId", "dayKey");
CREATE INDEX "time_clock_entries_companyId_dayKey_idx" ON "time_clock_entries"("companyId", "dayKey");

CREATE TABLE "time_adjustment_requests" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "proposedTimes" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "decidedById" TEXT,
    "decisionNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_adjustment_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "time_adjustment_requests_companyId_status_idx" ON "time_adjustment_requests"("companyId", "status");
CREATE INDEX "time_adjustment_requests_companyId_userId_dayKey_idx" ON "time_adjustment_requests"("companyId", "userId", "dayKey");

CREATE TABLE "timesheet_periods" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "periodRef" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "closedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "totals" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timesheet_periods_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "timesheet_periods_companyId_periodRef_key" ON "timesheet_periods"("companyId", "periodRef");
