-- Marca se a triagem por IA leu o arquivo do currículo (multimodal) ou só texto
-- digitado — visível na UI para o recrutador saber o que a análise realmente considerou.
ALTER TABLE "recruit_ai_analyses" ADD COLUMN "resumeConsidered" BOOLEAN NOT NULL DEFAULT false;
