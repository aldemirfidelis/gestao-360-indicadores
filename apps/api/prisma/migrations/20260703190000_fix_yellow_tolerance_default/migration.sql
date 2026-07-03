-- Corrige o farol dos indicadores: a formula de calcStatus passou a comparar
-- o ATINGIMENTO diretamente com "yellowToleranceP" (percentual minimo de
-- atingimento para ficar amarelo), em vez do desvio bruto vs meta. Sob a
-- formula antiga, "yellowToleranceP" representava "pontos de folga abaixo de
-- 100%", entao o default antigo (10) equivale ao novo default (90).
--
-- Atualiza apenas os indicadores que nunca customizaram o campo (ainda no
-- valor antigo default = 10): preserva o comportamento efetivo anterior
-- (~90% de atingimento minimo) sem alterar valores customizados por usuarios
-- (ex.: um indicador com 98 continua 98, agora com o significado correto).
UPDATE "Indicator" SET "yellowToleranceP" = 90 WHERE "yellowToleranceP" = 10;

-- AlterTable
ALTER TABLE "Indicator" ALTER COLUMN "yellowToleranceP" SET DEFAULT 90;
