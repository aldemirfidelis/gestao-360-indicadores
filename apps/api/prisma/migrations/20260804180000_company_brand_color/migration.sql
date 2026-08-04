-- Identidade visual por empresa: cor principal do portal.
-- O logo já existia (Company.logoUrl, usado no login do tenant) e passa a ser
-- exibido também no topo, ao lado da marca Gestão 360.
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "brandColor" TEXT;
