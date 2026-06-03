-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('SAP', 'APDATA', 'SESUITE', 'REST_GENERIC', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "IntegrationDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'BOTH');

-- CreateEnum
CREATE TYPE "IntegrationAuthType" AS ENUM ('NONE', 'API_KEY', 'BEARER', 'BASIC', 'OAUTH2');

-- CreateTable
CREATE TABLE "ExternalIntegration" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL DEFAULT 'REST_GENERIC',
    "direction" "IntegrationDirection" NOT NULL DEFAULT 'OUTBOUND',
    "authType" "IntegrationAuthType" NOT NULL DEFAULT 'API_KEY',
    "baseUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'enabled',
    "credentialsEnc" TEXT,
    "config" JSONB,
    "lastRunAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "lastError" TEXT,
    "lastLatencyMs" INTEGER,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ExternalIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalIntegrationLog" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "direction" "IntegrationDirection" NOT NULL,
    "operation" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "httpStatus" INTEGER,
    "message" TEXT,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalIntegrationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundApiKey" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "scopes" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboundApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalIntegration_companyId_idx" ON "ExternalIntegration"("companyId");

-- CreateIndex
CREATE INDEX "ExternalIntegrationLog_integrationId_idx" ON "ExternalIntegrationLog"("integrationId");

-- CreateIndex
CREATE INDEX "ExternalIntegrationLog_companyId_idx" ON "ExternalIntegrationLog"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "InboundApiKey_keyHash_key" ON "InboundApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "InboundApiKey_companyId_idx" ON "InboundApiKey"("companyId");

-- AddForeignKey
ALTER TABLE "ExternalIntegrationLog" ADD CONSTRAINT "ExternalIntegrationLog_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "ExternalIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

