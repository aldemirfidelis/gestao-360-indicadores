-- Super Admin "empresa ativa" (impersonação): empresa que o super admin escolheu administrar.
-- Aditiva, sem perda de dados; null = usa a empresa de origem (User.companyId).
ALTER TABLE "User" ADD COLUMN "activeCompanyId" TEXT;
