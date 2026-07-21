-- Como o acumulado (YTD) do indicador é calculado: média (padrão), soma ou fixo.
CREATE TYPE "IndicatorAccumulation" AS ENUM ('AVERAGE', 'SUM', 'FIXED');
ALTER TABLE "Indicator" ADD COLUMN "accumulation" "IndicatorAccumulation" NOT NULL DEFAULT 'AVERAGE';
