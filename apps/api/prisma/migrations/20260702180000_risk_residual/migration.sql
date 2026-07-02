-- Risco residual (probabilidade/impacto estimados após a mitigação).
-- Aditivo: nulos até o cliente avaliar o residual.
ALTER TABLE "RiskRegister" ADD COLUMN "residualProbability" INTEGER;
ALTER TABLE "RiskRegister" ADD COLUMN "residualImpact" INTEGER;
