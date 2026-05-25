-- Tamanho customizavel por objetivo no mapa estrategico.
ALTER TABLE "StrategicObjective" ADD COLUMN "width" DOUBLE PRECISION NOT NULL DEFAULT 260;
ALTER TABLE "StrategicObjective" ADD COLUMN "height" DOUBLE PRECISION NOT NULL DEFAULT 150;
