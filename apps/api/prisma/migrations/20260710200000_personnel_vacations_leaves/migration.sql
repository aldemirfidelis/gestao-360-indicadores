-- Serviço Pessoal — Férias e Afastamentos (Fase 3 do plano DP)

CREATE TABLE "vacation_requests" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "days" INTEGER NOT NULL,
    "periodRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "notes" TEXT,
    "managerDecidedById" TEXT,
    "managerDecidedAt" TIMESTAMP(3),
    "finalDecidedById" TEXT,
    "finalDecidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vacation_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "vacation_requests_companyId_employeeId_startDate_idx" ON "vacation_requests"("companyId", "employeeId", "startDate");
CREATE INDEX "vacation_requests_companyId_status_idx" ON "vacation_requests"("companyId", "status");

ALTER TABLE "vacation_requests" ADD CONSTRAINT "vacation_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "OrgEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "leave_records" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "cid" TEXT,
    "description" TEXT,
    "dossierFileId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "leave_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "leave_records_companyId_employeeId_startDate_idx" ON "leave_records"("companyId", "employeeId", "startDate");
CREATE INDEX "leave_records_companyId_deletedAt_idx" ON "leave_records"("companyId", "deletedAt");

ALTER TABLE "leave_records" ADD CONSTRAINT "leave_records_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "OrgEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
