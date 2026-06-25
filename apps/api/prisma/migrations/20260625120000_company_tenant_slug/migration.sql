-- Multi-tenant por subdomínio: slug (subdomínio) e customDomain (white-label) por empresa.
ALTER TABLE "Company" ADD COLUMN "slug" TEXT;
ALTER TABLE "Company" ADD COLUMN "customDomain" TEXT;

-- Índices únicos (NULLs não conflitam no Postgres, então empresas sem slug coexistem).
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");
CREATE UNIQUE INDEX "Company_customDomain_key" ON "Company"("customDomain");
