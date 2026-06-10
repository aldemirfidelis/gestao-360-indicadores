-- Migration: Gestao de Premio - vinculo com indicador nativo da plataforma
-- Aditiva e reversivel. Adiciona platformIndicatorId (scalar) + indice em PrizeIndicator.
-- Rollback: ALTER TABLE "PrizeIndicator" DROP COLUMN "platformIndicatorId";

-- AlterTable
ALTER TABLE "PrizeIndicator" ADD COLUMN     "platformIndicatorId" TEXT;

-- CreateIndex
CREATE INDEX "PrizeIndicator_platformIndicatorId_idx" ON "PrizeIndicator"("platformIndicatorId");

