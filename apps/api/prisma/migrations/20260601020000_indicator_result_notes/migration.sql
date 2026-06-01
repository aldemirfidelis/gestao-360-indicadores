-- Anexos (arquivo em BYTEA, limite de 5 MB aplicado na API) e comentarios de resultados lancados.
-- Chaveados por (indicatorId, periodRef). Idempotente.

CREATE TABLE IF NOT EXISTS "IndicatorResultAttachment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "periodRef" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "data" BYTEA NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndicatorResultAttachment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "IndicatorResultAttachment_companyId_idx" ON "IndicatorResultAttachment"("companyId");
CREATE INDEX IF NOT EXISTS "IndicatorResultAttachment_indicatorId_periodRef_idx" ON "IndicatorResultAttachment"("indicatorId", "periodRef");

CREATE TABLE IF NOT EXISTS "IndicatorResultComment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "periodRef" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndicatorResultComment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "IndicatorResultComment_companyId_idx" ON "IndicatorResultComment"("companyId");
CREATE INDEX IF NOT EXISTS "IndicatorResultComment_indicatorId_periodRef_idx" ON "IndicatorResultComment"("indicatorId", "periodRef");
