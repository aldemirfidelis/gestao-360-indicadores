-- Folha / eSocial: campos cadastrais exigidos pelos eventos (S-2200 etc.).
-- Aditiva: sexo/raça-cor no prontuário e CBO no cargo.

ALTER TABLE "personnel_employee_profiles" ADD COLUMN IF NOT EXISTS "sex" TEXT;
ALTER TABLE "personnel_employee_profiles" ADD COLUMN IF NOT EXISTS "raceColor" TEXT;
ALTER TABLE "OrgJob" ADD COLUMN IF NOT EXISTS "cbo" TEXT;
