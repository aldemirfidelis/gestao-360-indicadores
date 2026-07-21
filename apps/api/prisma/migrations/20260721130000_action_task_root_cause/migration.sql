-- Rastreabilidade da causa raiz por tarefa do plano de ação.
ALTER TABLE "ActionTask" ADD COLUMN "rootCause" TEXT;
