-- Posicao livre por perspectiva no canvas.
ALTER TABLE "Perspective" ADD COLUMN "positionX" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Perspective" ADD COLUMN "positionY" DOUBLE PRECISION NOT NULL DEFAULT 0;
