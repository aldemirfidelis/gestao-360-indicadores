-- Ponto: almoço automático e isenção de registro (cargo de confiança) por colaborador.
ALTER TABLE "PersonnelEmployeeProfile" ADD COLUMN "autoLunch" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PersonnelEmployeeProfile" ADD COLUMN "timeClockExempt" BOOLEAN NOT NULL DEFAULT false;
