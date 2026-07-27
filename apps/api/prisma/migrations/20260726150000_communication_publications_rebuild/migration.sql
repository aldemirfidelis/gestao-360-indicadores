-- =====================================================================
-- Comunicacao Interna — refatoracao do modulo para publicacoes institucionais
--
-- Migracao ADITIVA: nenhuma coluna/tabela existente e removida. Alem do DDL,
-- faz o backfill dos dados historicos (secao 18 do plano):
--   1) categorias por empresa a partir dos textos ja usados em CommunicationPost;
--   2) publico legado (Json `audience`) -> CommunicationPostAudience;
--   3) destinatarios dos comunicados publicados -> CommunicationPostRecipient;
--   4) capa/anexos existentes continuam validos (URL na propria publicacao).
-- =====================================================================

-- ---------- Enums novos ----------
CREATE TYPE "CommPostLayout" AS ENUM ('BANNER_WIDE', 'FEED_CARD', 'IMAGE_TEXT', 'GALLERY', 'TEXT_ONLY');
CREATE TYPE "CommAudienceKind" AS ENUM ('ALL', 'ORG_NODE', 'JOB', 'ROLE', 'USER');
CREATE TYPE "CommPostMediaRole" AS ENUM ('COVER', 'GALLERY', 'ATTACHMENT');

-- ---------- Categorias configuraveis por empresa ----------
CREATE TABLE "CommunicationCategory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "CommunicationCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CommunicationCategory_companyId_slug_key" ON "CommunicationCategory"("companyId", "slug");
CREATE INDEX "CommunicationCategory_companyId_active_idx" ON "CommunicationCategory"("companyId", "active");
ALTER TABLE "CommunicationCategory" ADD CONSTRAINT "CommunicationCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------- Configuracao do modulo por empresa ----------
CREATE TABLE "CommunicationSettings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "approvalRequired" BOOLEAN NOT NULL DEFAULT false,
    "defaultEmployeeFeed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommunicationSettings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CommunicationSettings_companyId_key" ON "CommunicationSettings"("companyId");
ALTER TABLE "CommunicationSettings" ADD CONSTRAINT "CommunicationSettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------- Publico e destinatarios (relacoes reais) ----------
CREATE TABLE "CommunicationPostAudience" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "kind" "CommAudienceKind" NOT NULL,
    "refId" TEXT,
    CONSTRAINT "CommunicationPostAudience_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CommunicationPostAudience_postId_kind_refId_key" ON "CommunicationPostAudience"("postId", "kind", "refId");
CREATE INDEX "CommunicationPostAudience_postId_idx" ON "CommunicationPostAudience"("postId");
ALTER TABLE "CommunicationPostAudience" ADD CONSTRAINT "CommunicationPostAudience_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunicationPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CommunicationPostRecipient" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunicationPostRecipient_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CommunicationPostRecipient_postId_userId_key" ON "CommunicationPostRecipient"("postId", "userId");
CREATE INDEX "CommunicationPostRecipient_userId_idx" ON "CommunicationPostRecipient"("userId");
ALTER TABLE "CommunicationPostRecipient" ADD CONSTRAINT "CommunicationPostRecipient_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunicationPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------- Vinculo publicacao <-> biblioteca de midias ----------
CREATE TABLE "CommunicationPostMedia" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "role" "CommPostMediaRole" NOT NULL DEFAULT 'GALLERY',
    "position" INTEGER NOT NULL DEFAULT 0,
    "alt" TEXT,
    CONSTRAINT "CommunicationPostMedia_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CommunicationPostMedia_postId_mediaId_role_key" ON "CommunicationPostMedia"("postId", "mediaId", "role");
CREATE INDEX "CommunicationPostMedia_mediaId_idx" ON "CommunicationPostMedia"("mediaId");
ALTER TABLE "CommunicationPostMedia" ADD CONSTRAINT "CommunicationPostMedia_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunicationPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationPostMedia" ADD CONSTRAINT "CommunicationPostMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "CommunicationMedia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------- Colunas novas em CommunicationPost ----------
ALTER TABLE "CommunicationPost"
    ADD COLUMN "categoryId" TEXT,
    ADD COLUMN "layout" "CommPostLayout" NOT NULL DEFAULT 'IMAGE_TEXT',
    ADD COLUMN "updatedById" TEXT,
    ADD COLUMN "publishedById" TEXT,
    ADD COLUMN "coverImageAlt" TEXT,
    ADD COLUMN "actionNewTab" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "allowAttachmentDownload" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "showInEmployeeFeed" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "notifyInApp" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "notifyEmail" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "CommunicationPost_companyId_status_showInEmployeeFeed_idx" ON "CommunicationPost"("companyId", "status", "showInEmployeeFeed");
CREATE INDEX "CommunicationPost_categoryId_idx" ON "CommunicationPost"("categoryId");
ALTER TABLE "CommunicationPost" ADD CONSTRAINT "CommunicationPost_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CommunicationCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------- Colunas novas em CommunicationMedia ----------
ALTER TABLE "CommunicationMedia"
    ADD COLUMN "folder" TEXT,
    ADD COLUMN "mimeType" TEXT,
    ADD COLUMN "sizeBytes" INTEGER,
    ADD COLUMN "width" INTEGER,
    ADD COLUMN "height" INTEGER,
    ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "CommunicationMedia_companyId_folder_idx" ON "CommunicationMedia"("companyId", "folder");

