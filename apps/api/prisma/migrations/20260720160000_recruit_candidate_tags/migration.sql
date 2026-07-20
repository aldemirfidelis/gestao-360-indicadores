-- Tags do candidato (skills/categorização) para busca no banco de talentos.
-- Como o candidato é global, o escopo de visibilidade continua sendo por
-- vínculo (RecruitApplication.companyId) na camada de aplicação, não aqui.
ALTER TABLE "recruit_candidates" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX "recruit_candidates_tags_idx" ON "recruit_candidates" USING GIN ("tags");
