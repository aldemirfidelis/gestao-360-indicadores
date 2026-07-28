-- Participantes da inspeção (nome, cargo/função e gestor responsável).
-- Vêm do cadastro funcional pela matrícula; ficam gravados no registro para o
-- documento continuar íntegro mesmo se a pessoa mudar de cargo depois.
ALTER TABLE "FormSubmission" ADD COLUMN IF NOT EXISTS "participants" JSONB;
