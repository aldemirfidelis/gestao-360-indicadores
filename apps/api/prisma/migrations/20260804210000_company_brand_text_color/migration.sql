-- Cor das letras do cabeçalho e do menu, por empresa.
-- Vazio = calculada a partir da cor principal (contraste automático).
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "brandTextColor" TEXT;