-- =====================================================================
-- BACKFILL 1 — categorias a partir dos textos ja gravados nas publicacoes
-- =====================================================================
INSERT INTO "CommunicationCategory" ("id", "companyId", "name", "slug", "active", "position", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    p."companyId",
    p."category",
    -- slug sem depender da extensao unaccent: translate cobre os acentos pt-BR
    trim(both '-' from lower(regexp_replace(
        translate(p."category",
                  'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
                  'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'),
        '[^a-zA-Z0-9]+', '-', 'g'))),
    true,
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT "companyId", "category" FROM "CommunicationPost" WHERE "category" IS NOT NULL AND "category" <> ''
) p
ON CONFLICT ("companyId", "slug") DO NOTHING;

UPDATE "CommunicationPost" p
SET "categoryId" = c."id"
FROM "CommunicationCategory" c
WHERE c."companyId" = p."companyId"
  AND c."name" = p."category"
  AND p."categoryId" IS NULL;

-- =====================================================================
-- BACKFILL 2 — publico legado (Json) -> CommunicationPostAudience
-- =====================================================================
-- Toda a empresa / usuarios ativos
INSERT INTO "CommunicationPostAudience" ("id", "postId", "kind", "refId")
SELECT gen_random_uuid()::text, p."id", 'ALL'::"CommAudienceKind", NULL
FROM "CommunicationPost" p
WHERE COALESCE(p."audience"->>'scope', 'ALL_COMPANY') IN ('ALL_COMPANY', 'ACTIVE_USERS')
ON CONFLICT DO NOTHING;

-- Areas selecionadas -> nos da estrutura organizacional
INSERT INTO "CommunicationPostAudience" ("id", "postId", "kind", "refId")
SELECT DISTINCT gen_random_uuid()::text, p."id", 'ORG_NODE'::"CommAudienceKind", area
FROM "CommunicationPost" p,
     LATERAL jsonb_array_elements_text(COALESCE(p."audience"->'areaIds', '[]'::jsonb)) AS area
WHERE p."audience"->>'scope' = 'AREAS'
ON CONFLICT DO NOTHING;

-- Usuarios especificos
INSERT INTO "CommunicationPostAudience" ("id", "postId", "kind", "refId")
SELECT DISTINCT gen_random_uuid()::text, p."id", 'USER'::"CommAudienceKind", usr
FROM "CommunicationPost" p,
     LATERAL jsonb_array_elements_text(COALESCE(p."audience"->'userIds', '[]'::jsonb)) AS usr
WHERE p."audience"->>'scope' = 'USERS'
ON CONFLICT DO NOTHING;

-- Gestores / Diretoria -> grupo por papel
INSERT INTO "CommunicationPostAudience" ("id", "postId", "kind", "refId")
SELECT gen_random_uuid()::text, p."id", 'ROLE'::"CommAudienceKind",
       CASE WHEN p."audience"->>'scope' = 'MANAGERS' THEN 'MANAGER' ELSE 'DIRECTOR' END
FROM "CommunicationPost" p
WHERE p."audience"->>'scope' IN ('MANAGERS', 'DIRECTORS')
ON CONFLICT DO NOTHING;

-- =====================================================================
-- BACKFILL 3 — destinatarios das publicacoes ja divulgadas
-- (mesma regra de audiencia que o service aplicava em memoria)
-- =====================================================================
INSERT INTO "CommunicationPostRecipient" ("id", "postId", "userId", "createdAt")
SELECT DISTINCT gen_random_uuid()::text, p."id", u."id", COALESCE(p."publishedAt", p."createdAt")
FROM "CommunicationPost" p
JOIN "User" u ON u."companyId" = p."companyId" AND u."deletedAt" IS NULL AND u."active" = true
WHERE p."status" IN ('PUBLISHED', 'EXPIRED', 'ARCHIVED')
  AND (
        COALESCE(p."audience"->>'scope', 'ALL_COMPANY') IN ('ALL_COMPANY', 'ACTIVE_USERS')
     OR (p."audience"->>'scope' = 'MANAGERS' AND u."role" = 'MANAGER')
     OR (p."audience"->>'scope' = 'DIRECTORS' AND u."role" = 'DIRECTOR')
     OR (p."audience"->>'scope' = 'USERS'
         AND COALESCE(p."audience"->'userIds', '[]'::jsonb) ? u."id")
     OR (p."audience"->>'scope' = 'AREAS'
         AND u."defaultNodeId" IS NOT NULL
         AND COALESCE(p."audience"->'areaIds', '[]'::jsonb) ? u."defaultNodeId")
  )
ON CONFLICT DO NOTHING;

-- =====================================================================
-- BACKFILL 4 — publicacoes antigas ja nascem visiveis no feed do colaborador
-- somente quando o canal "plataforma"/"meu dia" estava marcado.
-- =====================================================================
UPDATE "CommunicationPost"
SET "showInEmployeeFeed" = COALESCE(("channels"->>'platform')::boolean, true)
                        OR COALESCE(("channels"->>'myDay')::boolean, false);
