-- Serviço Pessoal — Admissão/Desligamento digital + ASO (Fase 4 do plano DP)

CREATE TABLE "employee_processes" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_processes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employee_processes_companyId_kind_status_idx" ON "employee_processes"("companyId", "kind", "status");
CREATE INDEX "employee_processes_companyId_employeeId_idx" ON "employee_processes"("companyId", "employeeId");

ALTER TABLE "employee_processes" ADD CONSTRAINT "employee_processes_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "OrgEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "employee_process_items" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "dossierKind" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "doneAt" TIMESTAMP(3),
    "doneById" TEXT,
    "note" TEXT,

    CONSTRAINT "employee_process_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employee_process_items_companyId_processId_idx" ON "employee_process_items"("companyId", "processId");

ALTER TABLE "employee_process_items" ADD CONSTRAINT "employee_process_items_processId_fkey" FOREIGN KEY ("processId") REFERENCES "employee_processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "medical_exams" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "examDate" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "result" TEXT NOT NULL DEFAULT 'APTO',
    "physician" TEXT,
    "notes" TEXT,
    "dossierFileId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "medical_exams_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "medical_exams_companyId_employeeId_examDate_idx" ON "medical_exams"("companyId", "employeeId", "examDate");
CREATE INDEX "medical_exams_companyId_validUntil_idx" ON "medical_exams"("companyId", "validUntil");

ALTER TABLE "medical_exams" ADD CONSTRAINT "medical_exams_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "OrgEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
