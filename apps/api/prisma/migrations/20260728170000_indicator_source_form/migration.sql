-- Vínculo direto entre indicador e formulário que o alimenta.
--
-- (área, setor) não identifica o indicador: um setor pode ter vários
-- indicadores diferentes. O par (ownerNodeId, formTemplateId) é que resolve —
-- ex.: setor "Colheita Mecanizada" + formulário "ISSMA" → indicador
-- "CONF. ISSMA Colheita Mecanizada".
ALTER TABLE "Indicator" ADD COLUMN IF NOT EXISTS "formTemplateId" TEXT;

CREATE INDEX IF NOT EXISTS "Indicator_formTemplateId_idx" ON "Indicator" ("formTemplateId");

-- Consulta quente da agregação: "qual indicador é deste setor com este form?"
CREATE INDEX IF NOT EXISTS "Indicator_ownerNodeId_formTemplateId_idx"
  ON "Indicator" ("ownerNodeId", "formTemplateId");

DO $$
BEGIN
  ALTER TABLE "Indicator"
    ADD CONSTRAINT "Indicator_formTemplateId_fkey"
    FOREIGN KEY ("formTemplateId") REFERENCES "FormTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
