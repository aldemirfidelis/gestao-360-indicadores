-- Tamanho customizavel por perspectiva no mapa estrategico.
ALTER TABLE "Perspective" ADD COLUMN "width" DOUBLE PRECISION NOT NULL DEFAULT 1320;
ALTER TABLE "Perspective" ADD COLUMN "height" DOUBLE PRECISION NOT NULL DEFAULT 230;
