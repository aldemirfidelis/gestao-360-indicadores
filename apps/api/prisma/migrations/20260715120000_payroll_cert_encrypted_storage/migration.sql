-- Folha / eSocial: custódia cifrada do certificado A1 (modo ENCRYPTED_DB).
-- Guarda o PFX e a senha CIFRADOS (AES-256-GCM), nunca em texto puro. Aditiva.

ALTER TABLE "payroll_digital_certificates" ADD COLUMN IF NOT EXISTS "encryptedPfx" TEXT;
ALTER TABLE "payroll_digital_certificates" ADD COLUMN IF NOT EXISTS "encryptedPassword" TEXT;
ALTER TABLE "payroll_digital_certificates" ADD COLUMN IF NOT EXISTS "subjectName" TEXT;
