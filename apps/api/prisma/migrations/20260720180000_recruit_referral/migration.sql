-- Indicação (referral): rastreia o colaborador interno que indicou o candidato
-- via link ?ref=<userId> na vaga pública. Ativa o RecruitRequisition.allowsReferral
-- (campo já existia, nunca era lido).
ALTER TABLE "recruit_applications" ADD COLUMN "referredByUserId" TEXT;
CREATE INDEX "recruit_applications_referredByUserId_idx" ON "recruit_applications"("referredByUserId");
