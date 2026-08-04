-- Bloqueio de TELA por empresa.
-- O catálogo de páginas (PortalPage) é global: alterar o status ali afeta todos
-- os clientes. Esta tabela guarda a exceção por empresa, permitindo tirar uma
-- tela específica de um cliente sem mexer nos outros.
CREATE TABLE IF NOT EXISTS "PlatformCompanyPage" (
  "id"             TEXT NOT NULL,
  "companyId"      TEXT NOT NULL,
  "pageCode"       TEXT NOT NULL,
  "status"         TEXT NOT NULL DEFAULT 'HERDADO_DO_MODULO',
  "note"           TEXT,
  "updatedBy"      TEXT,
  "updatedByEmail" TEXT,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformCompanyPage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformCompanyPage_companyId_pageCode_key"
  ON "PlatformCompanyPage" ("companyId", "pageCode");
CREATE INDEX IF NOT EXISTS "PlatformCompanyPage_pageCode_idx"
  ON "PlatformCompanyPage" ("pageCode");
CREATE INDEX IF NOT EXISTS "PlatformCompanyPage_status_idx"
  ON "PlatformCompanyPage" ("status");
