-- Etapa 6 da Gestão de Jornada: Central Fiscal (identificação legal do
-- empregador para AFD/AEJ — Portaria 671). Aditiva.

CREATE TABLE "personnel_legal_configs" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "employerIdType" INTEGER NOT NULL DEFAULT 1,
  "cnoCaepf" TEXT,
  "inpiRegistry" TEXT,
  "softwareVersion" TEXT NOT NULL DEFAULT 'gestao360-ponto',
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "personnel_legal_configs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "personnel_legal_configs_companyId_key" ON "personnel_legal_configs"("companyId");
