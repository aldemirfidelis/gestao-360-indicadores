-- Mapa de rondas (Seguranca Patrimonial): planta da rota + posicao percentual
-- dos pontos de controle sobre o mapa. Aditivo.
ALTER TABLE "SecurityRoundRoute" ADD COLUMN "mapImage" TEXT;
ALTER TABLE "SecurityRoundCheckpoint" ADD COLUMN "mapX" DOUBLE PRECISION;
ALTER TABLE "SecurityRoundCheckpoint" ADD COLUMN "mapY" DOUBLE PRECISION;
