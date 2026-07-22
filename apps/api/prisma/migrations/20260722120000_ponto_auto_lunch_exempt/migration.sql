-- Ponto: almoco automatico e isencao de registro (cargo de confianca) por colaborador.
ALTER TABLE "personnel_employee_profiles" ADD COLUMN IF NOT EXISTS "autoLunch" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "personnel_employee_profiles" ADD COLUMN IF NOT EXISTS "timeClockExempt" BOOLEAN NOT NULL DEFAULT false;
