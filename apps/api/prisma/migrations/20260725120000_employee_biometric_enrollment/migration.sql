-- Cadastro biométrico administrativo passa a pertencer ao colaborador
-- (OrgEmployee/matrícula), mantendo userId apenas para compatibilidade com o
-- motor de jornada existente.

ALTER TABLE "User"
  ADD COLUMN "serviceAccount" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "personnel_biometric_profiles"
  ADD COLUMN "employeeId" TEXT;

ALTER TABLE "personnel_biometric_challenges"
  ADD COLUMN "employeeId" TEXT;

ALTER TABLE "personnel_biometric_attempts"
  ADD COLUMN "employeeId" TEXT;

-- Aproveita vínculos funcionais existentes sem invalidar perfis faciais
-- legados de usuários que ainda não possuem OrgEmployee.
UPDATE "personnel_biometric_profiles" biometric
SET "employeeId" = employee_profile."employeeId"
FROM "personnel_employee_profiles" employee_profile
WHERE employee_profile."companyId" = biometric."companyId"
  AND employee_profile."userId" = biometric."userId"
  AND biometric."employeeId" IS NULL;

CREATE UNIQUE INDEX "personnel_biometric_profiles_employeeId_key"
  ON "personnel_biometric_profiles"("employeeId");

CREATE INDEX "personnel_biometric_challenges_companyId_employeeId_purpose_expiresAt_idx"
  ON "personnel_biometric_challenges"("companyId", "employeeId", "purpose", "expiresAt");

CREATE INDEX "personnel_biometric_attempts_companyId_employeeId_createdAt_idx"
  ON "personnel_biometric_attempts"("companyId", "employeeId", "createdAt");

ALTER TABLE "personnel_biometric_profiles"
  ADD CONSTRAINT "personnel_biometric_profiles_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "OrgEmployee"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
