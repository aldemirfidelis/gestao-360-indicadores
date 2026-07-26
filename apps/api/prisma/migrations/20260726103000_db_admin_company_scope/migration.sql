-- Escopo empresarial obrigatorio para auditorias e backups do administrador de dados.
-- Registros historicos permanecem com companyId NULL e nao sao exibidos em contextos empresariais.
ALTER TABLE "DbAdminAuditLog" ADD COLUMN "companyId" TEXT;
ALTER TABLE "DbAdminBackup" ADD COLUMN "companyId" TEXT;

CREATE INDEX "DbAdminAuditLog_companyId_createdAt_idx"
  ON "DbAdminAuditLog"("companyId", "createdAt");
CREATE INDEX "DbAdminBackup_companyId_createdAt_idx"
  ON "DbAdminBackup"("companyId", "createdAt");
