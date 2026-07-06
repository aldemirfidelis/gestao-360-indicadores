-- Meta secundária e faixa de ganho por período do indicador.
-- Lançados separadamente pelo usuário; aditivo e opcional (nulos até serem informados).
ALTER TABLE "IndicatorTarget" ADD COLUMN "secondaryTarget" DOUBLE PRECISION;
ALTER TABLE "IndicatorTarget" ADD COLUMN "gainLower" DOUBLE PRECISION;
ALTER TABLE "IndicatorTarget" ADD COLUMN "gainUpper" DOUBLE PRECISION;
