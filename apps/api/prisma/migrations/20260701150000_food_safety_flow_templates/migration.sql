-- Modelos de fluxo da empresa (Seguranca dos Alimentos): sequencias de
-- etapas reutilizaveis, criadas do zero, salvas de um processo existente ou
-- importadas via JSON.
CREATE TABLE "FoodSafetyFlowTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sector" TEXT,
    "summary" TEXT,
    "color" TEXT,
    "steps" JSONB NOT NULL,
    "stepCount" INTEGER NOT NULL DEFAULT 0,
    "sourceProcessId" TEXT,
    "createdById" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FoodSafetyFlowTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FoodSafetyFlowTemplate_companyId_active_idx" ON "FoodSafetyFlowTemplate"("companyId", "active");

ALTER TABLE "FoodSafetyFlowTemplate" ADD CONSTRAINT "FoodSafetyFlowTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
