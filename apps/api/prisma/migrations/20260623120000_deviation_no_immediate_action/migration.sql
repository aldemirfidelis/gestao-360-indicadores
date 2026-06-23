-- Desvio: marca "não houve providência imediata" (exige análise de causa).
ALTER TABLE "Deviation" ADD COLUMN "noImmediateAction" BOOLEAN NOT NULL DEFAULT false;
