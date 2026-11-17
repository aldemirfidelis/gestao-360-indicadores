-- CreateEnum
CREATE TYPE "DocumentConfidentiality" AS ENUM ('INTERNAL', 'RESTRICTED', 'CONFIDENTIAL');

-- CreateEnum
CREATE TYPE "DocumentContentFormat" AS ENUM ('TEXT', 'STRUCTURED', 'DOCX', 'FILE');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "bodyText" TEXT,
ADD COLUMN     "confidentiality" "DocumentConfidentiality" NOT NULL DEFAULT 'INTERNAL',
ADD COLUMN     "contentFormat" "DocumentContentFormat" NOT NULL DEFAULT 'TEXT',
ADD COLUMN     "contentJson" JSONB,
ADD COLUMN     "disposedAt" TIMESTAMP(3),
ADD COLUMN     "readDueDays" INTEGER,
ADD COLUMN     "readRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "retentionUntil" TIMESTAMP(3),
ADD COLUMN     "searchText" TEXT,
ADD COLUMN     "typeConfigId" TEXT;

-- AlterTable
ALTER TABLE "document_versions" ADD COLUMN     "bodyText" TEXT,
ADD COLUMN     "contentHash" TEXT,
ADD COLUMN     "contentJson" JSONB,
ADD COLUMN     "pdfSource" TEXT;

-- AlterTable
ALTER TABLE "document_workflow_steps" ADD COLUMN     "delegatedFromUserId" TEXT,
ADD COLUMN     "remindedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "document_approvals" ADD COLUMN     "contentHash" TEXT,
ADD COLUMN     "delegatedFromUserId" TEXT,
ADD COLUMN     "signatureHash" TEXT,
ADD COLUMN     "signatureMethod" TEXT,
ADD COLUMN     "stepId" TEXT,
ADD COLUMN     "userAgent" TEXT;

-- AlterTable
ALTER TABLE "document_read_confirmations" ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "remindedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "document_blobs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "mimeType" TEXT,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_blobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_change_requests" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionId" TEXT,
    "requesterUserId" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reason" TEXT NOT NULL,
    "proposal" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "sourceLabel" TEXT,
    "decisionNote" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "implementedVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_blobs_companyId_idx" ON "document_blobs"("companyId");

-- CreateIndex
CREATE INDEX "document_blobs_sha256_idx" ON "document_blobs"("sha256");

-- CreateIndex
CREATE INDEX "document_change_requests_companyId_status_idx" ON "document_change_requests"("companyId", "status");

-- CreateIndex
CREATE INDEX "document_change_requests_documentId_status_idx" ON "document_change_requests"("documentId", "status");

-- CreateIndex
CREATE INDEX "document_change_requests_ownerUserId_status_idx" ON "document_change_requests"("ownerUserId", "status");

-- CreateIndex
CREATE INDEX "Document_companyId_confidentiality_idx" ON "Document"("companyId", "confidentiality");

-- CreateIndex
CREATE INDEX "Document_typeConfigId_idx" ON "Document"("typeConfigId");

-- CreateIndex
CREATE INDEX "document_workflow_steps_userId_decision_idx" ON "document_workflow_steps"("userId", "decision");

-- CreateIndex
CREATE INDEX "document_read_confirmations_userId_status_idx" ON "document_read_confirmations"("userId", "status");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_typeConfigId_fkey" FOREIGN KEY ("typeConfigId") REFERENCES "document_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_change_requests" ADD CONSTRAINT "document_change_requests_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Busca de texto completo do GED: "searchText" ja chega sem acentos e em
-- minusculas (normalizado pela API). O indice 'simple' atende a busca por
-- prefixo enquanto a pessoa digita; o 'portuguese' cobre plural e variacoes
-- de palavras completas (stemming).
CREATE INDEX "Document_searchText_simple_fts_idx" ON "Document" USING GIN (to_tsvector('simple', COALESCE("searchText", '')));
CREATE INDEX "Document_searchText_pt_fts_idx" ON "Document" USING GIN (to_tsvector('portuguese', COALESCE("searchText", '')));

-- Vincula documentos existentes ao tipo configurado: primeiro pelo prefixo do
-- codigo (ex.: PRO-001 -> tipo PRO), depois pela categoria do documento.
UPDATE "Document" d
SET "typeConfigId" = (
  SELECT dt."id" FROM "document_types" dt
  WHERE dt."companyId" = d."companyId" AND dt."deletedAt" IS NULL AND d."code" LIKE dt."prefix" || '-%'
  ORDER BY length(dt."prefix") DESC, dt."createdAt" ASC
  LIMIT 1
)
WHERE d."typeConfigId" IS NULL AND d."code" IS NOT NULL;

UPDATE "Document" d
SET "typeConfigId" = (
  SELECT dt."id" FROM "document_types" dt
  WHERE dt."companyId" = d."companyId" AND dt."deletedAt" IS NULL AND dt."category" = d."type"
  ORDER BY dt."createdAt" ASC
  LIMIT 1
)
WHERE d."typeConfigId" IS NULL;

-- Documentos que ja tinham DOCX binario (editado no Word/Collabora) passam a
-- ter o Word como formato principal.
UPDATE "Document" d
SET "contentFormat" = 'DOCX'
WHERE EXISTS (
  SELECT 1 FROM "document_files" f
  WHERE f."documentId" = d."id" AND f."kind" = 'DOCX' AND f."contentText" IS NULL AND f."deletedAt" IS NULL
);

-- Texto inicial de busca; a API recalcula a cada alteracao do documento.
UPDATE "Document" SET "bodyText" = "content" WHERE "bodyText" IS NULL AND "content" IS NOT NULL;
UPDATE "Document"
SET "searchText" = lower(translate(
  concat_ws(' ', "code", "title", "description", "bodyText"),
  'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
  'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
))
WHERE "searchText" IS NULL;
