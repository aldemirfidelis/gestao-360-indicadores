-- Etapa 7 da Gestão de Jornada / integração 360: fonte INTERNAL no Prêmio
-- (base elegível sincronizada da base interna de colaboradores). Aditiva.

ALTER TYPE "PrizeConnectorType" ADD VALUE IF NOT EXISTS 'INTERNAL';
