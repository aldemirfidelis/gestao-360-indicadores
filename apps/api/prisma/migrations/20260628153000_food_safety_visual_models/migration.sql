-- Permite separar a categoria HACCP da representação 3D da etapa.
-- Valores são chaves estáveis da biblioteca visual do frontend.
ALTER TABLE "FoodSafetyProcessStep"
ADD COLUMN "visualModel" TEXT;
