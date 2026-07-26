-- Controles por chave para integracoes de cada empresa.
ALTER TABLE "InboundApiKey"
  ADD COLUMN "lastUsedIp" TEXT,
  ADD COLUMN "allowedIps" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "rateLimitPerMinute" INTEGER,
  ADD COLUMN "revokedAt" TIMESTAMP(3);

ALTER TABLE "InboundApiKey"
  ADD CONSTRAINT "InboundApiKey_rateLimitPerMinute_check"
  CHECK ("rateLimitPerMinute" IS NULL OR "rateLimitPerMinute" BETWEEN 1 AND 5000);
