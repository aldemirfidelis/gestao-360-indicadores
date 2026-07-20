-- Templates de e-mail automático por evento do funil de recrutamento (um por
-- evento por empresa; sem linha customizada o serviço usa um texto padrão embutido).

CREATE TABLE "recruit_email_templates" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recruit_email_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recruit_email_templates_companyId_event_key" ON "recruit_email_templates"("companyId", "event");
