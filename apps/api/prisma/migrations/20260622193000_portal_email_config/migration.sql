-- Portal Global → E-mail: configuração SMTP do sistema e caixas/remetentes (ex.: contato@gestao360.org).
CREATE TABLE "PortalEmailSetting" (
    "id" TEXT NOT NULL,
    "host" TEXT,
    "port" INTEGER NOT NULL DEFAULT 587,
    "secure" BOOLEAN NOT NULL DEFAULT false,
    "username" TEXT,
    "passwordEnc" TEXT,
    "fromName" TEXT,
    "fromAddress" TEXT,
    "replyTo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastTestAt" TIMESTAMP(3),
    "lastTestOk" BOOLEAN,
    "lastTestError" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PortalEmailSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PortalMailbox" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "displayName" TEXT,
    "purpose" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PortalMailbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PortalMailbox_address_key" ON "PortalMailbox"("address");

CREATE INDEX "PortalMailbox_active_idx" ON "PortalMailbox"("active");
