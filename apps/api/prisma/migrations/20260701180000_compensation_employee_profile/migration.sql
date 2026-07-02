-- Perfil de remuneracao do colaborador (1:1 com OrgEmployee): dados
-- demograficos (equidade salarial / Lei 14.611) e rating de desempenho para a
-- matriz de merito. Tabela separada para segregar dado pessoal sensivel e nao
-- impactar as queries existentes de OrgEmployee.
CREATE TABLE "compensation_employee_profiles" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "gender" TEXT,
    "raceEthnicity" TEXT,
    "admissionDate" TIMESTAMP(3),
    "performanceRating" INTEGER,
    "performanceCycleRef" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compensation_employee_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "compensation_employee_profiles_employeeId_key" ON "compensation_employee_profiles"("employeeId");

CREATE INDEX "compensation_employee_profiles_companyId_idx" ON "compensation_employee_profiles"("companyId");

ALTER TABLE "compensation_employee_profiles" ADD CONSTRAINT "compensation_employee_profiles_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "compensation_employee_profiles" ADD CONSTRAINT "compensation_employee_profiles_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "OrgEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
