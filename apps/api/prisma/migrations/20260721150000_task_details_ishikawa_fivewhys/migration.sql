-- Detalhamento da tarefa (do 5W2H) e persistência do 5 Porquês por causa do Ishikawa.
ALTER TABLE "ActionTask" ADD COLUMN "description" TEXT;
ALTER TABLE "ActionIshikawaCause" ADD COLUMN "fiveWhysData" JSONB;
