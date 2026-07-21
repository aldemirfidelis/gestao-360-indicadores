-- Ancoragem de causa raiz por causa do Ishikawa (múltiplas causas raiz por análise).
ALTER TABLE "ActionIshikawaCause" ADD COLUMN "rootCause" TEXT;
