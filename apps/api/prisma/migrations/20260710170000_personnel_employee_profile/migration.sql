-- Serviço Pessoal — Prontuário do colaborador (Fase 1 do plano DP)

CREATE TABLE "personnel_employee_profiles" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "userId" TEXT,
    "cpf" TEXT,
    "rg" TEXT,
    "pisPasep" TEXT,
    "ctpsNumber" TEXT,
    "birthDate" TIMESTAMP(3),
    "phone" TEXT,
    "personalEmail" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "maritalStatus" TEXT,
    "educationLevel" TEXT,
    "contractType" TEXT,
    "workRegime" TEXT,
    "admissionDate" TIMESTAMP(3),
    "terminationDate" TIMESTAMP(3),
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personnel_employee_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "personnel_employee_profiles_employeeId_key" ON "personnel_employee_profiles"("employeeId");
CREATE UNIQUE INDEX "personnel_employee_profiles_companyId_cpf_key" ON "personnel_employee_profiles"("companyId", "cpf");
CREATE INDEX "personnel_employee_profiles_companyId_idx" ON "personnel_employee_profiles"("companyId");
CREATE INDEX "personnel_employee_profiles_companyId_userId_idx" ON "personnel_employee_profiles"("companyId", "userId");

ALTER TABLE "personnel_employee_profiles" ADD CONSTRAINT "personnel_employee_profiles_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "OrgEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "employee_dependents" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "cpf" TEXT,
    "isIrDependent" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_dependents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employee_dependents_companyId_employeeId_idx" ON "employee_dependents"("companyId", "employeeId");

ALTER TABLE "employee_dependents" ADD CONSTRAINT "employee_dependents_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "OrgEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "employment_events" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employment_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employment_events_companyId_employeeId_effectiveDate_idx" ON "employment_events"("companyId", "employeeId", "effectiveDate");

ALTER TABLE "employment_events" ADD CONSTRAINT "employment_events_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "OrgEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "employee_dossier_files" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "hashSha256" TEXT,
    "storageKey" TEXT NOT NULL,
    "validUntil" TIMESTAMP(3),
    "documentId" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "employee_dossier_files_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employee_dossier_files_companyId_employeeId_idx" ON "employee_dossier_files"("companyId", "employeeId");
CREATE INDEX "employee_dossier_files_companyId_validUntil_idx" ON "employee_dossier_files"("companyId", "validUntil");

ALTER TABLE "employee_dossier_files" ADD CONSTRAINT "employee_dossier_files_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "OrgEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
