-- Nota por pergunta no checklist.
--
-- Nem toda pergunta tem nota: num checklist pontuado, a pergunta SEM nota
-- continua sendo respondida, mas fica fora do resultado. Para representar isso
-- e preciso diferenciar "sem nota" de "nota 1" — dai a coluna virar NULL-avel.
--
-- Os formularios que ja existem tem weight = 1 em todos os campos (o antigo
-- default NOT NULL). Como todos ficam iguais, o resultado deles continua sendo
-- o percentual de itens conformes, exatamente como era.
ALTER TABLE "FormField" ALTER COLUMN "weight" DROP NOT NULL;
ALTER TABLE "FormField" ALTER COLUMN "weight" DROP DEFAULT;

-- A nota tambem fica congelada na resposta: se o analista repontuar o checklist
-- depois, o registro antigo continua batendo com o percentual gravado nele.
--
-- Sem default: as respostas ja gravadas ficam com NULL, o que as deixa como
-- "checklist sem nota" — que e como elas foram apuradas na epoca.
ALTER TABLE "FormAnswer" ADD COLUMN IF NOT EXISTS "weight" DOUBLE PRECISION;
