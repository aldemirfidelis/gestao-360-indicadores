-- Cadastro de recrutadores (vem da área de RH) + líder acompanhante na requisição.

-- Recrutador que conduz as seleções.
CREATE TABLE "recruit_recruiters" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leadUserId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recruit_recruiters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recruit_recruiters_companyId_userId_key" ON "recruit_recruiters"("companyId", "userId");
CREATE INDEX "recruit_recruiters_companyId_active_idx" ON "recruit_recruiters"("companyId", "active");

-- Líder do recrutador que acompanha a seleção (aditivo, retrocompatível).
ALTER TABLE "recruit_requisitions" ADD COLUMN "recruiterLeadId" TEXT;
