-- Candidato global do portal de vagas: a identidade (login) deixa de ser vinculada
-- a uma empresa. O e-mail passa a ser único no portal inteiro; o contexto de empresa
-- de cada ação (candidatura, documento) vem da VAGA, não do candidato.

-- 1) Identidade global: companyId opcional + e-mail único global.
ALTER TABLE "recruit_candidates" ALTER COLUMN "companyId" DROP NOT NULL;
DROP INDEX IF EXISTS "recruit_candidates_companyId_emailNormalized_key";
CREATE UNIQUE INDEX "recruit_candidates_emailNormalized_key" ON "recruit_candidates"("emailNormalized");

-- 2) Tabelas-filhas do candidato: companyId opcional (contexto = vaga/candidatura,
--    ou nulo para recursos do próprio candidato, ex.: currículo geral e OTP de acesso).
ALTER TABLE "recruit_candidate_otps" ALTER COLUMN "companyId" DROP NOT NULL;
ALTER TABLE "recruit_candidate_documents" ALTER COLUMN "companyId" DROP NOT NULL;
ALTER TABLE "recruit_data_requests" ALTER COLUMN "companyId" DROP NOT NULL;
